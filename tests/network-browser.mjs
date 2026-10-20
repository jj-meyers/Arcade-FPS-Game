import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createGameServer } from '../server/index.js';

const port = Number(process.env.NETWORK_BROWSER_PORT || 5178);
const base = process.env.TEST_URL || `http://127.0.0.1:${port}`;
const errors = [], checks = [];
let preview, browser, server;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 150; i++) { if (await check()) return; await delay(100); }
  throw new Error(`Timed out: ${message}`);
}
async function check(label, action) {
  await action(); checks.push(label); console.log(`PASS ${label}`);
}
try {
  if (!process.env.TEST_URL) {
    const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' });
    assert.equal(build.status, 0, 'Production build failed.');
    preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
  await until(async () => { try { return (await fetch(base)).ok; } catch { return false; } }, 'browser build server');
  server = await createGameServer({ host: '127.0.0.1', port: 0 });
  const url = `ws://127.0.0.1:${server.address.port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 1200, height: 800 } }), browser.newContext({ viewport: { width: 1200, height: 800 } })]);
  const pages = [];
  for (const [index, context] of contexts.entries()) {
    await context.addInitScript(index => localStorage.setItem('unfug:preferences:v2', JSON.stringify({
      settings: { quality: 'low', shadows: false, renderScale: .5, effects: 'low', reducedMotion: true, masterVolume: 0 },
      matchConfig: { botCount: 0, mode: 'tdm', playerTeam: index ? 'b' : 'a', scoreLimit: 10, duration: 180, name: index ? 'Browser Guest' : 'Browser Host' },
      loadout: { primary: 'rail', classId: index ? 'acrobat' : 'bulwark' },
    })), index);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/?debug`);
    await page.waitForFunction(() => Boolean(window.__UNFUG__));
    pages.push(page);
  }
  const [host, guest] = pages;
  let code, room, hostId, guestId;
  await check('two independent browser sessions create and join a real room through visible UI', async () => {
    await host.bringToFront();
    await host.locator('.top-online').click();
    await host.locator('[data-network="url"]').fill(url);
    await host.locator('[data-action="create-room"]').click();
    await host.waitForFunction(() => __UNFUG__.network.connected);
    code = await host.locator('[aria-label="Room code"]').inputValue();
    assert.match(code, /^[A-Z2-9]{6}$/);
    await guest.bringToFront();
    await guest.locator('.top-online').click();
    await guest.locator('[data-network="url"]').fill(url);
    await guest.locator('[data-network="code"]').fill(code);
    await guest.locator('[data-action="join-room"]').click();
    await guest.waitForFunction(() => __UNFUG__.network.connected);
    await host.waitForFunction(() => __UNFUG__.network.lobby.players.length === 2);
    assert.equal(await guest.locator('.lobby-player').count(), 2);
    hostId = await host.evaluate(() => __UNFUG__.network.playerId);
    guestId = await guest.evaluate(() => __UNFUG__.network.playerId);
    room = server.rooms.get(code);
    assert.equal(room.players.size, 2);
    assert.notEqual(hostId, guestId);
  });
  await check('host starts; guest resumes with pointer lock while server advances for both clients', async () => {
    await host.bringToFront();
    await host.locator('[data-action="network-start"]').click();
    await host.waitForFunction(() => __UNFUG__.game.match.state === 'playing');
    await guest.waitForFunction(() => __UNFUG__.game.match.state === 'playing');
    await guest.bringToFront();
    await guest.locator('[data-action="resume"]').click();
    await guest.waitForFunction(() => document.pointerLockElement?.id === 'game-canvas');
    assert.equal(await guest.locator('[data-el="hud"]').isVisible(), true);
    assert.equal(await guest.evaluate(() => __UNFUG__.game.player.id), guestId);
    assert.equal(await guest.evaluate(() => __UNFUG__.game.actors.filter(actor => actor.isHuman).length), 2);
    assert.ok(await guest.evaluate(id => __UNFUG__.renderer.actorMeshes.has(id), hostId));
    const time = room.game.time;
    await delay(250);
    assert.ok(room.game.time > time + .1);
  });
  await check('real guest keyboard movement arrives on server and the host snapshot', async () => {
    const actor = room.game.getActor(guestId);
    actor.pos = { x: -5, y: 0, z: -23 }; actor.prevPos = { ...actor.pos }; actor.vel = { x: 0, y: 0, z: 0 };
    await guest.evaluate(() => { __UNFUG__.input.yaw = 0; __UNFUG__.input.pitch = 0; });
    await guest.keyboard.down('KeyD');
    await until(() => actor.pos.x > -4.5, 'authoritative guest movement');
    await guest.keyboard.up('KeyD');
    await host.waitForFunction(id => __UNFUG__.game.actors.find(actor => actor.id === id).pos.x > -4.5, guestId);
    assert.ok(actor.pos.x < 2, 'movement obeys authoritative speed limits');
  });
  await check('real guest mouse fire produces shared damage, team score and results', async () => {
    const shooter = room.game.getActor(guestId), victim = room.game.getActor(hostId);
    Object.assign(shooter, { pos: { x: -5, y: 0, z: -23 }, vel: { x: 0, y: 0, z: 0 }, invulnerableUntil: 0 });
    Object.assign(victim, { pos: { x: 5, y: 0, z: -23 }, vel: { x: 0, y: 0, z: 0 }, invulnerableUntil: 0 });
    room.game.match.scoreLimit = 1;
    await guest.evaluate(() => { __UNFUG__.input.yaw = -Math.PI / 2; __UNFUG__.input.pitch = -.0144; });
    await delay(100);
    await guest.mouse.down();
    await guest.waitForFunction(() => __UNFUG__.game.match.state === 'ended');
    await guest.mouse.up();
    await host.waitForFunction(() => __UNFUG__.game.match.state === 'ended');
    assert.equal(room.game.getActor(guestId).kills, 1);
    assert.equal(room.game.match.teamScores.b, 1);
    assert.equal(await host.evaluate(() => __UNFUG__.game.player.health), 0);
    assert.equal(await guest.evaluate(() => __UNFUG__.game.player.kills), 1);
    assert.equal(await guest.locator('[data-el="results"]').isVisible(), true);
    assert.equal(await host.locator('[data-el="results"]').isVisible(), true);
    mkdirSync('test-results', { recursive: true });
    await guest.screenshot({ path: 'test-results/network-results.png' });
  });
  await check('late join after results can inherit hosting and start a real rematch', async () => {
    await guest.locator('[data-el="results"] [data-action="network-leave"]').click();
    await until(() => room.players.size === 1, 'guest disconnect cleanup');
    assert.equal(room.game.getActor(guestId), undefined);
    await guest.locator('.top-online').click();
    await guest.locator('[data-network="url"]').fill(url);
    await guest.locator('[data-network="code"]').fill(code);
    await guest.locator('[data-action="join-room"]').click();
    await guest.waitForFunction(() => __UNFUG__.network.connected && __UNFUG__.ui.view === 'lobby');
    const rejoinedId = await guest.evaluate(() => __UNFUG__.network.playerId);
    assert.notEqual(rejoinedId, guestId);
    await host.bringToFront();
    await host.locator('[data-el="results"] [data-action="network-leave"]').click();
    await guest.waitForFunction(() => __UNFUG__.network.lobby.isHost);
    assert.equal(room.hostId, rejoinedId);
    await guest.bringToFront();
    await guest.locator('[data-action="network-start"]:visible').click();
    await guest.waitForFunction(() => __UNFUG__.game.match.state === 'playing');
    assert.equal(room.game.player.id, rejoinedId);
    assert.equal(room.game.actors.length, 1);
  });
  await check('disconnect cleans the room and missing room displays a real error', async () => {
    await guest.keyboard.press('Escape');
    await guest.locator('[data-el="pause"] [data-action="network-leave"]').click();
    await until(() => server.rooms.size === 0, 'room cleanup');
    await host.bringToFront();
    await host.locator('.top-online').click();
    await host.locator('[data-network="url"]').fill(url);
    await host.locator('[data-network="code"]').fill('ZZZZZZ');
    await host.locator('[data-action="join-room"]').click();
    await host.waitForFunction(() => __UNFUG__.ui.networkError);
    assert.match(await host.locator('[data-network-status]').innerText(), /Room not found/);
    assert.equal(await host.evaluate(() => __UNFUG__.network.connected), false);
  });
  assert.deepEqual(errors, []);
  writeFileSync('test-results/network-browser.json', JSON.stringify({ checks, errors, transport: 'real local WebSockets', browsers: 2, prediction: false }, null, 2));
  console.log(`${checks.length} multiplayer browser checks passed.`);
} finally {
  await browser?.close();
  await server?.close();
  preview?.kill('SIGTERM');
}
