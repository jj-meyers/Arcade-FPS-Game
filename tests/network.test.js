import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { NetworkClient } from '../src/net/NetworkClient.js';
import { applySnapshot } from '../src/net/snapshot.js';
import { Game } from '../src/game/Game.js';
import { normalizeLoadout } from '../src/data/customization.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message = 'condition', timeout = 3000) {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeout) throw new Error(`Timed out waiting for ${message}.`);
    await delay(5);
  }
  return check();
}
async function peer(url) {
  const socket = new WebSocket(url), messages = [];
  socket.on('message', data => messages.push(JSON.parse(data.toString())));
  socket.on('error', () => {});
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return {
    socket, messages,
    send(message) { socket.send(typeof message === 'string' ? message : JSON.stringify(message)); },
    async wait(type, predicate = () => true, from = 0) {
      return until(() => messages.slice(from).find(message => message.type === type && predicate(message)), type);
    },
  };
}
async function fixture(t, options = {}) {
  const server = await createGameServer({ host: '127.0.0.1', port: 0, autoTick: false, ...options });
  t.after(() => server.close());
  const url = `ws://127.0.0.1:${server.address.port}`;
  return { server, url };
}
async function twoPlayers(t, config = {}, options) {
  const { server, url } = await fixture(t, options);
  const host = await peer(url), guest = await peer(url);
  host.send({ type: 'create', name: 'Host', config: { botCount: 0, ...config }, loadout: { primary: 'rail', classId: 'runner' } });
  const created = await host.wait('lobby');
  guest.send({ type: 'join', code: created.code.toLowerCase(), name: 'Guest', config: { playerTeam: 'b' }, loadout: { classId: 'bulwark' } });
  const joined = await guest.wait('lobby');
  return { server, url, host, guest, room: server.rooms.get(created.code), hostId: created.playerId, guestId: joined.playerId };
}
async function startMatch(context) {
  const { host, server, room } = context;
  host.send({ type: 'start' });
  await host.wait('snapshot');
  for (let n = 0; n < 181; n++) server.tick();
  assert.equal(room.game.match.state, 'playing');
}

test('two real clients join, move both humans, shoot, score and receive authoritative snapshots', async t => {
  const context = await twoPlayers(t, { scoreLimit: 1 });
  const { server, host, guest, room, hostId, guestId } = context;
  await host.wait('lobby', message => message.players.length === 2);
  guest.send({ type: 'start' });
  assert.match((await guest.wait('error')).message, /host/);
  await startMatch(context);
  const hostActor = room.game.getActor(hostId), guestActor = room.game.getActor(guestId);
  assert.equal(room.game.actors.length, 2);
  assert.ok(room.game.actors.every(actor => actor.isHuman));
  const startHost = { ...hostActor.pos }, startGuest = { ...guestActor.pos };
  host.send({ type: 'input', seq: 0, input: { moveX: 1, yaw: 0 } });
  guest.send({ type: 'input', seq: 0, input: { moveX: -1, yaw: 0 } });
  await until(() => room.players.get(guestId).lastSeq === 0 && room.players.get(hostId).lastSeq === 0, 'both input messages');
  for (let n = 0; n < 12; n++) server.tick();
  assert.ok(hostActor.pos.x > startHost.x + .1, 'host moves from authoritative input');
  assert.ok(guestActor.pos.x < startGuest.x - .1, 'guest moves instead of being driven by AI');

  // Arrange an unobstructed combat fixture on the authoritative server. Clients
  // still have to aim/fire through the socket; no damage or position RPC exists.
  Object.assign(hostActor, { pos: { x: -5, y: 0, z: -23 }, vel: { x: 0, y: 0, z: 0 }, invulnerableUntil: 0 });
  Object.assign(guestActor, { pos: { x: 5, y: 0, z: -23 }, vel: { x: 0, y: 0, z: 0 }, invulnerableUntil: 0 });
  guest.send({ type: 'input', seq: 1, input: {} });
  host.send({ type: 'input', seq: 1, input: { yaw: -Math.PI / 2, pitch: -.0144, fire: true } });
  await until(() => room.players.get(hostId).lastSeq === 1 && room.players.get(guestId).lastSeq === 1);
  for (let n = 0; n < 4; n++) server.tick();
  const snapshot = await guest.wait('snapshot', message => message.match.state === 'ended');
  assert.equal(snapshot.playerId, guestId);
  assert.equal(snapshot.actors.find(actor => actor.id === hostId).kills, 1);
  assert.equal(snapshot.actors.find(actor => actor.id === guestId).health, 0);
  assert.equal(snapshot.match.winnerId, hostId);
  assert.ok(snapshot.events.some(event => event.type === 'eliminate' && event.attackerId === hostId));
  const renderGame = new Game();
  assert.equal(applySnapshot(renderGame, snapshot), true);
  assert.equal(renderGame.player.id, guestId);
  assert.equal(renderGame.actors.filter(actor => actor.isPlayer).length, 1);
  const eventCount = renderGame.events.length;
  assert.equal(applySnapshot(renderGame, snapshot), false, 'duplicate snapshots do not replay sounds or damage events');
  assert.equal(renderGame.events.length, eventCount);

  host.send({ type: 'start' });
  await until(() => room.game.match.state === 'countdown', 'host rematch');
  assert.deepEqual(room.game.actors.filter(actor => actor.isHuman).map(actor => actor.id).sort(), [hostId, guestId].sort());
  assert.equal(room.game.getActor(hostId).kills, 0);
});

test('TDM server respects teams, bots and friendly-fire rules', async t => {
  const context = await twoPlayers(t, { mode: 'tdm', botCount: 12, playerTeam: 'a' });
  const { server, room, host, hostId, guestId } = context;
  await startMatch(context);
  const game = room.game;
  assert.equal(game.actors.filter(actor => !actor.isHuman).length, 12);
  assert.equal(game.getActor(hostId).team, 'a');
  assert.equal(game.getActor(guestId).team, 'b');
  // Take bots out of the combat fixture without altering the simulation rules.
  for (const actor of game.actors.filter(actor => !actor.isHuman)) { actor.alive = false; actor.respawnAt = 1000; }
  const shooter = game.getActor(hostId), victim = game.getActor(guestId);
  Object.assign(shooter, { pos: { x: -5, y: 0, z: -23 }, vel: { x: 0, y: 0, z: 0 }, invulnerableUntil: 0 });
  Object.assign(victim, { pos: { x: 5, y: 0, z: -23 }, vel: { x: 0, y: 0, z: 0 }, invulnerableUntil: 0 });
  victim.team = 'a';
  host.send({ type: 'input', seq: 0, input: { yaw: -Math.PI / 2, pitch: -.0144, fire: true } });
  await until(() => room.players.get(hostId).lastSeq === 0);
  server.tick();
  assert.equal(victim.health, 100, 'server prevents teammate damage');
  assert.equal(shooter.kills, 0);
  victim.team = 'b';
  shooter.inventory.rail.nextFire = 0;
  server.tick();
  assert.equal(victim.alive, false);
  assert.equal(game.match.teamScores.a, 1);
});

test('host disconnect transfers ownership and final disconnect removes the room', async t => {
  const context = await twoPlayers(t);
  const { server, host, guest, room, hostId, guestId } = context;
  await startMatch(context);
  const before = guest.messages.length;
  host.socket.close(1000, 'Leaving');
  const lobby = await guest.wait('lobby', message => message.isHost, before);
  assert.equal(lobby.players.length, 1);
  assert.equal(room.hostId, guestId);
  assert.equal(room.game.player.id, guestId);
  assert.equal(room.game.getActor(hostId), undefined);
  assert.equal(room.game.humanInputs.has(hostId), false);
  guest.socket.close();
  await until(() => server.rooms.size === 0, 'empty room cleanup');
});

test('players can join an ended room and host the rematch after the old roster leaves', async t => {
  const context = await twoPlayers(t);
  const { server, room, host, guest, url } = context;
  await startMatch(context);
  room.game.end('time');
  const newcomer = await peer(url);
  newcomer.send({ type: 'join', code: room.code, name: 'Next Round' });
  const joined = await newcomer.wait('lobby');
  assert.equal(joined.status, 'ended');
  host.socket.close(); guest.socket.close();
  await until(() => room.players.size === 1);
  assert.equal(room.hostId, joined.playerId);
  for (let n = 0; n < 8; n++) server.tick();
  newcomer.send({ type: 'start' });
  const snapshot = await newcomer.wait('snapshot', state => state.match.state === 'countdown');
  assert.equal(snapshot.actors.length, 1);
  assert.equal(room.game.player.id, joined.playerId);
});

test('untrusted commands, payloads, input sequence and loadouts cannot alter authority', async t => {
  const context = await twoPlayers(t);
  const { server, room, host, guest, guestId } = context;
  await startMatch(context);
  const victim = room.game.getActor(guestId), original = { ...victim.pos };
  let from = guest.messages.length;
  guest.send({ type: 'damage', actorId: guestId, amount: -1000 });
  assert.match((await guest.wait('error', () => true, from)).message, /Unknown/);
  from = guest.messages.length;
  guest.send({ type: 'input', seq: 0, input: { moveX: 1, position: { x: 999 }, damage: 999 } });
  assert.match((await guest.wait('error', () => true, from)).message, /Only movement/);
  from = guest.messages.length;
  guest.send({ type: 'input', seq: 1, input: { moveX: 999 } });
  assert.match((await guest.wait('error', () => true, from)).message, /moveX/);
  guest.send({ type: 'input', seq: 2, input: { moveX: 1, yaw: 0 } });
  await until(() => room.players.get(guestId).lastSeq === 2);
  guest.send({ type: 'input', seq: 1, input: { moveX: -1, yaw: 0 } });
  await delay(10);
  server.tick();
  assert.equal(victim.health, 100);
  assert.ok(victim.pos.x > original.x, 'old sequence cannot replace newer input');
  assert.equal(room.players.get(guestId).lastSeq, 2);
  from = host.messages.length;
  host.send('{');
  assert.match((await host.wait('error', () => true, from)).message, /JSON/);
  const outsider = await peer(context.url);
  outsider.send({ type: 'create', name: 'Bad Name'.repeat(4) });
  assert.match((await outsider.wait('error')).message, /name/);
  outsider.send({ type: 'create', name: 'Valid', config: { botCount: 13 } });
  await outsider.wait('error', message => /botCount/.test(message.message));
  outsider.send({ type: 'create', name: 'Valid', loadout: { primary: 'not-real', classId: 'not-real', cosmetics: { bodyColor: 'javascript:' } } });
  const created = await outsider.wait('lobby');
  const normalized = server.rooms.get(created.code).players.get(created.playerId).loadout;
  assert.deepEqual(normalized, normalizeLoadout({ primary: 'not-real', classId: 'not-real', cosmetics: { bodyColor: 'javascript:' } }));
  outsider.socket.send('x'.repeat(9000));
  await until(() => outsider.socket.readyState === WebSocket.CLOSED, 'oversized payload close');
  await until(() => !server.rooms.has(created.code), 'closed socket room cleanup');
});

test('room limit is eight humans and active games reject late joins', async t => {
  const { server, url } = await fixture(t);
  const host = await peer(url);
  const guests = [];
  host.send({ type: 'create', name: 'Host', config: { botCount: 0 } });
  const lobby = await host.wait('lobby');
  for (let n = 1; n < 8; n++) {
    const guest = await peer(url);
    guests.push(guest);
    guest.send({ type: 'join', name: `Player ${n}`, code: lobby.code });
    await guest.wait('lobby');
  }
  const extra = await peer(url);
  extra.send({ type: 'join', name: 'Extra', code: lobby.code });
  assert.match((await extra.wait('error')).message, /eight/);
  assert.equal(server.rooms.get(lobby.code).players.size, 8);
  host.send({ type: 'start' });
  await host.wait('snapshot');
  assert.equal(server.rooms.get(lobby.code).game.actors.length, 8);
  guests[0].socket.close();
  await until(() => server.rooms.get(lobby.code).players.size === 7);
  const from = extra.messages.length;
  extra.send({ type: 'join', name: 'Late Join', code: lobby.code });
  assert.match((await extra.wait('error', () => true, from)).message, /in progress/);
});

test('message floods close only the offending connection and clean its room', async t => {
  const { server, url } = await fixture(t);
  const noisy = await peer(url), healthy = await peer(url);
  noisy.send({ type: 'create', name: 'Noisy', config: { botCount: 0 } });
  const created = await noisy.wait('lobby');
  const closed = new Promise(resolve => noisy.socket.once('close', (code, reason) => resolve({ code, reason: String(reason) })));
  for (let seq = 0; seq < 220; seq++) noisy.send({ type: 'input', seq, input: {} });
  const result = await closed;
  assert.equal(result.code, 1008);
  assert.match(result.reason, /rate limit/);
  await until(() => !server.rooms.has(created.code), 'rate-limited room cleanup');
  healthy.send({ type: 'create', name: 'Healthy', config: { botCount: 0 } });
  assert.equal((await healthy.wait('lobby')).players.length, 1);
});

test('unjoined connections expire while joined rooms stay connected', async t => {
  const { url } = await fixture(t, { joinTimeoutMs: 120 });
  const idle = await peer(url), joined = await peer(url);
  const expired = new Promise(resolve => idle.socket.once('close', (code, reason) => resolve({ code, reason: String(reason) })));
  joined.send({ type: 'create', name: 'Joined', config: { botCount: 0 } });
  await joined.wait('lobby');
  assert.equal((await expired).code, 1008);
  assert.equal(joined.socket.readyState, WebSocket.OPEN);
});

test('real-time server runs without host focus and neutralizes stale held inputs', async t => {
  const context = await twoPlayers(t, {}, { autoTick: true });
  const { room, host, guest, hostId, guestId } = context;
  host.send({ type: 'start' });
  await host.wait('snapshot');
  // Skip the UI countdown only; subsequent ticks and snapshots use the live timer.
  room.game.match.state = 'playing';
  const actor = room.game.getActor(guestId), start = { ...actor.pos }, startTime = room.game.time;
  guest.send({ type: 'input', seq: 0, input: { moveX: -1, yaw: 0, fire: true } });
  await delay(420);
  assert.ok(room.game.time > startTime + .25, 'server keeps advancing with no host input');
  assert.ok(actor.pos.x < start.x);
  assert.equal(room.game.humanInputs.get(guestId).fire, undefined, 'stale fire is neutralized');
  assert.equal(actor.intent.moveX, 0, 'stale movement is neutralized');
  assert.equal(room.game.humanInputs.get(hostId).moveX, undefined);
  assert.ok(guest.messages.filter(message => message.type === 'snapshot').length >= 4, 'live snapshots continue');
});

test('browser NetworkClient talks to the room server and reports connection failures', async t => {
  const { server, url } = await fixture(t);
  const states = [], errors = [], closes = [];
  const a = new NetworkClient({ WebSocketImpl: WebSocket, onState: snapshot => states.push(snapshot), onError: message => errors.push(message) });
  const b = new NetworkClient({ WebSocketImpl: WebSocket });
  t.after(() => { a.disconnect(); b.disconnect(); });
  const created = await a.connect({ url, action: 'create', name: 'Network A', config: { botCount: 0 } });
  await b.connect({ url, action: 'join', name: 'Network B', code: created.code });
  assert.equal(a.connected, true);
  assert.notEqual(a.playerId, b.playerId);
  assert.equal(a.startMatch(), true);
  await until(() => states.length > 0);
  assert.equal(a.sendInput({ moveX: 1 }), true);
  await until(() => server.rooms.get(created.code).players.get(a.playerId).lastSeq === 0);
  b.disconnect();
  await until(() => server.rooms.get(created.code).players.size === 1);
  const bad = new NetworkClient({ WebSocketImpl: WebSocket, onError: message => errors.push(message), onClose: message => closes.push(message) });
  await assert.rejects(bad.connect({ url, action: 'join', name: 'Missing', code: 'ZZZZZZ' }), /Room not found/);
  assert.ok(errors.some(message => /Room not found/.test(message)));
  await until(() => bad.socket === null, 'failed connection cleanup');
  assert.deepEqual(closes, [], 'failed room requests preserve the error form instead of triggering a match disconnect');
  bad.disconnect();
  await assert.rejects(a.connect({ url: 'https://example.com' }), /ws:\/\//);
});

test('NetworkClient cancellation settles immediately and old sockets cannot affect a replacement connection', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sockets = [], callbacks = [];
  class DelayedSocket extends EventTarget {
    constructor() { super(); this.readyState = 0; this.sent = []; sockets.push(this); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() { this.readyState = 2; }
    open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
    message(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
  }
  const client = new NetworkClient({
    WebSocketImpl: DelayedSocket,
    onLobby: lobby => callbacks.push(['lobby', lobby.playerId]),
    onError: message => callbacks.push(['error', message]),
    onClose: reason => callbacks.push(['close', reason]),
    onState: state => callbacks.push(['state', state]),
  });
  t.after(() => client.disconnect());

  const beforeOpen = client.connect({ url: 'ws://localhost:8080' }).catch(error => error);
  client.disconnect();
  assert.equal((await beforeOpen).name, 'AbortError', 'disconnect settles a connecting socket without waiting for timeout');
  t.mock.timers.tick(10001);
  assert.deepEqual(callbacks, [], 'cancelled connection timeout never reaches the UI');

  const waitingForLobby = client.connect({ url: 'ws://localhost:8080' }).catch(error => error);
  const old = sockets.at(-1);
  old.open();
  assert.equal(old.sent[0].type, 'create');
  const replacement = client.connect({ url: 'ws://localhost:8081' });
  assert.equal((await waitingForLobby).name, 'AbortError', 'replacement settles the previous room request');
  const current = sockets.at(-1);
  current.open();
  current.message({ type: 'lobby', playerId: 'new-player', code: 'ABCDEF', players: [], status: 'lobby' });
  assert.equal((await replacement).playerId, 'new-player');

  // Browser socket events can arrive after close() was requested. Exercise every
  // callback after replacement, then pass the old ten-second timeout deadline.
  for (const stale of sockets.slice(0, -1)) {
    stale.open();
    stale.message({ type: 'lobby', playerId: 'old-player' });
    stale.message({ type: 'snapshot', tick: 100 });
    stale.message({ type: 'error', message: 'Old failure' });
    stale.dispatchEvent(new Event('error'));
    stale.dispatchEvent(new Event('close'));
  }
  t.mock.timers.tick(10001);
  assert.equal(client.connected, true);
  assert.equal(client.socket, current);
  assert.equal(client.playerId, 'new-player');
  assert.deepEqual(callbacks, [['lobby', 'new-player']]);
});
