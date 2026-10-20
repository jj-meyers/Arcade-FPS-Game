import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { DEFAULT_LOADOUT, WEAPONS } from '../src/data/catalog.js';
import { movementModifiers } from '../src/data/customization.js';

const dir = { x: 0, y: 0, z: -1 };
function fixture(primary, extras = {}, mode = 'ffa') {
  const game = new Game({ seed: 173 });
  game.start({ botCount: 3, scoreLimit: 100, mode }, { ...DEFAULT_LOADOUT, primary, classId: 'medic', perk: 'quick', ...extras });
  game.match.state = 'playing'; game.time = 10; game.ai.update = () => {};
  game.map = { size: 56, obstacles: [], ramps: [], spawns: [{ x: 0, y: 0, z: 20 }], pads: [] };
  game.actors.forEach((actor, i) => {
    actor.pos = { x: i < 2 ? 0 : 20, y: 0, z: i ? -6 : 0 };
    actor.invulnerableUntil = 0;
    if (i) { actor.equipment.classId = 'medic'; actor.equipment.perk = 'quick'; game.combat.equip(actor); }
  });
  return { game, player: game.player, target: game.actors[1], other: game.actors[2], third: game.actors[3], combat: game.combat };
}
function tick(game, seconds, fire = false) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.time += 1 / 60;
    if (fire) game.combat.fire(game.player, dir);
    game.combat.update(1 / 60);
  }
}

test('Burst Stapler delivers three timed rounds and switching interrupts the remaining burst', () => {
  const { game, player, combat } = fixture('burst');
  const state = combat.getWeaponState(player), full = state.ammo;
  assert.equal(combat.fire(player, dir), true);
  assert.equal(state.ammo, full - 1);
  assert.equal(combat.fire(player, dir), false);
  tick(game, .25);
  const shots = game.events.filter(event => event.type === 'shot' && event.actorId === player.id);
  assert.equal(shots.length, 3);
  assert.equal(state.ammo, full - 3);
  assert.ok(shots[1].time - shots[0].time >= .08);
  assert.ok(shots[2].time - shots[1].time >= .08);
  tick(game, .3); combat.fire(player, dir); combat.switchWeapon(player, 1);
  const ammoBefore = state.ammo;
  tick(game, .3);
  assert.equal(state.ammo, ammoBefore);
});

test('Spool ramps its firing cadence only during sustained fire and resets after a break', () => {
  const { game, player, target, combat } = fixture('spool'); target.pos.x = 20;
  combat.fire(player, dir); tick(game, 1.5, true);
  const shots = game.events.filter(event => event.type === 'shot' && event.actorId === player.id);
  assert.ok(shots.length > 12);
  const early = shots[1].time - shots[0].time;
  const late = shots.at(-1).time - shots.at(-2).time;
  assert.ok(late < early * .6, `early=${early} late=${late}`);
  tick(game, .4);
  assert.equal(combat.fire(player, dir), true);
  assert.ok(Math.abs(combat.getWeaponState(player).nextFire - game.time - WEAPONS.spool.fireInterval) < 1e-8);
});

test('Tack applies damage and a temporary movement slow that expires', () => {
  const { game, player, target, combat } = fixture('tack');
  const normal = movementModifiers(target, game.time).moveSpeed;
  combat.fire(player, dir); tick(game, .3);
  assert.ok(target.health < 100);
  assert.ok(target.slowedUntil > game.time);
  assert.ok(movementModifiers(target, game.time).moveSpeed < normal);
  tick(game, 2);
  assert.equal(movementModifiers(target, game.time).moveSpeed, normal);
});

test('Return Disc can hit once on each leg without repeatedly damaging an intersected actor', () => {
  const { game, player, target, combat } = fixture('disc');
  combat.fire(player, dir); tick(game, .4);
  assert.equal(game.events.filter(event => event.type === 'damage' && event.actorId === target.id).length, 1);
  tick(game, 1.4);
  const hits = game.events.filter(event => event.type === 'damage' && event.actorId === target.id);
  assert.equal(hits.length, 2);
  assert.equal(target.health, 100 - 2 * WEAPONS.disc.damage);
  assert.equal(combat.projectiles.length, 0);
});

test('Arc chains between nearby enemies, but walls and allied targets break propagation', () => {
  for (const blocked of [false, true]) {
    const { game, player, target, other, third, combat } = fixture('arc', {}, 'tdm');
    player.team = third.team = 'a'; target.team = other.team = 'b';
    other.pos = { x: 3, y: 0, z: -6 }; third.pos = { x: -2, y: 0, z: -6 };
    if (blocked) game.map.obstacles.push({ id: 'chain-cover', x: 1.5, y: 0, z: -6, w: .2, h: 4, d: 4 });
    combat.fire(player, dir);
    assert.ok(target.health < 100);
    assert.equal(third.health, 100);
    if (blocked) assert.equal(other.health, 100);
    else assert.ok(other.health < 100 && other.health > target.health);
  }
});

test('Rush Pad grants temporary speed to teammates; Disruptor field slows only enemies', () => {
  const { game, player, target, other, combat } = fixture('fizz', { tactical: 'booster', classId: 'disruptor' }, 'tdm');
  player.team = other.team = 'a'; target.team = 'b';
  combat.useGadget(player, 'tactical', dir);
  const pad = combat.fields.find(field => field.kind === 'booster');
  for (const actor of [player, target, other]) actor.pos = { ...pad.pos, y: 0 };
  tick(game, .1);
  assert.ok(player.hasteUntil > game.time && other.hasteUntil > game.time);
  assert.ok(!(target.hasteUntil > game.time));
  combat.useAbility(player, dir);
  const slow = combat.fields.find(field => field.kind === 'dampen');
  for (const actor of [player, target, other]) actor.pos = { ...slow.pos, y: 0 };
  tick(game, .1);
  assert.ok(target.slowedUntil > game.time);
  assert.ok(!(other.slowedUntil > game.time));
  tick(game, 8);
  assert.ok(player.hasteUntil < game.time && target.slowedUntil < game.time);
});

test('Repulsor deflects hostile projectiles and actors while leaving teammates alone', () => {
  const { game, player, target, other, combat } = fixture('fizz', { tactical: 'repulsor' }, 'tdm');
  player.team = other.team = 'a'; target.team = 'b';
  combat.useGadget(player, 'tactical', dir);
  const field = combat.fields.find(item => item.kind === 'repulsor');
  target.pos = { x: field.pos.x + 2, y: 0, z: field.pos.z };
  other.pos = { x: field.pos.x - 2, y: 0, z: field.pos.z };
  target.equipment.primary = 'bankshot'; combat.equip(target); combat.fire(target, { x: -1, y: 0, z: 0 });
  const projectile = combat.projectiles[0];
  projectile.pos = { x: field.pos.x + 1, y: .5, z: field.pos.z };
  projectile.vel = { x: -10, y: 0, z: 0 };
  tick(game, 1 / 60);
  assert.ok(projectile.vel.x > -10);
  assert.ok(target.vel.x > 0);
  assert.equal(other.vel.x, 0);
  assert.equal(projectile.ownerId, target.id);
});

test('Cherry Trio creates exactly three finite submunitions and eventually clears them', () => {
  const { game, player, target, combat } = fixture('fizz', { lethal: 'cluster' });
  target.pos.x = 20;
  combat.useGadget(player, 'lethal', dir);
  assert.equal(combat.projectiles.length, 1);
  tick(game, .95);
  assert.equal(combat.projectiles.length, 3);
  assert.ok(combat.projectiles.every(projectile => !projectile.clusterCount && projectile.ownerId === player.id));
  tick(game, 3);
  assert.equal(combat.projectiles.length, 0);
  assert.equal(game.events.filter(event => event.type === 'explosion' && !event.harmless).length, 3);
  assert.equal(game.events.filter(event => event.type === 'explosion' && event.harmless).length, 1);
});

test('repeated equipment activation is bounded across respawn-like cooldown resets', () => {
  const { game, player, target, combat } = fixture('bankshot', { tactical: 'springpad' });
  target.pos.x = 20;
  const state = combat.getWeaponState(player); state.ammo = 100;
  for (let i = 0; i < 50; i++) {
    game.time += 1; state.nextFire = 0; player.gadgetReady.tactical = 0;
    combat.fire(player, dir); combat.useGadget(player, 'tactical', dir);
  }
  assert.ok(combat.projectiles.length <= 16);
  assert.ok(combat.fields.length <= 8);
  assert.ok(state.ammo >= 84, 'rejected projectile spawns must not consume ammo');
});
