import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOADOUT, WEAPONS } from '../src/data/catalog.js';
import {
  CLASSES, IMPULSE_CORES, COSMETICS, DEFAULT_CUSTOMIZATION,
  TUNING_BUDGET, normalizeLoadout, normalizeCosmetics, resolveWeapon,
  movementModifiers, tuningCost,
} from '../src/data/customization.js';

test('old loadouts migrate to valid classes, Impulse cores and cosmetic defaults', () => {
  const migrated = normalizeLoadout(DEFAULT_LOADOUT);
  for (const key of ['primary', 'secondary', 'tactical', 'lethal', 'perk']) assert.equal(migrated[key], DEFAULT_LOADOUT[key]);
  assert.ok(CLASSES[migrated.classId]);
  assert.ok(IMPULSE_CORES[migrated.impulseCore]);
  assert.deepEqual(migrated.cosmetics, DEFAULT_CUSTOMIZATION);
  assert.equal(tuningCost(migrated.mods.primary), 0);
  assert.equal(tuningCost(migrated.mods.secondary), 0);
});

test('malformed or unknown customization cannot inject arbitrary gameplay values', () => {
  const bad = { primary: '__proto__', secondary: 'not-a-weapon', classId: 'god', impulseCore: 'teleport', tactical: 'cherry', lethal: 'bubble', health: 10000,
    cosmetics: { bodyColor: '#ffffff', hat: '<script>', back: {} }, mods: { primary: { barrel: '__proto__', magazine: 'infinity', handling: 'teleport' } }, finishes: { primary: 'url(bad)' } };
  const normalized = normalizeLoadout(bad);
  assert.equal(normalized.health, undefined);
  assert.equal(normalized.primary, DEFAULT_LOADOUT.primary);
  assert.equal(normalized.tactical, DEFAULT_LOADOUT.tactical);
  assert.equal(normalized.lethal, DEFAULT_LOADOUT.lethal);
  assert.deepEqual(normalized.cosmetics, DEFAULT_CUSTOMIZATION);
  assert.equal(normalized.finishes.primary, 'factory');
  assert.equal(tuningCost(normalized.mods.primary), 0);
  assert.deepEqual(normalizeLoadout(null), normalizeLoadout({}));
  assert.deepEqual(normalizeCosmetics([]), DEFAULT_CUSTOMIZATION);
});

test('each weapon tuning budget is enforced without mutating saved input', () => {
  const source = { ...DEFAULT_LOADOUT, mods: {
    primary: { barrel: 'impact', magazine: 'extended', handling: 'rapid' },
    secondary: { barrel: 'compact', magazine: 'reserve', handling: 'light' },
  } };
  const original = structuredClone(source);
  const normalized = normalizeLoadout(source);
  assert.ok(tuningCost(normalized.mods.primary) <= TUNING_BUDGET);
  assert.deepEqual(normalized.mods.secondary, original.mods.secondary, 'an affordable independent secondary build must survive');
  assert.deepEqual(source, original);
  normalized.mods.secondary.barrel = 'standard';
  assert.equal(source.mods.secondary.barrel, 'compact');
});

test('barrel and magazine tuning changes real gun stats with their stated tradeoffs', () => {
  const compact = normalizeLoadout({ ...DEFAULT_LOADOUT, mods: { primary: { barrel: 'compact', magazine: 'extended' } } });
  const base = { ...WEAPONS.fizz };
  const tuned = resolveWeapon(WEAPONS.fizz, compact);
  assert.ok(tuned.fireInterval < base.fireInterval);
  assert.ok(tuned.damage < base.damage);
  assert.ok(tuned.magazine > base.magazine);
  assert.ok(tuned.reloadTime > base.reloadTime);
  assert.deepEqual(WEAPONS.fizz, base, 'catalog definitions must not be mutated');
  const precise = resolveWeapon(WEAPONS.fizz, normalizeLoadout({ ...DEFAULT_LOADOUT, mods: { primary: { barrel: 'precision' } } }));
  assert.ok(precise.spread < base.spread);
  assert.ok(precise.fireInterval > base.fireInterval);
});

test('active handling and class traits affect movement, with temporary statuses expiring', () => {
  const equipment = normalizeLoadout({ ...DEFAULT_LOADOUT, classId: 'acrobat', perk: 'quick', mods: { primary: { handling: 'light' }, secondary: { handling: 'steady' } } });
  const actor = { equipment, activeSlot: 0 };
  const light = movementModifiers(actor, 10);
  actor.activeSlot = 1;
  const steady = movementModifiers(actor, 10);
  assert.ok(light.moveSpeed > steady.moveSpeed);
  assert.ok(light.jump > 1 && light.airControl > 1);
  actor.slowedUntil = 12;
  assert.ok(movementModifiers(actor, 11).moveSpeed < steady.moveSpeed);
  assert.equal(movementModifiers(actor, 13).moveSpeed, steady.moveSpeed);
  actor.hasteUntil = 15;
  assert.ok(movementModifiers(actor, 14).moveSpeed > steady.moveSpeed);
});

test('cosmetic colors and every attachment normalize independently of weapon mechanics', () => {
  const standard = normalizeLoadout(DEFAULT_LOADOUT);
  const colored = normalizeLoadout({ ...DEFAULT_LOADOUT, cosmetics: {
    bodyColor: 'coral', accentColor: 'violet', hat: 'crown', face: 'visor', back: 'coil', pattern: 'dots',
  }, finishes: { primary: 'mono', secondary: 'amber' } });
  assert.deepEqual(resolveWeapon(WEAPONS.fizz, colored), resolveWeapon(WEAPONS.fizz, standard));
  assert.deepEqual(movementModifiers({ equipment: colored, activeSlot: 0 }), movementModifiers({ equipment: standard, activeSlot: 0 }));
  for (const [key, value] of Object.entries(colored.cosmetics)) assert.ok(Object.hasOwn(COSMETICS[key], value));
  assert.equal(colored.cosmetics.hat, 'crown');
  assert.equal(colored.finishes.primary, 'mono');
});
