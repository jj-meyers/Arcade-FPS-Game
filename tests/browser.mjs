import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Real browser input + deliberate scenario fixtures, not a human playtest.
const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const output = resolve('test-results'); mkdirSync(output, { recursive: true });
let server, browser, page;
const errors = [], checks = [], consoleErrors = [];
const requests = [];
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS ${name}`); }
async function waitForServer() {
  if (base.startsWith('file:')) return;
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch(base); if (response.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('Vite did not start');
}

try {
  if (!process.env.TEST_URL) {
    // Serve a fixed production build: source edits in an active session must not
    // HMR-reload the page halfway through an input scenario.
    const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio:'inherit' });
    assert.equal(build.status,0,'Production build failed');
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { stdio: ['ignore','pipe','pipe'] });
  }
  await waitForServer();
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.setDefaultTimeout(15000);
  const entry = new URL(base);
  entry.searchParams.set('debug', '');
  await page.goto(entry.href);
  await page.waitForFunction(() => !!window.__CHAOS__);

  await check('WebGL scene and complete main menu initialize', async () => {
    assert.equal(await page.locator('.hero h1').innerText().then(s=>s.includes('CHAOS')), true);
    const info = await page.evaluate(() => ({ actors: __CHAOS__.game.actors.length, canvas: document.querySelector('canvas').width, renderer: __CHAOS__.renderer.renderer.info.render.calls }));
    assert.ok(info.actors > 1 && info.canvas > 0 && info.renderer > 0);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BUTTON');
    await page.screenshot({ path: `${output}/menu.png` });
  });

  await check('All arsenal choices render; custom loadout survives reload', async () => {
    await page.locator('[data-nav="loadout"]').click();
    assert.equal(await page.locator('[data-equip]').count(), 7);
    await page.locator('[data-equip="rail"]').click();
    await page.locator('[data-slot="tactical"]').click();
    assert.equal(await page.locator('[data-equip]').count(), 3);
    await page.locator('[data-slot="lethal"]').click();
    assert.equal(await page.locator('[data-equip]').count(), 2);
    await page.locator('[data-slot="perk"]').click();
    assert.equal(await page.locator('[data-equip]').count(), 3);
    await page.locator('[data-slot="primary"]').click();
    await page.screenshot({ path: `${output}/arsenal.png` });
    await page.reload(); await page.waitForFunction(() => !!window.__CHAOS__);
    assert.equal(await page.evaluate(() => __CHAOS__.ui.loadout.primary), 'rail');
  });

  await check('Settings affect rendering/input and persist', async () => {
    await page.locator('[data-nav="settings"]').click();
    await page.locator('[data-setting="quality"]').selectOption('low');
    await page.locator('[data-setting="crosshair"]').selectOption('dot');
    for (const [key,value] of [['fov','96'],['sensitivity','1.4'],['renderScale','0.5'],['masterVolume','0.3']]) {
      await page.locator(`[data-setting="${key}"]`).evaluate((node,value) => { node.value=value; node.dispatchEvent(new Event('input',{bubbles:true})); }, value);
    }
    await page.reload(); await page.waitForFunction(() => !!window.__CHAOS__);
    const state = await page.evaluate(() => ({ fov:__CHAOS__.ui.settings.fov, sensitivity:__CHAOS__.input.settings.sensitivity, shadow:__CHAOS__.renderer.renderer.shadowMap.enabled, width:document.querySelector('canvas').width }));
    assert.equal(state.fov,96); assert.equal(state.sensitivity,1.4); assert.equal(state.shadow,false); assert.equal(state.width,720);
  });

  await check('Match settings, real click pointer lock, countdown and HUD work', async () => {
    await page.locator('.play-button').click();
    await page.locator('[data-difficulty="easy"]').click();
    await page.locator('[data-match="duration"]').selectOption('60');
    await page.locator('[data-match="scoreLimit"]').selectOption('10');
    await page.screenshot({ path: `${output}/setup.png` });
    await page.locator('[data-action="start"]').click();
    await page.waitForFunction(() => document.pointerLockElement?.id === 'game-canvas');
    assert.equal(await page.evaluate(() => __CHAOS__.game.match.state), 'countdown');
    await page.evaluate(() => { __CHAOS__.game.ai.update=()=>{}; __CHAOS__.advance(3.1); });
    assert.equal(await page.evaluate(() => __CHAOS__.game.match.state),'playing');
    assert.equal(await page.locator('[data-el="hud"]').isVisible(),true);
    assert.equal(await page.evaluate(() => __CHAOS__.game.match.difficulty),'easy');
  });

  await check('Keyboard movement, sprint, jump and relative mouse aiming reach simulation', async () => {
    const before = await page.evaluate(() => __CHAOS__.game.player.pos.z);
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(z => __CHAOS__.game.player.pos.z < z-2,before);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => __CHAOS__.game.player.pos.y > .5);
    const yaw = await page.evaluate(() => __CHAOS__.game.player.yaw);
    await page.mouse.move(810,480); await page.mouse.move(860,490);
    await page.waitForFunction(yaw => Math.abs(__CHAOS__.game.player.yaw-yaw)>.01,yaw);
    await page.waitForFunction(() => __CHAOS__.game.player.grounded);
  });

  await check('Real mouse fire eliminates a visible fixture; reload and switching work', async () => {
    await page.evaluate(() => {
      const {game:g,input}=__CHAOS__, p=g.player, b=g.actors[1];
      p.pos={x:10,y:0,z:0}; p.prevPos={...p.pos}; p.vel={x:0,y:0,z:0}; p.yaw=0;p.pitch=0;input.sync(p);
      b.pos={x:10,y:0,z:-8};b.prevPos={...b.pos};b.vel={x:0,y:0,z:0};b.alive=true;b.health=100;b.invulnerableUntil=0;
      for (const other of g.actors.slice(2)) other.pos={x:-23,y:0,z:23};
    });
    await page.mouse.down(); await page.waitForFunction(() => __CHAOS__.game.player.kills===1); await page.mouse.up();
    assert.equal(await page.evaluate(() => __CHAOS__.game.actors[1].alive),false);
    await page.screenshot({ path: `${output}/gameplay.png` });
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => __CHAOS__.game.combat.getWeaponState(__CHAOS__.game.player).reloadEnd>0);
    await page.evaluate(() => __CHAOS__.advance(2.2));
    assert.equal(await page.evaluate(() => __CHAOS__.game.combat.getWeaponState(__CHAOS__.game.player).ammo),5);
    await page.keyboard.press('Digit2'); await page.waitForFunction(() => __CHAOS__.game.player.activeSlot===1);
    assert.match(await page.locator('[data-el="weapon-name"]').innerText(),/Ding-Dong/i);
  });

  await check('Keyboard gadgets deploy, cooldown HUD updates, scoreboard opens and closes', async () => {
    await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyE');
    await page.waitForFunction(() => __CHAOS__.game.combat.fields.some(f=>f.kind==='spring'));
    await page.waitForFunction(() => __CHAOS__.game.player.gadgetReady.lethal>__CHAOS__.game.time);
    assert.notEqual(await page.locator('[data-el="tactical-cooldown"]').innerText(),'READY');
    await page.keyboard.down('Tab');
    assert.equal(await page.locator('[data-el="scoreboard"]').isVisible(),true);
    assert.equal(await page.locator('[data-el="scoreboard"] tbody tr').count(),6);
    await page.keyboard.up('Tab');
    assert.equal(await page.locator('[data-el="scoreboard"]').isVisible(),false);
  });

  await check('Death, attribution and automatic respawn reach the visible HUD', async () => {
    await page.evaluate(() => { const g=__CHAOS__.game; g.player.invulnerableUntil=0;g.damage(g.player,1000,{attackerId:g.actors[1].id,weaponId:'rail'}); });
    await page.waitForFunction(() => !__CHAOS__.game.player.alive);
    await page.evaluate(() => __CHAOS__.advance(3));
    assert.equal(await page.evaluate(() => __CHAOS__.game.player.alive),true);
    assert.equal(await page.evaluate(() => __CHAOS__.game.player.deaths),1);
    assert.equal(await page.locator('[data-el="health"]').innerText(),'100');
  });

  await check('Escape pauses simulation, resume recaptures mouse', async () => {
    await page.keyboard.press('Escape'); await page.waitForFunction(() => __CHAOS__.game.paused);
    const time = await page.evaluate(() => __CHAOS__.game.time);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => __CHAOS__.game.time),time);
    await page.locator('[data-action="resume"]').click();
    await page.waitForFunction(() => document.pointerLockElement?.id==='game-canvas' && !__CHAOS__.game.paused);
  });

  await check('Timer results, restart, and a complete twelve-bot match succeed', async () => {
    await page.evaluate(() => { __CHAOS__.game.match.remaining=.1; __CHAOS__.advance(.2); });
    assert.equal(await page.locator('[data-el="results"]').isVisible(),true);
    assert.equal(await page.locator('[data-el="results"] tbody tr').count(),6);
    await page.screenshot({ path: `${output}/results.png` });
    await page.locator('[data-el="results"] [data-action="restart"]').click();
    await page.waitForFunction(() => __CHAOS__.game.match.state==='countdown');
    assert.equal(await page.evaluate(() => __CHAOS__.game.player.kills),0);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => __CHAOS__.game.paused);
    await page.locator('[data-el="pause"] [data-action="menu"]').click();
    await page.evaluate(() => { __CHAOS__.start({botCount:12,difficulty:'hard',duration:30,scoreLimit:100}); __CHAOS__.advance(34); });
    const end = await page.evaluate(() => ({ state:__CHAOS__.game.match.state, actors:__CHAOS__.game.actors.length, kills:__CHAOS__.game.actors.reduce((s,a)=>s+a.kills,0), valid:__CHAOS__.game.actors.every(a=>Number.isFinite(a.pos.x+a.pos.y+a.pos.z)), effects:__CHAOS__.renderer.effects.length, max:__CHAOS__.renderer.maxEffects }));
    assert.equal(end.state,'ended'); assert.equal(end.actors,13); assert.ok(end.kills>0 && end.valid && end.effects<=end.max);
  });

  await check('Narrow menu is usable and corrupted preferences safely reset', async () => {
    await page.evaluate(() => localStorage.setItem('chaos-fps:preferences:v1','{broken'));
    await page.setViewportSize({ width: 390, height: 844 }); await page.reload();
    await page.waitForFunction(() => !!window.__CHAOS__);
    assert.equal(await page.evaluate(() => __CHAOS__.ui.loadout.primary),'fizz');
    assert.equal(await page.locator('.play-button').isVisible(),true);
    await page.screenshot({ path: `${output}/narrow-menu.png` });
  });

  assert.deepEqual(errors,[],`Browser exceptions: ${errors.join('; ')}`);
  assert.deepEqual(consoleErrors,[],`Browser console errors: ${consoleErrors.join('; ')}`);
  if (process.env.STANDALONE === '1') {
    const entry = new URL(base);
    assert.ok(requests.length > 0);
    assert.ok(requests.every(url => { const request = new URL(url); return request.origin === entry.origin && request.pathname === entry.pathname; }), 'Standalone game requested another resource');
  }
  writeFileSync(`${output}/browser-report.json`, JSON.stringify({ checks, errors, consoleErrors, browser:await browser.version(), standalone:process.env.STANDALONE === '1', requests:requests.length, note:'Chromium automation with software WebGL; scenario fixtures are explicitly injected for deterministic combat/lifecycle checks.' },null,2));
  console.log(`\n${checks.length} browser scenarios passed; no browser errors.`);
} catch (error) {
  await page?.screenshot({path:`${output}/failure.png`}).catch(()=>{});
  writeFileSync(`${output}/browser-failure.json`,JSON.stringify({checks,errors,consoleErrors,failure:String(error.stack)},null,2));
  console.error(error); process.exitCode=1;
} finally {
  await browser?.close(); server?.kill('SIGTERM');
}
