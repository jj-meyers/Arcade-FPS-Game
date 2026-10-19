import { WEAPONS, GADGETS, PERKS, DEFAULT_LOADOUT } from '../data/catalog.js';

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
    actor.equipment = { ...DEFAULT_LOADOUT, ...actor.equipment };
    for (const slot of ['primary', 'secondary']) {
      if (!WEAPONS[actor.equipment[slot]]) actor.equipment[slot] = DEFAULT_LOADOUT[slot];
    }
    for (const slot of ['tactical', 'lethal']) {
      if (GADGETS[actor.equipment[slot]]?.slot !== slot) actor.equipment[slot] = DEFAULT_LOADOUT[slot];
    }
    if (!PERKS[actor.equipment.perk]) actor.equipment.perk = DEFAULT_LOADOUT.perk;
    actor.activeSlot = 0;
    actor.inventory = {};
    for (const id of [actor.equipment.primary, actor.equipment.secondary]) {
      const weapon = WEAPONS[id];
      actor.inventory[id] = { ammo: weapon.magazine, reserve: weapon.reserve, reloadEnd: 0, nextFire: 0 };
    }
    actor.gadgetReady = {};
    for (const slot of ['tactical', 'lethal']) {
      actor.gadgetReady[slot] = this.game.time;
      actor.gadgetReady[actor.equipment[slot]] = this.game.time;
    }
  }

  getWeapon(actor) {
    return WEAPONS[actor.equipment?.[actor.activeSlot === 1 ? 'secondary' : 'primary']] || WEAPONS.fizz;
  }

  getWeaponState(actor) {
    return actor.inventory?.[this.getWeapon(actor).id];
  }

  switchWeapon(actor, slot) {
    if (!actor.alive || (slot !== 0 && slot !== 1) || actor.activeSlot === slot) return false;
    const oldState = this.getWeaponState(actor);
    if (oldState) oldState.reloadEnd = 0;
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
    const modifier = PERKS[actor.equipment.perk]?.reload ?? 1;
    state.reloadEnd = this.game.time + weapon.reloadTime * modifier;
    this.game.emit({ type: 'reload', actorId: actor.id, weaponId: weapon.id, duration: weapon.reloadTime * modifier });
    return true;
  }

  fire(actor, direction, alt = false) {
    const weapon = this.getWeapon(actor);
    const state = this.getWeaponState(actor);
    if (!actor.alive || !state || state.reloadEnd || this.game.time + 1e-8 < state.nextFire) return false;
    if (state.ammo <= 0) {
      this.reload(actor);
      return false;
    }
    const dir = normalize(direction);
    const origin = copy(this.game.eye(actor));
    state.ammo -= 1;
    state.nextFire = this.game.time + weapon.fireInterval;
    // Spawn protection ends when attacking, so it cannot become a free firing window.
    actor.invulnerableUntil = Math.min(actor.invulnerableUntil ?? 0, this.game.time);
    actor.lastShotAt = this.game.time;

    if (weapon.kind === 'projectile') {
      const aim = this.spreadDirection(dir, weapon.spread);
      this.projectiles.push({
        id: `projectile-${this.nextId++}`, ownerId: actor.id, weaponId: weapon.id,
        kind: weapon.id, color: weapon.color, pos: copy(origin),
        vel: addScaled({ x: 0, y: weapon.id === 'confetti' ? 2.2 : 0, z: 0 }, aim, weapon.speed),
        radius: weapon.radius, damage: weapon.damage, gravity: weapon.gravity,
        expires: this.game.time + weapon.lifetime, bounces: weapon.bounces, bounceCount: 0,
        restitution: weapon.restitution ?? 1, blastRadius: weapon.blastRadius ?? 0,
        knockback: weapon.knockback, lift: weapon.lift ?? 0, selfDamage: weapon.selfDamage ?? 0,
        headshotMultiplier: weapon.headshotMultiplier ?? 1, maxDistance: weapon.range, traveled: 0,
      });
      this.game.emit({ type: 'shot', actorId: actor.id, weaponId: weapon.id, origin, point: addScaled(origin, aim, 1.5), color: weapon.color });
    } else {
      for (let pellet = 0; pellet < (weapon.pellets ?? 1); pellet += 1) {
        const aim = this.spreadDirection(dir, weapon.spread * (alt && !weapon.pull ? 0.65 : 1));
        const hit = this.trace(origin, aim, weapon.range, actor.id);
        const point = hit?.point ?? addScaled(origin, aim, weapon.range);
        this.game.emit({ type: 'shot', actorId: actor.id, weaponId: weapon.id, origin, point, color: weapon.color, pellet });
        if (hit?.shield) {
          this.hitShield(hit.shield, weapon.damage, point);
        } else if (hit?.actor) {
          const falloff = this.falloff(weapon, hit.distance);
          const impulseScale = weapon.pull && !alt ? -weapon.knockback : weapon.knockback;
          const impulse = { x: aim.x * impulseScale, y: aim.y * impulseScale + (weapon.lift ?? 0), z: aim.z * impulseScale };
          this.game.damage(hit.actor, weapon.damage * falloff * (hit.headshot ? weapon.headshotMultiplier ?? 1 : 1), {
            attackerId: actor.id, weaponId: weapon.id, headshot: Boolean(hit.headshot), impulse,
          });
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

  trace(origin, dir, range, ownerId) {
    let hit = this.game.raycast(origin, dir, range, ownerId);
    for (const shield of this.fields) {
      if (shield.kind !== 'shield' || shield.expires <= this.game.time || shield.health <= 0 || shield.ownerId === ownerId) continue;
      const distance = sphereDistance(origin, dir, shield.pos, shield.radius, hit?.distance ?? range);
      if (distance === null) continue;
      const point = addScaled(origin, dir, distance);
      hit = { point, distance, normal: normalize(subtract(point, shield.pos)), shield, actor: null };
    }
    return hit;
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
    actor.gadgetReady[slot] = this.game.time + gadget.cooldown;
    actor.gadgetReady[gadget.id] = actor.gadgetReady[slot];
    if (slot === 'lethal' || gadget.mechanic === 'vortex') actor.invulnerableUntil = Math.min(actor.invulnerableUntil ?? 0, this.game.time);
    const dir = normalize(direction);
    const origin = copy(this.game.eye(actor));
    let point;
    if (gadget.mechanic === 'grenade') {
      point = copy(origin);
      this.projectiles.push({
        id: `projectile-${this.nextId++}`, ownerId: actor.id, weaponId: gadget.id,
        kind: gadget.id, color: gadget.color, pos: point,
        vel: addScaled({ x: actor.vel.x * 0.25, y: 4, z: actor.vel.z * 0.25 }, dir, 17),
        radius: 0.18, damage: gadget.damage, gravity: 16,
        expires: this.game.time + gadget.fuse, bounces: 20, bounceCount: 0,
        restitution: 0.54, blastRadius: gadget.radius, knockback: gadget.knockback,
        lift: 2, selfDamage: 0.55, maxDistance: 100, traveled: 0,
      });
    } else {
      point = this.placeGadget(actor, dir, gadget.mechanic === 'vortex' ? 6 : gadget.mechanic === 'shield' ? 0.7 : 1.5);
      if (gadget.mechanic === 'shield') point.y += 1.1;
      this.fields.push({
        id: `field-${this.nextId++}`, ownerId: actor.id, gadgetId: gadget.id,
        kind: gadget.mechanic, pos: point, color: gadget.color, radius: gadget.radius,
        expires: this.game.time + gadget.duration, created: this.game.time,
        health: gadget.health, armedAt: this.game.time + 0.8, touched: {},
      });
    }
    this.game.emit({ type: 'gadget', actorId: actor.id, gadgetId: gadget.id, point: copy(point) });
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
    const shields = this.fields.filter((field) => field.kind === 'shield' && field.health > 0 && field.expires > this.game.time && field.ownerId !== options.ownerId);
    const absorbed = new Map();
    for (const actor of this.game.actors) {
      if (!actor.alive) continue;
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
        for (const state of Object.values(actor.inventory ?? {})) state.reloadEnd = 0;
        continue;
      }
      for (const [id, state] of Object.entries(actor.inventory ?? {})) {
        if (!state.reloadEnd || state.reloadEnd > now + 1e-8) continue;
        const amount = Math.min(WEAPONS[id].magazine - state.ammo, state.reserve);
        state.ammo += amount;
        state.reserve -= amount;
        state.reloadEnd = 0;
      }
    }
    this.updateFields(dt);
    const survivors = [];
    for (const projectile of this.projectiles) {
      if (this.updateProjectile(projectile, dt)) survivors.push(projectile);
    }
    this.projectiles = survivors;
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
          if (horizontal > field.radius + actor.radius || actor.pos.y < field.pos.y - 0.5 || actor.pos.y > field.pos.y + 0.75 || (field.touched[actor.id] ?? -Infinity) > this.game.time) continue;
          field.touched[actor.id] = this.game.time + 0.85;
          actor.vel.y = Math.max(0, actor.vel.y);
          this.game.addImpulse(actor, { x: 0, y: gadget.launch, z: 0 });
          actor.grounded = false;
          this.game.emit({ type: 'gadget', actorId: actor.id, gadgetId: gadget.id, point: copy(actor.pos), triggered: true });
        } else if (field.kind === 'trap') {
          if (actor.id === field.ownerId || this.game.time < field.armedAt || horizontal > field.radius + actor.radius || Math.abs(offset.y) > 1.8 || !this.clearSegment(addScaled(field.pos, { x: 0, y: 1, z: 0 }, 0.15), chest(actor))) continue;
          field.expires = this.game.time;
          this.splash(addScaled(field.pos, { x: 0, y: 1, z: 0 }, 0.25), {
            ownerId: field.ownerId, weaponId: gadget.id, color: gadget.color,
            damage: gadget.damage, blastRadius: gadget.blastRadius, knockback: gadget.knockback, lift: gadget.lift, selfDamage: 0.55,
          });
          break;
        } else if (field.kind === 'vortex') {
          const center = addScaled(field.pos, { x: 0, y: 1, z: 0 }, 1.1);
          const pull = subtract(center, chest(actor));
          const distance = length(pull);
          if (actor.id === field.ownerId || distance > field.radius || !this.clearSegment(center, chest(actor))) continue;
          const force = gadget.force * (1 - distance / field.radius) * dt;
          const dir = normalize(pull);
          this.game.addImpulse(actor, { x: dir.x * force, y: Math.max(0, dir.y) * force * 0.5, z: dir.z * force });
        }
      }
    }
  }

  updateProjectile(projectile, dt) {
    if (projectile.expires <= this.game.time || projectile.traveled >= projectile.maxDistance) {
      if (projectile.blastRadius) this.splash(projectile.pos, projectile);
      return false;
    }
    for (const field of this.fields) {
      if (field.kind !== 'vortex' || field.expires <= this.game.time) continue;
      const center = addScaled(field.pos, { x: 0, y: 1, z: 0 }, 1.1);
      const offset = subtract(center, projectile.pos);
      const distance = length(offset);
      if (distance >= field.radius || !this.clearSegment(center, projectile.pos)) continue;
      const pull = normalize(offset);
      const force = 30 * (1 - distance / field.radius) * dt;
      projectile.vel = addScaled(projectile.vel, pull, force);
    }
    projectile.vel.y -= projectile.gravity * dt;
    let remaining = dt;
    for (let collision = 0; collision < 4 && remaining > 0.00001; collision += 1) {
      const speed = length(projectile.vel);
      if (speed < 0.01) break;
      const dir = normalize(projectile.vel);
      const distance = speed * remaining;
      const hit = this.trace(projectile.pos, dir, distance + projectile.radius, projectile.ownerId);
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
        if (projectile.blastRadius) {
          this.splash(projectile.pos, projectile);
        } else {
          this.game.damage(hit.actor, projectile.damage * (hit.headshot ? projectile.headshotMultiplier : 1), {
            attackerId: projectile.ownerId, weaponId: projectile.weaponId, headshot: Boolean(hit.headshot),
            impulse: { x: dir.x * projectile.knockback, y: dir.y * projectile.knockback + projectile.lift, z: dir.z * projectile.knockback },
          });
          this.game.emit({ type: 'impact', point: hit.point, color: projectile.color });
        }
        return false;
      }
      this.game.emit({ type: 'impact', point: hit.point, color: projectile.color });
      if (projectile.bounces <= 0) {
        if (projectile.blastRadius) this.splash(projectile.pos, projectile);
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
