import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Game } from '../src/game/Game.js';
import { makeSnapshot } from '../src/net/snapshot.js';
import { EDGE_KEYS, LIMITS, record, playerName, loadout, matchConfig, inputState, roomCode } from './validation.js';

const DT = 1 / 60;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from(randomBytes(6), byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');

/**
 * Anonymous, code-based rooms. Expose behind a TLS reverse proxy for public wss.
 * Only this process owns simulation, health, hits, scores and respawns.
 */
export async function createGameServer({ port = 8080, host = '0.0.0.0', autoTick = true, maxRooms = LIMITS.rooms, joinTimeoutMs = LIMITS.joinTimeoutMs } = {}) {
  const rooms = new Map(), clients = new Set();
  const http = createServer((request, response) => {
    const health = request.url === '/health';
    response.writeHead(health ? 200 : 404, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(health ? { service: 'Unfug', ok: true, rooms: rooms.size } : { error: 'Use a WebSocket connection to play.' }));
  });
  const wss = new WebSocketServer({ server: http, maxPayload: LIMITS.payload, perMessageDeflate: false });
  let timer, heartbeat, closing = false;
  const send = (client, message) => {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    if (client.socket.bufferedAmount > 1024 * 1024) { client.socket.close(1013, 'Connection too slow.'); return; }
    client.socket.send(JSON.stringify(message));
  };
  const error = (client, message) => send(client, { type: 'error', message });
  const awaitJoin = client => {
    clearTimeout(client.joinTimer);
    if (client.socket.readyState !== WebSocket.OPEN) return;
    client.joinTimer = setTimeout(() => {
      if (!client.room) client.socket.close(1008, 'Join a room within 30 seconds.');
    }, joinTimeoutMs);
    client.joinTimer.unref();
  };
  const lobby = room => {
    for (const client of room.players.values()) send(client, {
      type: 'lobby', code: room.code, playerId: client.id, isHost: room.hostId === client.id,
      status: room.game?.match.state ?? 'lobby', config: room.config,
      players: [...room.players.values()].map(player => ({ id: player.id, name: player.name, team: player.team, classId: player.loadout.classId })),
    });
  };
  const snapshots = room => {
    const events = room.game.events.splice(0);
    const base = makeSnapshot(room.game, { tick: room.tick, events });
    for (const client of room.players.values()) send(client, { ...base, playerId: client.id, session: room.session });
  };
  const chooseTeam = (room, requested) => {
    if (room.config.mode !== 'tdm') return null;
    if (requested === 'a' || requested === 'b') return requested;
    const values = [...room.players.values()];
    return values.filter(p => p.team === 'a').length <= values.filter(p => p.team === 'b').length ? 'a' : 'b';
  };
  function leave(client) {
    const room = client.room;
    if (!room) return;
    client.room = null;
    awaitJoin(client);
    room.players.delete(client.id);
    if (!room.players.size) { rooms.delete(room.code); return; }
    if (room.hostId === client.id) room.hostId = room.players.keys().next().value;
    if (room.game) {
      room.game.actors = room.game.actors.filter(actor => actor.id !== client.id);
      room.game.humanInputs.delete(client.id);
      room.game.combat.projectiles = room.game.combat.projectiles.filter(projectile => projectile.ownerId !== client.id);
      room.game.combat.fields = room.game.combat.fields.filter(field => field.ownerId !== client.id);
      room.game.player = room.game.getActor(room.hostId);
      for (const actor of room.game.actors) actor.isPlayer = actor.id === room.hostId;
    }
    lobby(room);
  }
  function start(room) {
    if (room.game && ['playing', 'countdown'].includes(room.game.match.state)) throw new Error('This match is already running.');
    const owner = room.players.get(room.hostId);
    const game = new Game({ loadout: owner.loadout });
    game.start({ ...room.config, name: owner.name, playerTeam: owner.team || 'a' }, owner.loadout);
    room.game = game;
    game.humanInputs = new Map();
    let index = room.config.botCount + 1;
    for (const client of room.players.values()) {
      const actor = client.id === room.hostId ? game.player : game.createActor(index++, false, client.loadout);
      actor.id = client.id; actor.name = client.name; actor.isHuman = true;
      actor.isPlayer = client.id === room.hostId; actor.team = client.team;
      actor.ai = {}; actor.intent = {};
      if (!actor.isPlayer) game.respawn(actor);
      client.input = {}; client.lastInputAt = 0;
      game.humanInputs.set(client.id, {});
    }
    room.tick++;
    lobby(room);
    snapshots(room);
  }
  function receive(client, raw, binary) {
    if (binary) throw new Error('Only JSON text messages are supported.');
    const now = performance.now();
    client.tokens = Math.min(160, client.tokens + (now - client.rateAt) * .12);
    client.rateAt = now;
    if (client.tokens < 1) { client.socket.close(1008, 'Message rate limit exceeded.'); return; }
    client.tokens--;
    const message = record(JSON.parse(raw.toString()), 'Message');
    if (typeof message.type !== 'string') throw new Error('Message type is required.');
    if (message.type === 'create' || message.type === 'join') {
      if (client.room) throw new Error('Leave the current room before joining another.');
      client.name = playerName(message.name);
      client.loadout = loadout(message.loadout);
      let room;
      if (message.type === 'create') {
        if (rooms.size >= maxRooms) throw new Error('The server is full. Try again later.');
        const config = matchConfig(message.config);
        let id; do { id = code(); } while (rooms.has(id));
        room = { code: id, session: randomUUID(), hostId: client.id, config, players: new Map(), game: null, tick: 0 };
        rooms.set(id, room);
      } else {
        room = rooms.get(roomCode(message.code));
        if (!room) throw new Error('Room not found. Check the code and server URL.');
        if (room.players.size >= LIMITS.humans) throw new Error('This room already has eight players.');
        if (room.game && ['playing', 'countdown'].includes(room.game.match.state)) throw new Error('This match is in progress. Join after it ends.');
        if (message.config !== undefined) record(message.config, 'Player configuration');
        if (message.config?.playerTeam !== undefined && !['a', 'b'].includes(message.config.playerTeam)) throw new Error('Invalid player team.');
      }
      client.team = chooseTeam(room, message.config?.playerTeam);
      client.room = room;
      clearTimeout(client.joinTimer);
      room.players.set(client.id, client);
      lobby(room);
    } else if (message.type === 'start') {
      if (!client.room) throw new Error('Join a room first.');
      if (client.room.hostId !== client.id) throw new Error('Only the host can start a match.');
      start(client.room);
    } else if (message.type === 'input') {
      if (!client.room?.game || !['playing', 'countdown'].includes(client.room.game.match.state)) return;
      if (!Number.isSafeInteger(message.seq) || message.seq < 0) throw new Error('Input sequence must be a nonnegative integer.');
      if (message.seq <= client.lastSeq) return;
      const next = inputState(message.input);
      // Keep button edges arriving between ticks, while using the freshest held input.
      for (const key of EDGE_KEYS) next[key] ||= client.input[key] === true;
      if (next.switchSlot === null) next.switchSlot = client.input.switchSlot ?? null;
      client.input = next; client.lastInputAt = now; client.lastSeq = message.seq;
    } else if (message.type === 'leave') {
      leave(client); send(client, { type: 'left' });
    } else throw new Error('Unknown message type. Clients may only send room actions or input.');
  }
  wss.on('connection', socket => {
    if (clients.size >= LIMITS.connections) { socket.close(1013, 'The server is full.'); return; }
    const now = performance.now();
    const client = { socket, id: randomUUID(), room: null, tokens: 160, rateAt: now, input: {}, lastInputAt: 0, lastSeq: -1, badMessages: 0, alive: true };
    clients.add(client);
    awaitJoin(client);
    socket.on('pong', () => { client.alive = true; });
    socket.on('message', (raw, binary) => {
      try { receive(client, raw, binary); }
      catch (failure) {
        error(client, failure instanceof SyntaxError ? 'Invalid JSON message.' : failure.message);
        if (++client.badMessages >= 8) socket.close(1008, 'Too many invalid messages.');
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => { clearTimeout(client.joinTimer); clients.delete(client); leave(client); });
  });
  function tick() {
    const now = performance.now();
    for (const room of rooms.values()) {
      if (!room.game) continue;
      const game = room.game, before = game.match.state;
      for (const client of room.players.values()) {
        const input = now - client.lastInputAt <= LIMITS.staleInputMs ? client.input : {};
        game.humanInputs.set(client.id, input);
      }
      game.paused = false;
      game.step(DT, game.humanInputs.get(game.player?.id) || {});
      for (const client of room.players.values()) {
        for (const key of EDGE_KEYS) client.input[key] = false;
        client.input.switchSlot = null;
      }
      room.tick++;
      if (room.tick % 4 === 0) snapshots(room);
      if (before !== game.match.state) lobby(room);
    }
  }
  await new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, host, () => { http.off('error', reject); resolve(); });
  });
  // Real elapsed time drives a fixed 60 Hz simulation; bound catch-up after stalls.
  let previous = performance.now(), accumulator = 0;
  if (autoTick) timer = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min((now - previous) / 1000, .1); previous = now;
    while (accumulator >= DT) { tick(); accumulator -= DT; }
  }, 1000 / 120);
  heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) { client.socket.terminate(); continue; }
      client.alive = false; client.socket.ping();
    }
  }, 15000);
  heartbeat.unref();
  return {
    http, wss, rooms, tick, address: http.address(),
    async close() {
      if (closing) return;
      closing = true; clearInterval(timer); clearInterval(heartbeat);
      for (const client of clients) client.socket.terminate();
      rooms.clear();
      await new Promise(resolve => wss.close(resolve));
      await new Promise(resolve => http.close(resolve));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await createGameServer({ port: Number(process.env.PORT || 8080), host: process.env.HOST || '0.0.0.0' });
  console.log(`Unfug room server listening on port ${server.address.port}. Use wss through a TLS proxy for public play.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
}
