import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { DEFAULT_LOADOUT, WEAPONS } from '../src/data/catalog.js';
import { normalizeLoadout } from '../src/data/customization.js';

const DT = 1 / 60;
const advance = (game, seconds, input = {}) => {
  for (let frame = 0; frame < Math.round(seconds / DT); frame++) game.step(DT, input);
};
const fixture = (config = {}, loadout = DEFAULT_LOADOUT) => {
  const game = new Game({ seed: 42 });
  game.start({ botCount: 1, duration: 60, scoreLimit: 20, ...config }, loadout);
  game.ai.update = () => {};
  advance(game, 3);
  assert.equal(game.match.state, 'playing');
  return game;
};
const useOpenArena = game => {
  game.map = {
    size: 56, obstacles: [], ramps: [], pads: [],
    spawns: [{ x: -20, y: 0, z: -20 }, { x: 20, y: 0, z: 20 }, { x: 20, y: 0, z: -20 }],
  };
  game.player.pos = { x: 0, y: 0, z: 0 };
  game.actors[1].pos = { x: 0, y: 0, z: -8 };
};

test('starting a match resets actors and enforces a countdown before combat', () => {
  const game = new Game({ seed: 1 });
  assert.equal(game.match.state, 'menu');
  game.start({ botCount: 3, duration: 90, scoreLimit: 12, difficulty: 'hard' });
  assert.equal(game.actors.length, 4);
  assert.equal(new Set(game.actors.map(actor => actor.id)).size, 4);
  assert.equal(game.match.state, 'countdown');
  const position = { ...game.player.pos };
  const ammo = game.combat.getWeaponState(game.player).ammo;
  advance(game, 2, { fire: true, moveZ: 1 });
  assert.equal(game.match.state, 'countdown');
  assert.deepEqual(game.player.pos, position);
  assert.equal(game.combat.getWeaponState(game.player).ammo, ammo);
  assert.equal(game.match.remaining, 90);
  assert.equal(game.damage(game.player, 100, { attackerId: game.actors[1].id }), false);
  advance(game, 1);
  assert.equal(game.match.state, 'playing');
  assert.equal(game.events.filter(event => event.type === 'go').length, 1);
});

test('player movement follows camera yaw and pitch is clamped safely', () => {
  const game = fixture();
  useOpenArena(game);
  advance(game, 0.5, { moveZ: 1, yaw: Math.PI / 2, pitch: 10 });
  assert.ok(game.player.pos.x < -2);
  assert.ok(Math.abs(game.player.pos.z) < 1e-8);
  assert.equal(game.player.pitch, 1.48);
});

test('pause freezes countdown, movement, cooldowns and the match clock', () => {
  const game = new Game({ seed: 2 });
  game.start({ botCount: 1 });
  game.setPaused(true);
  advance(game, 1);
  assert.equal(game.time, 0);
  assert.equal(game.match.countdown, 3);
  game.setPaused(false);
  game.ai.update = () => {};
  advance(game, 3);
  const before = JSON.stringify({ actors: game.actors, match: game.match, time: game.time });
  game.setPaused(true);
  advance(game, 2, { fire: true, tactical: true, moveZ: 1 });
  assert.equal(JSON.stringify({ actors: game.actors, match: game.match, time: game.time }), before);
  game.setPaused(false);
  advance(game, 0.1);
  assert.ok(game.match.remaining < 180);
});

test('raycasts distinguish body and head hits, ignore dead actors and stop at cover', () => {
  const game = fixture();
  useOpenArena(game);
  const target = game.actors[1], dir = { x: 0, y: 0, z: -1 };
  const body = game.raycast({ x: 0, y: 0.8, z: 0 }, dir, 20, game.player.id);
  assert.equal(body.actor, target);
  assert.equal(body.headshot, false);
  const head = game.raycast({ x: 0, y: target.height * 0.82, z: 0 }, dir, 20, game.player.id);
  assert.equal(head.actor, target);
  assert.equal(head.headshot, true);
  assert.equal(game.canSee(game.player, target), true);
  game.map.obstacles.push({ id: 'solid-cover', x: 0, y: 0, z: -4, w: 2, h: 3, d: 1 });
  const blocked = game.raycast(game.eye(game.player), dir, 20, game.player.id);
  assert.equal(blocked.actor, null);
  assert.equal(blocked.obstacle.id, 'solid-cover');
  assert.equal(game.canSee(game.player, target), false);
  game.map.obstacles.length = 0;
  target.alive = false;
  assert.equal(game.raycast(game.eye(game.player), dir, 20, game.player.id), null);
  assert.equal(game.canSee(game.player, target), false);
});

test('damage grants one elimination, attributes the score and emits actual damage dealt', () => {
  const game = fixture(), victim = game.actors[1], attacker = game.player;
  assert.equal(game.damage(victim, 35, { attackerId: attacker.id, weaponId: 'fizz' }), true);
  assert.equal(victim.health, 65);
  assert.equal(victim.lastDamagedBy, attacker.id);
  assert.equal(game.damage(victim, 500, { attackerId: attacker.id, weaponId: 'rail', headshot: true }), true);
  assert.equal(victim.health, 0);
  assert.equal(victim.alive, false);
  assert.equal(victim.deaths, 1);
  assert.equal(attacker.kills, 1);
  assert.equal(game.damage(victim, 50, { attackerId: attacker.id }), false);
  assert.equal(attacker.kills, 1);
  assert.deepEqual(game.events.filter(event => event.type === 'damage').map(event => event.amount), [35, 65]);
  assert.equal(game.events.filter(event => event.type === 'eliminate').length, 1);
});

test('self-elimination counts a death without awarding a kill', () => {
  const game = fixture(), player = game.player;
  game.damage(player, 100, { attackerId: player.id, weaponId: 'cherry' });
  assert.equal(player.deaths, 1);
  assert.equal(player.kills, 0);
  assert.equal(game.match.state, 'playing');
});

test('respawn restores ammo and health, chooses a safe spawn, and protects briefly', () => {
  const game = fixture(), victim = game.actors[1];
  useOpenArena(game);
  game.player.pos = { ...game.map.spawns[0] };
  game.combat.getWeaponState(victim).ammo = 0;
  game.damage(victim, 100, { attackerId: game.player.id });
  advance(game, 2.7);
  assert.equal(victim.alive, false);
  advance(game, 0.2);
  assert.equal(victim.alive, true);
  assert.equal(victim.health, victim.maxHealth);
  assert.ok(Math.hypot(victim.pos.x - game.player.pos.x, victim.pos.z - game.player.pos.z) > 45);
  assert.equal(game.combat.getWeaponState(victim).ammo, game.combat.getWeapon(victim).magazine);
  assert.equal(victim.deaths, 1);
  assert.equal(game.damage(victim, 100, { attackerId: game.player.id }), false);
  advance(game, 1.4);
  assert.equal(game.damage(victim, 10, { attackerId: game.player.id }), true);
  assert.equal(victim.health, victim.maxHealth - 10);
});

test('heavy perk reduces incoming momentum and all impulses have bounded speed', () => {
  const game = fixture(), light = game.player, heavy = game.actors[1];
  light.equipment.perk = 'quick';
  heavy.equipment.perk = 'heavy';
  light.equipment.classId = heavy.equipment.classId = 'medic';
  light.classId = heavy.classId = 'medic';
  game.addImpulse(light, { x: 10, y: 4, z: 0 });
  game.addImpulse(heavy, { x: 10, y: 4, z: 0 });
  assert.equal(light.vel.x, 10);
  assert.equal(heavy.vel.x, 5.5);
  assert.equal(light.grounded, false);
  game.addImpulse(light, { x: 1e6, y: 1e6, z: -1e6 });
  assert.deepEqual(light.vel, { x: 32, y: 32, z: -32 });
});

test('score limit ends immediately and freezes further simulation', () => {
  const game = fixture({ scoreLimit: 1 });
  game.damage(game.actors[1], 100, { attackerId: game.player.id });
  assert.equal(game.match.state, 'ended');
  assert.equal(game.match.endReason, 'score');
  assert.equal(game.match.winnerId, game.player.id);
  const time = game.time;
  advance(game, 4, { moveZ: 1, fire: true });
  assert.equal(game.time, time);
  assert.equal(game.actors[1].alive, false);
  assert.equal(game.events.filter(event => event.type === 'matchEnd').length, 1);
});

test('time limit chooses the leader and ends once, while a restart clears scores', () => {
  const game = fixture({ duration: 30 });
  game.actors[1].kills = 2;
  advance(game, 30);
  assert.equal(game.match.state, 'ended');
  assert.equal(game.match.endReason, 'time');
  assert.equal(game.match.winnerId, game.actors[1].id);
  assert.ok(game.match.remaining >= 0 && game.match.remaining < 1e-6);
  game.start({ botCount: 2 });
  assert.equal(game.match.state, 'countdown');
  assert.equal(game.actors.length, 3);
  assert.ok(game.actors.every(actor => actor.kills === 0 && actor.deaths === 0 && actor.alive));
  assert.equal(game.time, 0);
  assert.equal(game.combat.projectiles.length, 0);
  assert.equal(game.combat.fields.length, 0);
});

test('invalid loadout IDs fall back to real, playable equipment', () => {
  const game = fixture({}, { primary: 'missing', secondary: null, tactical: 'cherry', lethal: 'bubble', perk: 'missing' });
  assert.deepEqual(game.player.equipment, normalizeLoadout(DEFAULT_LOADOUT));
  assert.equal(game.combat.getWeaponState(game.player).ammo, WEAPONS[DEFAULT_LOADOUT.primary].magazine);
});

test('seeded free-for-all runs to completion with bot combat and finite, bounded state', () => {
  const game = new Game({ seed: 2026 });
  game.start({ botCount: 6, difficulty: 'hard', duration: 30, scoreLimit: 100 });
  let botVsBotDamage = 0, shots = 0;
  for (let frame = 0; frame < 34 * 60 && game.match.state !== 'ended'; frame++) {
    game.step(DT);
    for (const event of game.events) {
      if (event.type === 'shot') shots++;
      if (event.type === 'damage' && event.actorId !== 'player' && event.attackerId && event.attackerId !== 'player' && event.attackerId !== event.actorId) botVsBotDamage++;
    }
    game.events.length = 0;
    for (const actor of game.actors) {
      for (const value of [...Object.values(actor.pos), ...Object.values(actor.vel), actor.health]) assert.ok(Number.isFinite(value));
      assert.ok(Math.abs(actor.pos.x) <= game.map.size / 2);
      assert.ok(Math.abs(actor.pos.z) <= game.map.size / 2);
      assert.ok(actor.pos.y >= 0);
      assert.ok(actor.health >= 0 && actor.health <= actor.maxHealth);
    }
    assert.ok(game.combat.projectiles.length < 250);
    assert.ok(game.combat.fields.length < 100);
  }
  assert.equal(game.match.state, 'ended');
  assert.ok(shots > 50, `expected active bots, observed ${shots} shots`);
  assert.ok(botVsBotDamage > 0, 'bots must fight each other, not only the player');
  assert.ok(game.actors.some(actor => actor.kills > 0));
  assert.equal(game.actors.reduce((sum, actor) => sum + actor.kills, 0) <= game.actors.reduce((sum, actor) => sum + actor.deaths, 0), true);
});

test('identical seeds and input reproduce the simulation', () => {
  const simulate = () => {
    const game = new Game({ seed: 9876 });
    game.start({ botCount: 3, difficulty: 'normal', duration: 30 });
    advance(game, 12);
    return {
      actors: game.actors.map(({ id, pos, vel, health, kills, deaths, inventory }) => ({ id, pos, vel, health, kills, deaths, inventory })),
      match: game.match,
      projectiles: game.combat.projectiles,
      fields: game.combat.fields,
    };
  };
  assert.deepEqual(simulate(), simulate());
});

test('respawn applies its new facing before stale pre-death look input can overwrite it', () => {
  const game = fixture();
  game.player.yaw = .123; game.player.pitch = .8;
  game.damage(game.player, 100, { attackerId: game.actors[1].id });
  game.player.respawnAt = game.time + DT;
  game.step(DT, { yaw: .123, pitch: .8 });
  assert.equal(game.player.alive, true);
  assert.equal(game.player.yaw, Math.atan2(game.player.pos.x, game.player.pos.z));
  assert.equal(game.player.pitch, 0);
});
