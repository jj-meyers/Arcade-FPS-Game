import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { DEFAULT_LOADOUT, GADGETS, WEAPONS } from '../src/data/catalog.js';

function arena(primary = 'fizz', extras = {}) {
  const game = new Game({ seed: 717 });
  game.start({ botCount: 1, scoreLimit: 100 }, { ...DEFAULT_LOADOUT, primary, perk: 'quick', classId: 'medic', ...extras });
  game.time = 10;
  game.match.state = 'playing';
  game.map = { size: 56, obstacles: [], ramps: [], spawns: [], pads: [] };
  game.ai.update = () => {};
  const player = game.player;
  const target = game.actors[1];
  // Isolate weapon mechanics from randomized class/perk impulse resistance.
  target.equipment.classId = 'medic'; target.classId = 'medic';
  target.equipment.perk = 'quick'; game.combat.equip(target);
  player.pos = { x: 0, y: 0, z: 0 };
  target.pos = { x: 0, y: 0, z: -10 };
  player.invulnerableUntil = target.invulnerableUntil = 0;
  return { game, player, target, combat: game.combat };
}
const forward = { x: 0, y: 0, z: -1 };
function tickCombat(game, seconds) {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += 1 / 60) {
    game.time += 1 / 60;
    game.combat.update(1 / 60);
  }
}

test('fire cadence consumes one round; quick reload transfers exactly from reserve', () => {
  const { game, player, combat } = arena();
  const state = combat.getWeaponState(player);
  assert.equal(combat.fire(player, forward), true);
  assert.equal(combat.fire(player, forward), false);
  assert.equal(state.ammo, WEAPONS.fizz.magazine - 1);
  state.ammo = 3;
  state.reserve = 8;
  assert.equal(combat.reload(player), true);
  assert.ok(Math.abs(state.reloadEnd - game.time - WEAPONS.fizz.reloadTime * 0.7) < 1e-8);
  assert.equal(combat.fire(player, forward), false);
  tickCombat(game, 1.1);
  assert.equal(state.ammo, 11);
  assert.equal(state.reserve, 0);
  assert.equal(state.reloadEnd, 0);
});

test('switching cancels an unfinished reload and preserves ammo; dead actors cannot attack', () => {
  const { game, player, combat } = arena();
  const original = combat.getWeaponState(player);
  original.ammo = 0;
  combat.reload(player);
  assert.equal(combat.switchWeapon(player, 1), true);
  tickCombat(game, 3);
  assert.equal(original.ammo, 0);
  assert.equal(original.reloadEnd, 0);
  player.alive = false;
  assert.equal(combat.fire(player, forward), false);
  assert.equal(combat.reload(player), false);
  assert.equal(combat.useGadget(player, 'lethal', forward), false);
});

test('a high-speed projectile sweeps through the whole frame and ignores its owner', () => {
  const { game, player, target, combat } = arena('updraft');
  target.pos.z = -2;
  combat.fire(player, forward);
  const projectile = combat.projectiles[0];
  projectile.vel = { x: 0, y: 0, z: -400 };
  projectile.pos.y = 0.9;
  tickCombat(game, 1 / 60);
  assert.ok(target.health < 100);
  assert.ok(target.vel.y > 9);
  assert.equal(player.health, 100);
  assert.equal(combat.projectiles.length, 0);
});

test('bankshots ricochet from real cover, gaining damage without crossing its surface', () => {
  const { game, player, target, combat } = arena('bankshot');
  target.pos.x = 20;
  game.map.obstacles.push({ id: 'wall', x: 0, y: 0, z: -3, w: 10, h: 4, d: 0.2 });
  combat.fire(player, forward);
  const projectile = combat.projectiles[0];
  projectile.vel.x = projectile.vel.y = 0;
  tickCombat(game, 0.1);
  assert.equal(projectile.bounceCount, 1);
  assert.ok(projectile.vel.z > 0);
  assert.ok(projectile.damage > WEAPONS.bankshot.damage);
  assert.ok(projectile.pos.z > -2.9);
});

test('blast damage and knockback cannot pass through solid cover', () => {
  const { game, player, target, combat } = arena();
  player.pos.x = 20;
  target.pos = { x: 0, y: 0, z: -3 };
  game.map.obstacles.push({ id: 'wall', x: 0, y: 0, z: -1.5, w: 4, h: 4, d: 0.4 });
  const blast = { ownerId: player.id, weaponId: 'cherry', color: '#fff', blastRadius: 6, damage: 90, knockback: 12 };
  combat.splash({ x: 0, y: 1, z: 0 }, blast);
  assert.equal(target.health, 100);
  assert.equal(target.vel.z, 0);
  game.map.obstacles.length = 0;
  combat.splash({ x: 0, y: 1, z: 0 }, blast);
  assert.ok(target.health < 100);
  assert.ok(target.vel.z < 0);
});

test('bubble absorbs incoming hitscan and projectiles, while owner shots leave it', () => {
  const { game, player, target, combat } = arena('rail', { tactical: 'bubble' });
  combat.useGadget(player, 'tactical', forward);
  const shield = combat.fields[0];
  target.equipment.primary = 'updraft';
  combat.equip(target);
  combat.fire(target, { x: 0, y: 0, z: 1 });
  tickCombat(game, 0.2);
  assert.equal(player.health, 100);
  assert.ok(shield.health < GADGETS.bubble.health);
  assert.equal(combat.projectiles.length, 0);
  target.equipment.primary = 'rail';
  combat.equip(target);
  const healthBeforeHitscan = shield.health;
  combat.fire(target, { x: 0, y: 0, z: 1 });
  assert.equal(player.health, 100);
  assert.ok(shield.health < healthBeforeHitscan);
  assert.equal(combat.fire(player, forward), true);
  assert.ok(target.health < 100);
});

test('a shield absorbs one blast consistently for multiple enclosed actors', () => {
  const { game, player, target, combat } = arena('fizz', { tactical: 'bubble' });
  combat.useGadget(player, 'tactical', forward);
  const shield = combat.fields[0];
  target.pos = { x: 0.4, y: 0, z: 0 };
  const shieldHealth = shield.health;
  combat.splash({ x: 0, y: 1, z: -4.5 }, {
    ownerId: 'distant-enemy', weaponId: 'cherry', color: '#fff', blastRadius: 6, damage: 90, knockback: 12,
  });
  assert.equal(player.health, 100);
  assert.equal(target.health, 100);
  assert.equal(shield.health, shieldHealth - 90 * 0.65);
});

test('yoink alternate fire reverses the direction of its knockback', () => {
  const { game, player, target, combat } = arena('yoink');
  combat.fire(player, forward, false);
  assert.ok(target.vel.z > 0, 'primary fire reels victim toward shooter');
  target.vel.z = 0;
  tickCombat(game, 0.45);
  combat.fire(player, forward, true);
  assert.ok(target.vel.z < 0, 'alternate fire pushes victim away');
});

test('spring pads launch nearby actors and enforce per-actor and gadget cooldowns', () => {
  const { game, player, combat } = arena();
  assert.equal(combat.useGadget(player, 'tactical', forward), true);
  assert.equal(combat.useGadget(player, 'tactical', forward), false);
  const pad = combat.fields[0];
  player.pos = { x: pad.pos.x, y: 0, z: pad.pos.z };
  tickCombat(game, 1 / 60);
  assert.ok(player.vel.y > 13);
  const launchVelocity = player.vel.y;
  tickCombat(game, 1 / 60);
  assert.equal(player.vel.y, launchVelocity);
});

test('vortex curves flying projectiles and pulls exposed rivals', () => {
  const { game, player, target, combat } = arena('bankshot', { tactical: 'vortex' });
  combat.useGadget(player, 'tactical', forward);
  const field = combat.fields[0];
  target.pos = { x: 2, y: 0, z: field.pos.z };
  combat.fire(player, forward);
  const projectile = combat.projectiles[0];
  projectile.pos = { x: 1, y: 1.1, z: field.pos.z + 1 };
  projectile.vel = { x: 0, y: 0, z: -10 };
  tickCombat(game, 1 / 60);
  assert.ok(projectile.vel.x < 0);
  assert.ok(target.vel.x < 0);
});

test('whoopee trap arms before triggering and does not trigger on its owner', () => {
  const { game, player, target, combat } = arena('fizz', { lethal: 'whoopee' });
  combat.useGadget(player, 'lethal', forward);
  const trap = combat.fields[0];
  player.pos = { ...trap.pos, y: 0 };
  tickCombat(game, 0.9);
  assert.equal(combat.fields.length, 1);
  target.pos = { ...trap.pos, y: 0 };
  tickCombat(game, 1 / 60);
  assert.equal(combat.fields.length, 0);
  assert.ok(target.health < 100);
  assert.ok(target.vel.y > 10);
});

test('grenades expire on their fuse and spawn protection ends on an attack', () => {
  const { game, player, target, combat } = arena();
  target.pos.x = 25;
  player.invulnerableUntil = game.time + 5;
  combat.useGadget(player, 'lethal', forward);
  assert.equal(player.invulnerableUntil, game.time);
  assert.equal(combat.projectiles.length, 1);
  tickCombat(game, 1.7);
  assert.equal(combat.projectiles.length, 0);
  assert.ok(game.events.some((event) => event.type === 'explosion'));
});
