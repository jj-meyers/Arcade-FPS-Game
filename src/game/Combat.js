import { WEAPONS, GADGETS, PERKS, DEFAULT_LOADOUT } from '../data/catalog.js';
import { CLASSES, IMPULSE_CORES, normalizeLoadout, resolveWeapon } from '../data/customization.js';
import { rayBox, raySphere } from './math.js';

const EPS = 0.025;
const copy = (v) => ({ x: v.x, y: v.y, z: v.z });
const length = (v) => Math.hypot(v.x, v.y, v.z);
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const addScaled = (a, b, scale) => ({ x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale });
const normalize = (v) => {
  const n = length(v);
  return n > 1e-8 ? { x: v.x / n, y: v.y / n, z: v.z / n } : { x: 0, y: 0, z: -1 };
};
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const chest = (actor) => ({ x: actor.pos.x, y: actor.pos.y + actor.height * 0.52, z: actor.pos.z });
const MAX_PROJECTILES = 128;
const MAX_FIELDS = 64;
const aimDirection = (actor) => ({ x: -Math.sin(actor.yaw) * Math.cos(actor.pitch), y: Math.sin(actor.pitch), z: -Math.cos(actor.yaw) * Math.cos(actor.pitch) });

/** Finite ray/sphere intersection, including the exit when the origin is inside. */
function sphereDistance(origin, dir, center, radius, range) {
  const offset = subtract(origin, center);
  const b = dot(offset, dir);
  const c = dot(offset, offset) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const near = -b - root;
  const far = -b + root;
  const distance = near >= 0 ? near : far >= 0 ? far : null;
  return distance !== null && distance <= range ? distance : null;
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.fields = [];
    this.nextId = 1;
  }

  equip(actor) {
    actor.equipment = normalizeLoadout(actor.equipment ?? DEFAULT_LOADOUT);
    actor.classId = actor.equipment.classId;
    actor.cosmetics = actor.equipment.cosmetics;
    actor.activeSlot = 0;
    actor.inventory = {};
    for (const slot of ['primary', 'secondary']) {
      const id = actor.equipment[slot];
      const weapon = resolveWeapon(WEAPONS[id], actor.equipment, slot);
      actor.inventory[id] = { ammo: weapon.magazine, reserve: weapon.reserve, reloadEnd: 0, nextFire: 0, burstRemaining: 0, lastShotAt: -999, spinStarted: 0 };
    }
    actor.gadgetReady = {};
    for (const slot of ['tactical', 'lethal']) {
      actor.gadgetReady[slot] = this.game.time;
      actor.gadgetReady[actor.equipment[slot]] = this.game.time;
    }
    actor.abilityReady = this.game.time;
    actor.impulseCharge = 35;
    actor.impulseReady = this.game.time;
    actor.bracedUntil = actor.hasteUntil = actor.slowedUntil = 0;
  }

  getWeapon(actor) {
    const slot = actor.activeSlot === 1 ? 'secondary' : 'primary';
    return resolveWeapon(WEAPONS[actor.equipment?.[slot]] || WEAPONS.fizz, actor.equipment, slot);
  }

  getWeaponState(actor) {
    return actor.inventory?.[this.getWeapon(actor).id];
  }

  switchWeapon(actor, slot) {
    if (!actor.alive || (slot !== 0 && slot !== 1) || actor.activeSlot === slot) return false;
    const oldState = this.getWeaponState(actor);
    if (oldState) { oldState.reloadEnd = 0; oldState.burstRemaining = 0; oldState.lastShotAt = -999; }
    actor.activeSlot = slot;
    const state = this.getWeaponState(actor);
    if (state) state.nextFire = Math.max(state.nextFire, this.game.time + 0.2);
    this.game.emit({ type: 'switch', actorId: actor.id, weaponId: this.getWeapon(actor).id });
    return true;
  }

  reload(actor) {
    const weapon = this.getWeapon(actor);
    const state = this.getWeaponState(actor);
    if (!actor.alive || !state || state.reloadEnd || state.ammo >= weapon.magazine || state.reserve <= 0) return false;
    const modifier = (PERKS[actor.equipment.perk]?.reload ?? 1) * (CLASSES[actor.equipment.classId]?.reload ?? 1);
    state.burstRemaining = 0;
    state.lastShotAt = -999;
    state.reloadEnd = this.game.time + weapon.reloadTime * modifier;
    this.game.emit({ type: 'reload', actorId: actor.id, weaponId: weapon.id, duration: weapon.reloadTime * modifier });
    return true;
  }

  fire(actor, direction, alt = false) {
    const weapon = this.getWeapon(actor);
    const state = this.getWeaponState(actor);
    if (!actor.alive || !state || state.reloadEnd || state.burstRemaining > 0 || this.game.time + 1e-8 < state.nextFire) return false;
    if (state.ammo <= 0) {
      this.reload(actor);
      return false;
    }
    if (!this.shootRound(actor, weapon, state, direction, alt)) return false;
    if (weapon.burstCount) {
      state.burstRemaining = Math.min(weapon.burstCount - 1, state.ammo);
      state.burstNext = this.game.time + weapon.burstInterval * weapon.fireInterval / WEAPONS[weapon.id].fireInterval;
      state.burstAlt = alt;
    }
    return true;
  }

  shootRound(actor, weapon, state, direction, alt = false, followup = false) {
    if (weapon.kind === 'projectile' && !this.canSpawnProjectile(actor.id)) return false;
    const dir = normalize(direction);
    const origin = copy(this.game.eye(actor));
    let spin = 0;
    if (weapon.spinTime) {
      if (this.game.time - state.lastShotAt > 0.28) state.spinStarted = this.game.time;
      spin = clamp((this.game.time - state.spinStarted) / weapon.spinTime, 0, 1);
    }
    state.ammo -= 1;
    const interval = weapon.spinTime ? weapon.fireInterval + (weapon.spinInterval * weapon.fireInterval / WEAPONS[weapon.id].fireInterval - weapon.fireInterval) * spin : weapon.fireInterval;
    if (!followup) state.nextFire = this.game.time + interval;
    state.lastShotAt = this.game.time;
    // Spawn protection ends when attacking, so it cannot become a free firing window.
    actor.invulnerableUntil = Math.min(actor.invulnerableUntil ?? 0, this.game.time);
    actor.lastShotAt = this.game.time;

    if (weapon.kind === 'projectile') {
      const aim = this.spreadDirection(dir, weapon.spread);
      this.addProjectile({
        id: `projectile-${this.nextId++}`, ownerId: actor.id, weaponId: weapon.id,
        ownerTeam: actor.team ?? null,
        kind: weapon.id, color: weapon.color, pos: copy(origin),
        vel: addScaled({ x: 0, y: weapon.id === 'confetti' ? 2.2 : 0, z: 0 }, aim, weapon.speed),
        radius: weapon.radius, damage: weapon.damage, gravity: weapon.gravity,
        expires: this.game.time + weapon.lifetime, bounces: weapon.bounces, bounceCount: 0,
        restitution: weapon.restitution ?? 1, blastRadius: weapon.blastRadius ?? 0,
        knockback: weapon.knockback, lift: weapon.lift ?? 0, selfDamage: weapon.selfDamage ?? 0,
        headshotMultiplier: weapon.headshotMultiplier ?? 1, maxDistance: weapon.range, traveled: 0,
        launchSpeed: weapon.speed, slowDuration: weapon.slowDuration ?? 0,
        returnAt: weapon.returnAfter ? this.game.time + weapon.returnAfter : 0,
        returning: false, hitTargets: {},
      });
      this.game.emit({ type: 'shot', actorId: actor.id, weaponId: weapon.id, origin, point: addScaled(origin, aim, 1.5), color: weapon.color });
    } else {
      for (let pellet = 0; pellet < (weapon.pellets ?? 1); pellet += 1) {
        const aim = this.spreadDirection(dir, weapon.spread * (1 + spin * 0.8) * (alt && !weapon.pull ? 0.65 : 1));
        const hit = this.trace(origin, aim, weapon.range, actor.id);
        const point = hit?.point ?? addScaled(origin, aim, weapon.range);
        this.game.emit({ type: 'shot', actorId: actor.id, weaponId: weapon.id, origin, point, color: weapon.color, pellet });
        if (hit?.shield) {
          this.hitShield(hit.shield, weapon.damage, point);
        } else if (hit?.actor && this.enemies(actor, hit.actor)) {
          const falloff = this.falloff(weapon, hit.distance);
          const impulseScale = weapon.pull && !alt ? -weapon.knockback : weapon.knockback;
          const impulse = { x: aim.x * impulseScale, y: aim.y * impulseScale + (weapon.lift ?? 0), z: aim.z * impulseScale };
          this.game.damage(hit.actor, weapon.damage * falloff * (hit.headshot ? weapon.headshotMultiplier ?? 1 : 1), {
            attackerId: actor.id, weaponId: weapon.id, headshot: Boolean(hit.headshot), impulse,
          });
          if (weapon.chainCount) this.chain(actor, weapon, hit.actor);
        }
        if (hit) this.game.emit({ type: 'impact', point, color: weapon.color });
      }
    }

    if (weapon.selfRecoil) this.game.addImpulse(actor, { x: -dir.x * weapon.selfRecoil, y: -dir.y * weapon.selfRecoil, z: -dir.z * weapon.selfRecoil });
    return true;
  }

  spreadDirection(dir, spread) {
    if (!spread) return dir;
    // A disk in the camera's tangent plane gives consistent spread at any pitch.
    const right = normalize(Math.abs(dir.y) < 0.99 ? { x: -dir.z, y: 0, z: dir.x } : { x: 1, y: 0, z: 0 });
    const up = { x: right.y * dir.z - right.z * dir.y, y: right.z * dir.x - right.x * dir.z, z: right.x * dir.y - right.y * dir.x };
    const angle = this.game.rng() * Math.PI * 2;
    const radius = Math.sqrt(this.game.rng()) * spread;
    return normalize(addScaled(addScaled(dir, right, Math.cos(angle) * radius), up, Math.sin(angle) * radius));
  }

  falloff(weapon, distance) {
    if (distance <= weapon.falloffStart) return 1;
    const fraction = clamp((distance - weapon.falloffStart) / Math.max(1, weapon.range - weapon.falloffStart), 0, 1);
    return 1 - fraction * (1 - (weapon.minDamageScale ?? 1));
  }

  source(source) {
    if (typeof source === 'string') return this.game.getActor(source) ?? { id: source, team: null };
    if (source?.ownerId) return this.game.getActor(source.ownerId) ?? { id: source.ownerId, team: source.ownerTeam ?? null };
    return source;
  }

  enemies(source, target) {
    const owner = this.source(source);
    if (!owner || !target || owner.id === target.id) return false;
    return this.game.areEnemies ? this.game.areEnemies(owner, target) : !(owner.team && owner.team === target.team);
  }

  allied(source, target) {
    const owner = this.source(source);
    return Boolean(owner && target && (owner.id === target.id || !this.enemies(owner, target)));
  }

  canSpawnProjectile(ownerId) {
    return this.projectiles.length < MAX_PROJECTILES && this.projectiles.filter((p) => p.ownerId === ownerId).length < 16;
  }

  addProjectile(projectile) {
    if (!this.canSpawnProjectile(projectile.ownerId)) return false;
    this.projectiles.push(projectile);
    return true;
  }

  addField(field) {
    // Expiring the oldest same-owner field bounds persistence across respawns.
    const own = this.fields.filter((item) => item.ownerId === field.ownerId);
    if (own.length >= 8) this.fields.splice(this.fields.indexOf(own[0]), 1);
    if (this.fields.length >= MAX_FIELDS) this.fields.shift();
    this.fields.push(field);
  }

  boundedVelocity(velocity, maximum = 55) {
    const speed = length(velocity);
    return speed > maximum ? addScaled({ x: 0, y: 0, z: 0 }, velocity, maximum / speed) : velocity;
  }

  trace(origin, dir, range, ownerId, ignoredTargets = null, ownerSource = ownerId) {
    let hit;
    if (!ignoredTargets?.size) {
      hit = this.game.raycast(origin, dir, range, ownerId);
    } else {
      // Returning discs and chain beams can exclude already-hit actors while
      // retaining continuous cover checks along the complete remaining segment.
      hit = this.game.worldRaycast(origin, dir, range);
      for (const actor of this.game.actors) {
        if (!actor.alive || actor.id === ownerId || ignoredTargets.has(actor.id)) continue;
        const p = actor.pos, h = actor.height, r = actor.radius;
        const body = rayBox(origin, dir, { x: p.x - r, y: p.y + 0.1, z: p.z - r }, { x: p.x + r, y: p.y + h * 0.71, z: p.z + r }, range);
        const head = raySphere(origin, dir, { x: p.x, y: p.y + h * 0.82, z: p.z }, r * 0.87, range);
        for (const [test, headshot] of [[body, false], [head, true]]) if (test && (!hit || test.distance < hit.distance)) hit = { ...test, actor, headshot };
      }
    }
    for (const shield of this.fields) {
      if (shield.kind !== 'shield' || shield.expires <= this.game.time || shield.health <= 0 || !this.enemies(shield, this.source(ownerSource))) continue;
      const distance = sphereDistance(origin, dir, shield.pos, shield.radius, hit?.distance ?? range);
      if (distance === null) continue;
      const point = addScaled(origin, dir, distance);
      hit = { point, distance, normal: normalize(subtract(point, shield.pos)), shield, actor: null };
    }
    return hit;
  }

  chain(actor, weapon, initialTarget) {
    const visited = new Set([actor.id, initialTarget.id]);
    let previous = initialTarget;
    let damage = weapon.damage;
    for (let hop = 0; hop < weapon.chainCount; hop += 1) {
      const from = chest(previous);
      const candidates = this.game.actors.filter((target) => target.alive && !visited.has(target.id) && this.enemies(actor, target) && length(subtract(chest(target), from)) <= weapon.chainRange && this.clearSegment(from, chest(target)));
      candidates.sort((a, b) => length(subtract(chest(a), from)) - length(subtract(chest(b), from)));
      const target = candidates[0];
      if (!target) break;
      const offset = subtract(chest(target), from);
      const hit = this.trace(from, normalize(offset), length(offset) + target.radius, actor.id, visited);
      if (!hit) break;
      damage *= weapon.chainScale;
      this.game.emit({ type: 'shot', actorId: actor.id, weaponId: weapon.id, origin: from, point: hit.point, color: weapon.color, pellet: hop + 1, chain: true });
      if (hit.shield) { this.hitShield(hit.shield, damage, hit.point); break; }
      if (!hit.actor || !this.enemies(actor, hit.actor)) break;
      this.game.damage(hit.actor, damage, { attackerId: actor.id, weaponId: weapon.id, headshot: false });
      visited.add(hit.actor.id);
      previous = hit.actor;
    }
  }

  hitShield(shield, amount, point) {
    shield.health -= amount;
    this.game.emit({ type: 'impact', point: copy(point), color: shield.color });
    if (shield.health <= 0) {
      shield.expires = this.game.time;
      this.game.emit({ type: 'explosion', point: copy(shield.pos), radius: shield.radius, color: shield.color, harmless: true });
    }
  }

  useGadget(actor, slot, direction) {
    if (!actor.alive || (slot !== 'tactical' && slot !== 'lethal')) return false;
    const gadget = GADGETS[actor.equipment[slot]];
    if (!gadget || this.game.time < (actor.gadgetReady[slot] ?? 0)) return false;
    if (gadget.mechanic === 'grenade' && !this.canSpawnProjectile(actor.id)) return false;
    actor.gadgetReady[slot] = this.game.time + gadget.cooldown;
    actor.gadgetReady[gadget.id] = actor.gadgetReady[slot];
    if (slot === 'lethal' || gadget.mechanic === 'vortex') actor.invulnerableUntil = Math.min(actor.invulnerableUntil ?? 0, this.game.time);
    const dir = normalize(direction);
    const origin = copy(this.game.eye(actor));
    let point;
    if (gadget.mechanic === 'grenade') {
      point = copy(origin);
      this.addProjectile({
        id: `projectile-${this.nextId++}`, ownerId: actor.id, weaponId: gadget.id,
        ownerTeam: actor.team ?? null,
        kind: gadget.id, color: gadget.color, pos: point,
        vel: addScaled({ x: actor.vel.x * 0.25, y: 4, z: actor.vel.z * 0.25 }, dir, 17),
        radius: 0.18, damage: gadget.damage, gravity: 16,
        expires: this.game.time + gadget.fuse, bounces: 20, bounceCount: 0,
        restitution: 0.54, blastRadius: gadget.radius, knockback: gadget.knockback,
        lift: 2, selfDamage: 0.55, maxDistance: 100, traveled: 0,
        clusterCount: gadget.clusterCount ?? 0, launchSpeed: 17,
      });
    } else {
      point = this.placeGadget(actor, dir, gadget.mechanic === 'vortex' ? 6 : gadget.mechanic === 'shield' ? 0.7 : 1.5);
      if (gadget.mechanic === 'shield') point.y += 1.1;
      this.addField({
        id: `field-${this.nextId++}`, ownerId: actor.id, gadgetId: gadget.id,
        ownerTeam: actor.team ?? null,
        kind: gadget.mechanic, pos: point, color: gadget.color, radius: gadget.radius,
        expires: this.game.time + gadget.duration, created: this.game.time,
        health: gadget.health, armedAt: this.game.time + 0.8, touched: {},
      });
    }
    this.game.emit({ type: 'gadget', actorId: actor.id, gadgetId: gadget.id, point: copy(point) });
    return true;
  }

  useAbility(actor, direction) {
    if (!actor.alive || this.game.time < (actor.abilityReady ?? 0)) return false;
    const classId = actor.equipment.classId;
    const definition = CLASSES[classId] ?? CLASSES.runner;
    const dir = normalize(direction);
    const now = this.game.time;
    actor.abilityReady = now + definition.ability.cooldown;
    let point = copy(actor.pos);
    if (classId === 'runner') {
      const horizontal = normalize({ x: dir.x, y: 0, z: dir.z });
      this.game.addImpulse(actor, { x: horizontal.x * 17, y: 0.7, z: horizontal.z * 17 });
    } else if (classId === 'bulwark') {
      actor.bracedUntil = now + 3;
    } else if (classId === 'acrobat') {
      actor.vel.y = Math.max(0, actor.vel.y);
      this.game.addImpulse(actor, { x: 0, y: 13, z: 0 });
      actor.grounded = false;
    } else {
      const kind = classId === 'medic' ? 'heal' : classId === 'engineer' ? 'supply' : 'dampen';
      point = this.placeGadget(actor, dir, kind === 'dampen' ? 4 : 1);
      this.addField({
        id: `field-${this.nextId++}`, ownerId: actor.id, ownerTeam: actor.team ?? null,
        kind, pos: point, radius: kind === 'dampen' ? 5 : 4.3, color: definition.color,
        expires: now + (kind === 'supply' ? 7 : kind === 'heal' ? 6 : 5), created: now,
        touched: {}, resources: kind === 'supply' ? 140 : undefined,
      });
      if (kind === 'dampen') actor.invulnerableUntil = Math.min(actor.invulnerableUntil ?? 0, now);
    }
    this.game.emit({ type: 'ability', actorId: actor.id, classId, point: copy(point), color: definition.color });
    return true;
  }

  useImpulse(actor, direction) {
    const now = this.game.time;
    if (!actor.alive || (actor.impulseCharge ?? 0) < 100 || now < (actor.impulseReady ?? 0)) return false;
    actor.impulseCharge = 0;
    actor.impulseReady = now + 0.4;
    actor.invulnerableUntil = Math.min(actor.invulnerableUntil ?? 0, now);
    const core = IMPULSE_CORES[actor.equipment.impulseCore] ? actor.equipment.impulseCore : 'repel';
    const origin = copy(this.game.eye(actor));
    const directionUnit = normalize(direction);
    const inCone = (point) => {
      const offset = subtract(point, origin), distance = length(offset);
      return distance <= 8 && (distance < 0.25 || dot(normalize(offset), directionUnit) >= 0.5) && this.clearSegment(origin, point);
    };
    const force = (point) => {
      const outward = normalize(subtract(point, origin));
      if (core === 'lift') return { x: outward.x * 3, y: 13, z: outward.z * 3 };
      const strength = core === 'pull' ? -10 : 12;
      return { x: outward.x * strength, y: core === 'pull' ? 2 : 3, z: outward.z * strength };
    };
    for (const target of this.game.actors) {
      if (!target.alive || !this.enemies(actor, target) || now < (target.invulnerableUntil ?? 0) || !inCone(chest(target))) continue;
      this.game.addImpulse(target, force(chest(target)), actor.id);
    }
    for (const projectile of this.projectiles) {
      if (!this.enemies(actor, this.source(projectile)) || !inCone(projectile.pos)) continue;
      // The shooter keeps ownership and kill credit after a deflection.
      projectile.vel = this.boundedVelocity(addScaled(projectile.vel, force(projectile.pos), 2.2));
    }
    this.game.emit({ type: 'impulse', actorId: actor.id, core, point: origin, direction: directionUnit, radius: 8, color: IMPULSE_CORES[core].color });
    return true;
  }

  placeGadget(actor, dir, distance) {
    const horizontal = normalize({ x: dir.x, y: 0, z: dir.z });
    const origin = { x: actor.pos.x, y: actor.pos.y + 0.2, z: actor.pos.z };
    const hit = this.game.worldRaycast(origin, horizontal, distance + 0.2);
    const point = addScaled(origin, horizontal, hit ? Math.max(0, hit.distance - 0.35) : distance);
    point.y = this.game.groundHeight(point.x, point.z) + 0.06;
    return point;
  }

  /** Environmental occlusion is shared by blasts, traps and gravity fields. */
  clearSegment(a, b) {
    const delta = subtract(b, a);
    const distance = length(delta);
    if (distance < 0.05) return true;
    const obstruction = this.game.worldRaycast(a, normalize(delta), distance);
    return !obstruction || obstruction.distance >= distance - 0.05;
  }

  splash(point, options) {
    const radius = options.blastRadius;
    this.game.emit({ type: 'explosion', point: copy(point), radius, color: options.color });
    // Snapshot shields for this explosion: a single blast cannot damage a bubble
    // once per protected player, nor leak through because actor iteration broke it.
    const shields = this.fields.filter((field) => field.kind === 'shield' && field.health > 0 && field.expires > this.game.time && this.enemies(field, this.source(options)));
    const absorbed = new Map();
    for (const actor of this.game.actors) {
      if (!actor.alive || (actor.id !== options.ownerId && !this.enemies(options, actor))) continue;
      const center = chest(actor);
      const offset = subtract(center, point);
      const distance = length(offset);
      if (distance > radius + actor.radius || !this.clearSegment(point, center)) continue;
      let shielded = false;
      for (const shield of shields) {
        const rayDistance = sphereDistance(point, normalize(offset), shield.pos, shield.radius, distance);
        if (rayDistance === null) continue;
        absorbed.set(shield, addScaled(point, normalize(offset), rayDistance));
        shielded = true;
        break;
      }
      if (shielded) continue;
      const self = actor.id === options.ownerId;
      const power = 1 - clamp(distance / radius, 0, 1) * 0.78;
      const direction = normalize(offset);
      this.game.damage(actor, options.damage * power * (self ? options.selfDamage ?? 0.55 : 1), {
        attackerId: options.ownerId, weaponId: options.weaponId, headshot: false,
        impulse: { x: direction.x * options.knockback * power, y: Math.max(0.25, direction.y) * options.knockback * power + (options.lift ?? 0), z: direction.z * options.knockback * power },
      });
    }
    for (const [shield, contact] of absorbed) this.hitShield(shield, options.damage * 0.65, contact);
  }

  update(dt) {
    const now = this.game.time;
    for (const actor of this.game.actors) {
      if (!actor.alive) {
        for (const state of Object.values(actor.inventory ?? {})) { state.reloadEnd = 0; state.burstRemaining = 0; }
        continue;
      }
      for (const [id, state] of Object.entries(actor.inventory ?? {})) {
        const slot = actor.equipment.primary === id ? 'primary' : 'secondary';
        const weapon = resolveWeapon(WEAPONS[id], actor.equipment, slot);
        if (state.reloadEnd && state.reloadEnd <= now + 1e-8) {
          const amount = Math.max(0, Math.min(weapon.magazine - state.ammo, state.reserve));
          state.ammo += amount;
          state.reserve -= amount;
          state.reloadEnd = 0;
        }
        if (state.burstRemaining > 0 && state.burstNext <= now + 1e-8) {
          if (state.reloadEnd || state.ammo <= 0 || this.getWeapon(actor).id !== id) { state.burstRemaining = 0; continue; }
          this.shootRound(actor, weapon, state, aimDirection(actor), state.burstAlt, true);
          state.burstRemaining -= 1;
          state.burstNext = now + weapon.burstInterval * weapon.fireInterval / WEAPONS[id].fireInterval;
        }
      }
    }
    this.updateFields(dt);
    // Newly split submunitions join next frame, never recursively simulate now.
    const currentProjectiles = this.projectiles;
    this.projectiles = [];
    for (const projectile of currentProjectiles) {
      if (this.updateProjectile(projectile, dt)) this.addProjectile(projectile);
    }
    this.fields = this.fields.filter((field) => field.expires > now && (field.health === undefined || field.health > 0));
  }

  updateFields(dt) {
    for (const field of this.fields) {
      if (field.expires <= this.game.time) continue;
      const gadget = GADGETS[field.gadgetId];
      if (field.kind === 'shield') continue;
      for (const actor of this.game.actors) {
        if (!actor.alive) continue;
        const offset = subtract(field.pos, actor.pos);
        const horizontal = Math.hypot(offset.x, offset.z);
        if (field.kind === 'spring') {
          // FFA springs are shared toys; team springs never launch an enemy or
          // unexpectedly disrupt an ally unless that ally steps onto the pad.
          if (this.source(field)?.team && !this.allied(field, actor)) continue;
          if (horizontal > field.radius + actor.radius || actor.pos.y < field.pos.y - 0.5 || actor.pos.y > field.pos.y + 0.75 || (field.touched[actor.id] ?? -Infinity) > this.game.time) continue;
          field.touched[actor.id] = this.game.time + 0.85;
          actor.vel.y = Math.max(0, actor.vel.y);
          this.game.addImpulse(actor, { x: 0, y: gadget.launch, z: 0 });
          actor.grounded = false;
          this.game.emit({ type: 'gadget', actorId: actor.id, gadgetId: gadget.id, point: copy(actor.pos), triggered: true });
        } else if (field.kind === 'trap') {
          if (!this.enemies(field, actor) || this.game.time < field.armedAt || horizontal > field.radius + actor.radius || Math.abs(offset.y) > 1.8 || !this.clearSegment(addScaled(field.pos, { x: 0, y: 1, z: 0 }, 0.15), chest(actor))) continue;
          field.expires = this.game.time;
          this.splash(addScaled(field.pos, { x: 0, y: 1, z: 0 }, 0.25), {
            ownerId: field.ownerId, ownerTeam: field.ownerTeam, weaponId: gadget.id, color: gadget.color,
            damage: gadget.damage, blastRadius: gadget.blastRadius, knockback: gadget.knockback, lift: gadget.lift, selfDamage: 0.55,
          });
          break;
        } else if (field.kind === 'vortex' || field.kind === 'repulsor') {
          const center = addScaled(field.pos, { x: 0, y: 1, z: 0 }, 1.1);
          const pull = subtract(center, chest(actor));
          const distance = length(pull);
          if (!this.enemies(field, actor) || distance > field.radius || this.game.time < (actor.invulnerableUntil ?? 0) || !this.clearSegment(center, chest(actor))) continue;
          const force = gadget.force * (1 - distance / field.radius) * dt;
          const dir = normalize(pull);
          const sign = field.kind === 'repulsor' ? -1 : 1;
          this.game.addImpulse(actor, { x: dir.x * force * sign, y: Math.max(0, dir.y) * force * 0.5, z: dir.z * force * sign }, field.ownerId);
        } else {
          const center = addScaled(field.pos, { x: 0, y: 1, z: 0 }, 0.8);
          if (length(subtract(center, chest(actor))) > field.radius || !this.clearSegment(center, chest(actor))) continue;
          if (field.kind === 'dampen') {
            if (this.enemies(field, actor) && this.game.time >= (actor.invulnerableUntil ?? 0)) actor.slowedUntil = Math.max(actor.slowedUntil ?? 0, this.game.time + 0.2);
            continue;
          }
          if (!this.allied(field, actor)) continue;
          if (field.kind === 'heal') actor.health = Math.min(actor.maxHealth, actor.health + 8 * dt);
          if (field.kind === 'booster') actor.hasteUntil = Math.max(actor.hasteUntil ?? 0, this.game.time + 1);
          if (field.kind === 'supply' && field.resources > 0) {
            for (const slot of ['primary', 'secondary']) {
              const id = actor.equipment[slot];
              const weapon = resolveWeapon(WEAPONS[id], actor.equipment, slot);
              const state = actor.inventory[id];
              if (!state || state.reserve >= weapon.reserve) continue;
              const key = `${actor.id}:${id}`;
              field.touched[key] = (field.touched[key] ?? 0) + Math.max(1, weapon.magazine * 0.2) * dt;
              const rounds = Math.min(Math.floor(field.touched[key]), weapon.reserve - state.reserve, field.resources);
              state.reserve += rounds;
              field.resources -= rounds;
              field.touched[key] -= rounds;
            }
          }
        }
      }
    }
  }

  finishProjectile(projectile) {
    if (projectile.clusterCount) {
      const count = Math.min(3, projectile.clusterCount);
      const angleStart = this.game.rng() * Math.PI * 2;
      for (let i = 0; i < count; i += 1) {
        const angle = angleStart + i * Math.PI * 2 / count;
        this.addProjectile({
          ...projectile, id: `projectile-${this.nextId++}`, kind: 'cluster',
          clusterCount: 0, pos: copy(projectile.pos), radius: 0.13,
          vel: { x: Math.cos(angle) * 7, y: 5.5, z: Math.sin(angle) * 7 },
          expires: this.game.time + 0.65 + i * 0.08, bounces: 8,
          bounceCount: 0, traveled: 0, maxDistance: 25, launchSpeed: 9,
        });
      }
      this.game.emit({ type: 'explosion', point: copy(projectile.pos), radius: 1.3, color: projectile.color, harmless: true });
    } else if (projectile.blastRadius) this.splash(projectile.pos, projectile);
  }

  updateProjectile(projectile, dt) {
    if (projectile.expires <= this.game.time || projectile.traveled >= projectile.maxDistance) {
      this.finishProjectile(projectile);
      return false;
    }
    if (projectile.returnAt && this.game.time >= projectile.returnAt) {
      projectile.returning = true;
      const owner = this.game.getActor(projectile.ownerId);
      if (!owner?.alive) return false;
      const home = subtract(chest(owner), projectile.pos);
      if (length(home) < 0.8) return false;
      const targetVelocity = addScaled({ x: 0, y: 0, z: 0 }, normalize(home), projectile.launchSpeed * 1.2);
      // Bounded steering preserves a pulse's deflection instead of immediately
      // overwriting it with perfect homing on the next simulation tick.
      projectile.vel = addScaled(projectile.vel, subtract(targetVelocity, projectile.vel), Math.min(1, dt * 4.5));
    }
    for (const field of this.fields) {
      if (!['vortex', 'repulsor', 'dampen'].includes(field.kind) || field.expires <= this.game.time) continue;
      if (!(field.kind === 'vortex' && field.ownerId === projectile.ownerId) && !this.enemies(field, this.source(projectile))) continue;
      const center = addScaled(field.pos, { x: 0, y: 1, z: 0 }, 1.1);
      const offset = subtract(center, projectile.pos);
      const distance = length(offset);
      if (distance >= field.radius || !this.clearSegment(center, projectile.pos)) continue;
      if (field.kind === 'dampen') {
        const speed = length(projectile.vel);
        const retained = Math.max(Math.min(speed, (projectile.launchSpeed ?? 17) * 0.2), speed * Math.exp(-2.5 * dt));
        if (speed > 0.001) projectile.vel = addScaled({ x: 0, y: 0, z: 0 }, projectile.vel, retained / speed);
      } else if (field.kind === 'repulsor') {
        const outward = normalize(subtract(projectile.pos, center));
        const incoming = dot(projectile.vel, outward);
        if (incoming < 0) projectile.vel = this.boundedVelocity(addScaled(projectile.vel, outward, -2 * incoming + 3));
      } else {
        const pull = normalize(offset);
        const force = 30 * (1 - distance / field.radius) * dt;
        projectile.vel = this.boundedVelocity(addScaled(projectile.vel, pull, force));
      }
    }
    projectile.vel.y -= projectile.gravity * dt;
    let remaining = dt;
    for (let collision = 0; collision < 4 && remaining > 0.00001; collision += 1) {
      const speed = length(projectile.vel);
      if (speed < 0.01) break;
      const dir = normalize(projectile.vel);
      const distance = speed * remaining;
      const leg = projectile.returning ? 2 : 1;
      const ignoredTargets = projectile.returnAt ? new Set(Object.entries(projectile.hitTargets).filter(([, mask]) => mask & leg).map(([id]) => id)) : null;
      const hit = this.trace(projectile.pos, dir, distance + projectile.radius, projectile.ownerId, ignoredTargets, projectile);
      if (!hit) {
        projectile.pos = addScaled(projectile.pos, dir, distance);
        projectile.traveled += distance;
        break;
      }
      const travel = Math.max(0, hit.distance - projectile.radius);
      projectile.pos = addScaled(projectile.pos, dir, travel);
      projectile.traveled += travel;
      remaining = Math.max(0, remaining - travel / speed);
      if (hit.shield) {
        this.hitShield(hit.shield, projectile.damage, hit.point);
        return false;
      }
      if (hit.actor) {
        if (projectile.returnAt) projectile.hitTargets[hit.actor.id] = (projectile.hitTargets[hit.actor.id] ?? 0) | leg;
        if (projectile.blastRadius) {
          this.finishProjectile(projectile);
        } else if (this.enemies(projectile, hit.actor)) {
          const damaged = this.game.damage(hit.actor, projectile.damage * (hit.headshot ? projectile.headshotMultiplier : 1), {
            attackerId: projectile.ownerId, weaponId: projectile.weaponId, headshot: Boolean(hit.headshot),
            impulse: { x: dir.x * projectile.knockback, y: dir.y * projectile.knockback + projectile.lift, z: dir.z * projectile.knockback },
          });
          if (damaged && projectile.slowDuration) hit.actor.slowedUntil = Math.max(hit.actor.slowedUntil ?? 0, this.game.time + projectile.slowDuration);
          this.game.emit({ type: 'impact', point: hit.point, color: projectile.color });
        }
        if (projectile.returnAt) { remaining = Math.max(0, remaining - 0.00001); continue; }
        return false;
      }
      this.game.emit({ type: 'impact', point: hit.point, color: projectile.color });
      if (projectile.bounces <= 0) {
        if (projectile.returnAt && !projectile.returning) {
          projectile.returnAt = this.game.time;
          projectile.returning = true;
          projectile.pos = addScaled(hit.point, hit.normal, projectile.radius + EPS);
          projectile.vel = addScaled({ x: 0, y: 0, z: 0 }, hit.normal, projectile.launchSpeed);
          break;
        }
        this.finishProjectile(projectile);
        return false;
      }
      projectile.bounces -= 1;
      projectile.bounceCount += 1;
      const normal = hit.normal ?? { x: 0, y: 1, z: 0 };
      const towardSurface = dot(projectile.vel, normal);
      projectile.vel = {
        x: (projectile.vel.x - 2 * towardSurface * normal.x) * projectile.restitution,
        y: (projectile.vel.y - 2 * towardSurface * normal.y) * projectile.restitution,
        z: (projectile.vel.z - 2 * towardSurface * normal.z) * projectile.restitution,
      };
      projectile.pos = addScaled(hit.point, normal, projectile.radius + EPS);
      if (projectile.kind === 'bankshot') projectile.damage *= WEAPONS.bankshot.bounceDamage;
      // Rest low-energy grenades on the floor; their fuse keeps running.
      if (normal.y > 0.7 && Math.abs(projectile.vel.y) < 1.2 && projectile.blastRadius) {
        projectile.vel.y = 0;
        projectile.vel.x *= 0.82;
        projectile.vel.z *= 0.82;
        remaining = 0;
      }
    }
    return true;
  }
}

export default Combat;
