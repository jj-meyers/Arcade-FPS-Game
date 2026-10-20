import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { DEFAULT_LOADOUT } from '../src/data/catalog.js';
import { CLASSES, IMPULSE_CORES, normalizeLoadout } from '../src/data/customization.js';

const DT = 1 / 60;
const forward = { x: 0, y: 0, z: -1 };
const advance = (game, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) game.step(DT, input);
};
const tickCombat = (game, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) { game.time += DT; game.combat.update(DT); }
};
function encounter(loadout = {}, config = {}) {
  const game = new Game({ seed: 835 });
  game.start({ mode: 'ffa', botCount: 3, scoreLimit: 100, duration: 90, ...config }, { ...DEFAULT_LOADOUT, classId: 'medic', perk: 'quick', ...loadout });
  game.time = 10; game.match.state = 'playing'; game.ai.update = () => {};
  game.map = { size: 56, obstacles: [], ramps: [], pads: [], spawns: [{ x: -20, y: 0, z: -20 }, { x: 20, y: 0, z: 20 }] };
  game.actors.forEach((actor, i) => {
    actor.pos = { x: i < 2 ? 0 : 18, y: 0, z: i ? -5 - i : 0 };
    actor.prevPos = { ...actor.pos }; actor.vel = { x: 0, y: 0, z: 0 };
    actor.invulnerableUntil = 0;
    if (!actor.isPlayer) {
      actor.equipment = normalizeLoadout({ ...actor.equipment, classId: 'medic', perk: 'quick' });
      game.combat.equip(actor);
    }
  });
  return { game, player: game.player, target: game.actors[1], ally: game.actors[2], other: game.actors[3], combat: game.combat };
}

test('zero-bot practice and all four difficulties are accepted without hidden stat boosts', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'veteran']) {
    const game = new Game({ seed: 4 });
    game.start({ difficulty, botCount: 0, mode: 'ffa' });
    assert.equal(game.match.difficulty, difficulty);
    assert.equal(game.actors.length, 1);
    assert.equal(game.player.maxHealth, 100);
    game.start({ difficulty, botCount: 6, botClasses: ['bulwark', 'acrobat'] });
    assert.equal(game.actors.length, 7);
    assert.ok(game.actors.every(actor => actor.maxHealth === 100));
    assert.ok(game.actors.slice(1).every(actor => ['bulwark', 'acrobat'].includes(actor.equipment.classId)));
  }
});

test('full bot rosters use every class evenly and mirror the composition between teams', () => {
  const game = new Game({ seed: 4 });
  game.start({ botCount: 12, mode: 'ffa' });
  for (const id of Object.keys(CLASSES)) assert.equal(game.actors.filter(actor => !actor.isPlayer && actor.classId === id).length, 2);
  game.start({ botCount: 12, mode: 'tdm', playerTeam: 'b' });
  assert.equal(new Set(game.actors.map(actor => `${actor.pos.x}:${actor.pos.y}:${actor.pos.z}`)).size,13,'all thirteen actors need distinct starting positions');
  for (const team of ['a', 'b']) for (const id of Object.keys(CLASSES)) {
    assert.equal(game.actors.filter(actor => !actor.isPlayer && actor.team === team && actor.classId === id).length, 1);
  }
});

test('TDM assigns teams, rejects friendly damage/impulse and awards only hostile eliminations', () => {
  const { game, player, target, ally } = encounter({}, { mode: 'tdm', playerTeam: 'b', scoreLimit: 2 });
  assert.equal(player.team, 'b');
  assert.ok(game.actors.every(actor => ['a', 'b'].includes(actor.team)));
  target.team = 'a'; ally.team = 'b';
  assert.equal(game.areEnemies(player, ally), false);
  assert.equal(game.areEnemies(player, target), true);
  assert.equal(game.damage(ally, 100, { attackerId: player.id, impulse: { x: 10, y: 5, z: 0 } }), false);
  assert.equal(ally.health, 100);
  assert.deepEqual(ally.vel, { x: 0, y: 0, z: 0 });
  game.damage(target, 100, { attackerId: player.id });
  assert.equal(game.match.teamScores.b, 1);
  assert.equal(player.kills, 1);
  game.respawn(target); target.invulnerableUntil = 0;
  game.damage(target, 100, { attackerId: player.id });
  assert.equal(game.match.state, 'ended');
  assert.equal(game.match.winnerTeam, 'b');
  assert.equal(game.match.endReason, 'score');
});

test('team timer results use team scores and permit a draw', () => {
  for (const [scores, winner] of [[{ a: 3, b: 1 }, 'a'], [{ a: 2, b: 2 }, null]]) {
    const { game } = encounter({}, { mode: 'tdm' });
    game.match.teamScores = scores;
    game.match.remaining = DT;
    game.step(DT);
    assert.equal(game.match.state, 'ended');
    assert.equal(game.match.endReason, 'time');
    assert.equal(game.match.winnerTeam, winner);
  }
});

test('damaging an enemy grants an assist when a teammate completes the elimination', () => {
  const { game, player, target, ally } = encounter({}, { mode: 'tdm' });
  player.team = ally.team = 'a'; target.team = 'b';
  game.damage(target, 30, { attackerId: player.id });
  game.damage(target, 100, { attackerId: ally.id });
  assert.equal(player.kills, 0);
  assert.equal(player.assists, 1);
  assert.equal(ally.kills, 1);
  assert.equal(game.match.teamScores.a, 1);
  assert.ok(game.events.some(event => event.type === 'assist' && event.actorId === player.id));
});

test('small fresh hits cannot renew old damage into an assist, even with periodic refreshes', () => {
  for (const delays of [[7], [5, 5, 5]]) {
    const { game, player, target, ally } = encounter({}, { mode: 'tdm' });
    player.team = ally.team = 'a'; target.team = 'b';
    game.damage(target, 20, { attackerId: player.id });
    for (const delay of delays) {
      game.time += delay;
      game.damage(target, 1, { attackerId: player.id });
    }
    game.damage(target, 100, { attackerId: ally.id });
    assert.equal(player.assists, 0);
    assert.equal(ally.kills, 1);
    assert.equal(game.events.filter(event => event.type === 'assist').length,0);
  }
});

test('a full twenty-actor roster can respawn clear of allies when every authored spawn is occupied', () => {
  const game = new Game({ seed: 35 });
  game.start({ botCount: 12, mode: 'tdm' });
  for (let i = 13; i < 20; i++) game.createActor(i, false, DEFAULT_LOADOUT);
  const others = game.actors.filter(actor => actor !== game.player);
  others.forEach((actor, i) => { actor.pos={...game.map.spawns[i%game.map.spawns.length]};actor.team='a'; });
  game.player.team='a'; game.player.alive=false;
  game.respawn(game.player);
  assert.ok(others.every(actor => Math.hypot(actor.pos.x-game.player.pos.x,actor.pos.y-game.player.pos.y,actor.pos.z-game.player.pos.z)>=1.2));
  assert.ok(Math.abs(game.player.pos.x)<=28-game.player.radius && Math.abs(game.player.pos.z)<=28-game.player.radius);
  assert.ok(!game.map.obstacles.some(box=>Math.abs(game.player.pos.x-box.x)<box.w/2+game.player.radius && Math.abs(game.player.pos.z-box.z)<box.d/2+game.player.radius && game.player.pos.y<box.y+box.h));
});

test('Impulse charges through movement, respects the rate cap, and cannot be farmed while stationary or paused', () => {
  const { game, player } = encounter();
  const charge = player.impulseCharge;
  advance(game, 1);
  assert.equal(player.impulseCharge, charge);
  advance(game, 1, { moveX: 1, sprint: true });
  assert.ok(player.impulseCharge > charge + 5);
  assert.ok(player.impulseCharge <= charge + 10.01);
  game.setPaused(true);
  const pausedCharge = player.impulseCharge;
  advance(game, 2, { moveX: 1, sprint: true });
  assert.equal(player.impulseCharge, pausedCharge);
  game.setPaused(false);
  player.vel = { x: 0, y: 0, z: 0 };
  player.pos = { x: -24, y: 0, z: 20 };
  game.step(DT);
  assert.ok(player.impulseCharge <= pausedCharge + 10 * DT + 1e-6, 'teleports may not award distance charge');
});

test('nondamaging enemy impulses grant bounded charge without self or teammate farming', () => {
  const { game, player, target, ally } = encounter({}, { mode: 'tdm' });
  player.team = ally.team = 'a'; target.team = 'b';
  player.impulseCharge = 0;
  const push = { x: 3, y: 0, z: 0 };
  game.addImpulse(player, push, player.id);
  game.addImpulse(player, push, ally.id);
  assert.equal(player.impulseCharge, 0);
  game.addImpulse(player, push, target.id);
  assert.equal(player.impulseCharge, 8);
  for (let i = 0; i < 20; i++) game.addImpulse(player, push, target.id);
  assert.equal(player.impulseCharge, 8);
  game.time += 1.1;
  game.addImpulse(player, push, target.id);
  assert.equal(player.impulseCharge, 16);
  player.impulseCharge = 98; game.time += 1.1;
  game.addImpulse(player, push, target.id);
  assert.equal(player.impulseCharge, 100);
});

test('Impulse requires full charge and pushes only visible enemies within its cone', () => {
  const { game, player, target, ally, other, combat } = encounter({}, { mode: 'tdm' });
  player.team = ally.team = 'a'; target.team = other.team = 'b';
  target.pos = { x: 0, y: 0, z: -4 };
  ally.pos = { x: 0.5, y: 0, z: -4 };
  other.pos = { x: 0, y: 0, z: 4 };
  player.impulseCharge = 99;
  assert.equal(combat.useImpulse(player, forward), false);
  player.impulseCharge = 100;
  assert.equal(combat.useImpulse(player, forward), true);
  assert.equal(player.impulseCharge, 0);
  assert.ok(target.vel.z < -8 && target.vel.y > 0);
  assert.equal(target.health, 100);
  assert.deepEqual(ally.vel, { x: 0, y: 0, z: 0 });
  assert.deepEqual(other.vel, { x: 0, y: 0, z: 0 });
  assert.equal(combat.useImpulse(player, forward), false);
  assert.ok(game.events.some(event => event.type === 'impulse' && event.core === 'repel'));
});

test('all Impulse cores have different motion, while solid cover blocks them', () => {
  for (const core of Object.keys(IMPULSE_CORES)) {
    const { game, player, target, combat } = encounter({ impulseCore: core });
    target.pos.z = -4; player.impulseCharge = 100;
    assert.equal(combat.useImpulse(player, forward), true);
    if (core === 'pull') assert.ok(target.vel.z > 5);
    if (core === 'repel') assert.ok(target.vel.z < -8);
    if (core === 'lift') assert.ok(target.vel.y > 10);
    target.vel = { x: 0, y: 0, z: 0 };
    game.time += 1; player.impulseCharge = 100;
    game.map.obstacles.push({ id: 'block', x: 0, y: 0, z: -2, w: 4, h: 4, d: 0.3 });
    combat.useImpulse(player, forward);
    assert.deepEqual(target.vel, { x: 0, y: 0, z: 0 });
  }
});

test('Impulse redirects a hostile projectile without changing ownership or creating unbounded speed', () => {
  const { player, target, combat } = encounter();
  target.equipment.primary = 'bankshot'; combat.equip(target);
  combat.fire(target, { x: 0, y: 0, z: 1 });
  const projectile = combat.projectiles[0];
  projectile.pos = { x: 0, y: 1.3, z: -3 };
  projectile.vel = { x: 0, y: 0, z: 20 };
  const owner = projectile.ownerId;
  player.impulseCharge = 100;
  combat.useImpulse(player, forward);
  assert.ok(projectile.vel.z < 20);
  assert.ok(Math.hypot(projectile.vel.x, projectile.vel.y, projectile.vel.z) <= 55.00001);
  assert.equal(projectile.ownerId, owner);
});

test('Bulwark brace reduces damage temporarily and enforces its ability cooldown', () => {
  const { game, player, target, combat } = encounter({ classId: 'bulwark' });
  assert.equal(combat.useAbility(player, forward), true);
  assert.equal(combat.useAbility(player, forward), false);
  game.damage(player, 20, { attackerId: target.id });
  assert.equal(player.health, 87);
  tickCombat(game, 3.1);
  game.damage(player, 20, { attackerId: target.id });
  assert.equal(player.health, 67);
  assert.ok(player.abilityReady > game.time);
});

test('Medic support heals its team but never enemies or past maximum health', () => {
  const { game, player, target, ally, combat } = encounter({ classId: 'medic' }, { mode: 'tdm' });
  player.team = ally.team = 'a'; target.team = 'b';
  player.health = ally.health = target.health = 60;
  assert.equal(combat.useAbility(player, forward), true);
  const field = combat.fields.find(item => item.kind === 'heal');
  assert.ok(field);
  for (const actor of [player, target, ally]) actor.pos = { ...field.pos, y: 0 };
  tickCombat(game, 2);
  assert.ok(player.health > 60 && ally.health > 60);
  assert.equal(target.health, 60);
  tickCombat(game, 10);
  assert.ok(player.health <= 100 && ally.health <= 100);
  assert.ok(!combat.fields.some(item => item.kind === 'heal'));
});

test('Engineer support restores finite ammo reserves to teammates only', () => {
  const { game, player, target, ally, combat } = encounter({ classId: 'engineer' }, { mode: 'tdm' });
  player.team = ally.team = 'a'; target.team = 'b';
  assert.equal(combat.useAbility(player, forward), true);
  const field = combat.fields.find(item => item.kind === 'supply');
  assert.ok(field);
  for (const actor of [player, target, ally]) {
    actor.pos = { ...field.pos, y: 0 };
    combat.getWeaponState(actor).reserve = 0;
  }
  tickCombat(game, 2);
  assert.ok(combat.getWeaponState(player).reserve > 0);
  assert.ok(combat.getWeaponState(ally).reserve > 0);
  assert.equal(combat.getWeaponState(target).reserve, 0);
  tickCombat(game, 30);
  assert.ok(!combat.fields.some(item => item.kind === 'supply'));
  assert.ok(combat.getWeaponState(player).reserve <= combat.getWeapon(player).reserve);
});

test('Runner dash respects cover and Acrobat launch works while airborne', () => {
  const dash = encounter({ classId: 'runner' });
  dash.game.map.obstacles.push({ id: 'wall', x: 0, y: 0, z: -2, w: 8, h: 5, d: 0.2 });
  assert.equal(dash.combat.useAbility(dash.player, forward), true);
  advance(dash.game, 0.3, { moveZ: 1 });
  assert.ok(dash.player.pos.z >= -1.9 + dash.player.radius - 1e-6);
  const launch = encounter({ classId: 'acrobat' });
  launch.player.grounded = false; launch.player.pos.y = 3; launch.player.vel.y = -5;
  assert.equal(launch.combat.useAbility(launch.player, forward), true);
  assert.ok(launch.player.vel.y > 4);
});

test('classes and cosmetics retain equal health and collision dimensions', () => {
  for (const classId of Object.keys(CLASSES)) {
    const { player } = encounter({ classId, cosmetics: { bodyColor: 'coral', hat: 'crown', back: 'coil' } });
    assert.equal(player.maxHealth, 100);
    assert.equal(player.radius, .45);
    assert.equal(player.height, 1.8);
    assert.equal(player.cosmetics.hat, 'crown');
    assert.equal(player.equipment.classId, classId);
  }
});
