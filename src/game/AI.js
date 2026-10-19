import { NavigationGrid } from './navigation.js';

const DIFFICULTIES = {
  easy: { reaction: 0.62, error: 0.095, turn: 3.3, sense: 0.3, memory: 2.2, aggression: 0.72, gadgets: 0.35 },
  normal: { reaction: 0.34, error: 0.052, turn: 5.2, sense: 0.2, memory: 3.0, aggression: 1, gadgets: 0.6 },
  hard: { reaction: 0.19, error: 0.026, turn: 7.4, sense: 0.14, memory: 3.8, aggression: 1.2, gadgets: 0.85 },
};

const PERSONALITIES = {
  rusher: { range: 0.7, strafe: 0.55, jump: 0.28, accuracy: 1.15, aggression: 1.25, wounded: 0.14 },
  trickster: { range: 0.95, strafe: 1.15, jump: 0.76, accuracy: 1.1, aggression: 1, wounded: 0.28 },
  sentinel: { range: 1.35, strafe: 0.45, jump: 0.1, accuracy: 0.8, aggression: 0.85, wounded: 0.4 },
  scavenger: { range: 1.05, strafe: 0.8, jump: 0.35, accuracy: 1, aggression: 0.95, wounded: 0.45 },
};
const PERSONALITY_KEYS = Object.keys(PERSONALITIES);
const ALIASES = { aggressive: 'rusher', aggressor: 'rusher', brawler: 'rusher', chaotic: 'trickster', flanker: 'trickster', precision: 'sentinel', sniper: 'sentinel', camper: 'sentinel', defensive: 'sentinel', cautious: 'scavenger', opportunist: 'scavenger' };
const PREFERRED_RANGE = { fizz: 13, doorbell: 5, bankshot: 15, confetti: 12, rail: 23, updraft: 7, yoink: 12 };

export class AI {
  constructor(game) {
    this.game = game;
    this.map = game.map;
    this.navigation = new NavigationGrid(game.map);
  }

  update(dt) {
    if (this.map !== this.game.map) {
      this.map = this.game.map;
      this.navigation = new NavigationGrid(this.map);
    }
    const difficulty = DIFFICULTIES[this.game.match.difficulty] || DIFFICULTIES.normal;
    for (const actor of this.game.actors) {
      if (actor.isPlayer) continue;
      if (!actor.alive) {
        actor.intent = { moveX: 0, moveZ: 0, sprint: false, jump: false, crouch: false };
        continue;
      }
      this.updateActor(actor, dt, difficulty);
    }
  }

  initialize(actor) {
    const now = this.game.time;
    const given = String(actor.personality || '').toLowerCase();
    const key = PERSONALITIES[given] ? given : ALIASES[given] || PERSONALITY_KEYS[hash(String(actor.id)) % PERSONALITY_KEYS.length];
    const state = actor.ai = {
      initialized: true, personality: key,
      targetId: null, visible: false, lastSeen: null, lastHeard: null,
      nextSense: now + this.random() * 0.2, reactionAt: now + 0.5,
      path: [], pathIndex: 0, destination: null, nextPath: 0, roamGoal: null,
      strafe: this.random() < 0.5 ? -1 : 1, nextStrafe: now + 0.6 + this.random(),
      aimYaw: 0, aimPitch: 0, aimYawGoal: 0, aimPitchGoal: 0, nextAim: 0,
      nextGadget: now + 2 + this.random() * 4, nextJump: now + 2 + this.random() * 3,
      nextSwitch: 0, burstUntil: 0, nextBurst: now,
      progressAt: now, progressPos: { ...actor.pos }, stuck: 0, recoveryUntil: 0,
      heardDamageAt: -Infinity, lastVisibleAt: -Infinity,
    };
    return state;
  }

  random() { return this.game.rng(); }

  updateActor(actor, dt, difficulty) {
    const now = this.game.time;
    const ai = actor.ai?.initialized ? actor.ai : this.initialize(actor);
    const profile = PERSONALITIES[ai.personality];
    const combat = this.game.combat;

    if (now >= ai.nextSense) {
      this.sense(actor, ai, difficulty);
      ai.nextSense = now + difficulty.sense * (0.85 + this.random() * 0.3);
    }
    let target = ai.targetId ? this.game.getActor(ai.targetId) : null;
    // Occlusion is checked again between perception ticks. A bot never keeps
    // tracking live coordinates or shooting when its opponent ducks into cover.
    const visible = !!(target?.alive && ai.visible && this.game.canSee(actor, target));
    ai.visible = visible;
    if (visible) {
      ai.lastSeen = { ...target.pos, time: now };
      ai.lastVisibleAt = now;
    } else if (!target?.alive || now - ai.lastVisibleAt > difficulty.memory) {
      ai.targetId = null;
      target = null;
    }

    const weapon = combat.getWeapon(actor);
    const weaponState = combat.getWeaponState(actor);
    this.manageWeapon(actor, ai, weapon, weaponState, visible);
    const distance = visible ? horizontalDistance(actor.pos, target.pos) : Infinity;
    const preferred = Math.min(PREFERRED_RANGE[weapon?.id] || 13, (weapon?.range || 50) * 0.65) * profile.range;
    const reloading = weaponState && weaponState.reloadEnd > now;
    let movement;

    if (visible) {
      movement = this.fightMovement(actor, target, ai, profile, difficulty, preferred, reloading);
      this.aim(actor, target, ai, profile, difficulty, weapon, dt);
    } else {
      let goal = null;
      if (ai.lastSeen && now - ai.lastSeen.time < difficulty.memory && horizontalDistance(actor.pos, ai.lastSeen) > 1.1) goal = ai.lastSeen;
      else if (ai.lastHeard && now - ai.lastHeard.time < 2.5 && horizontalDistance(actor.pos, ai.lastHeard) > 1.2) goal = ai.lastHeard;
      if (!goal) {
        if (!ai.roamGoal || horizontalDistance(actor.pos, ai.roamGoal) < 1.5) {
          ai.roamGoal = this.navigation.randomPoint(() => this.random(), actor.pos, 10);
        }
        goal = ai.roamGoal;
      }
      movement = this.navigate(actor, ai, goal);
      if (Math.hypot(movement.x, movement.z) > 0.1) {
        actor.yaw = turnToward(actor.yaw, Math.atan2(-movement.x, -movement.z), difficulty.turn * dt);
        actor.pitch = approach(actor.pitch, 0, dt * 1.5);
      }
    }

    movement = this.avoidCrowding(actor, movement);
    let jump = this.recover(actor, ai, movement);
    if (actor.grounded && now >= ai.nextJump) {
      ai.nextJump = now + 2.5 + this.random() * 4;
      if (visible && distance < 18 && this.random() < profile.jump) jump = true;
    }
    actor.intent = {
      moveX: movement.x,
      moveZ: movement.z,
      sprint: !visible || (distance > preferred * 1.8 && !reloading),
      jump,
      crouch: false,
    };

    if (visible && now >= ai.reactionAt) {
      const dir = forward(actor.yaw, actor.pitch);
      const targetYaw = Math.atan2(-(target.pos.x - actor.pos.x), -(target.pos.z - actor.pos.z));
      const facing = Math.abs(angleDifference(actor.yaw, targetYaw)) < 0.23;
      if (now >= ai.nextBurst && now >= ai.burstUntil) {
        ai.burstUntil = now + (0.4 + this.random() * 0.8) * difficulty.aggression * profile.aggression;
        ai.nextBurst = ai.burstUntil + (0.12 + this.random() * 0.3) / difficulty.aggression;
      }
      if (!reloading && facing && now < ai.burstUntil && distance < (weapon?.range || 55)) {
        combat.fire(actor, dir, weapon?.id === 'rail' || (weapon?.id === 'yoink' && distance < 7));
      }
      this.gadgets(actor, target, ai, profile, difficulty, dir, distance);
    }
  }

  sense(actor, ai, difficulty) {
    const now = this.game.time;
    if (Number.isFinite(actor.lastDamageAt) && actor.lastDamageAt > ai.heardDamageAt && now - actor.lastDamageAt < 2) {
      ai.heardDamageAt = actor.lastDamageAt;
      const attacker = this.game.getActor(actor.lastDamagedBy);
      if (attacker?.alive) {
        // Hearing provides a noisy location at the moment of damage, not a live
        // position that would follow a hidden enemy around the map.
        ai.lastHeard = { x: attacker.pos.x + (this.random() - 0.5) * 4, y: attacker.pos.y, z: attacker.pos.z + (this.random() - 0.5) * 4, time: now };
      }
    }
    let best = null;
    let score = Infinity;
    for (const other of this.game.actors) {
      if (other === actor || !other.alive || other.invulnerableUntil > now + 0.15) continue;
      const dx = other.pos.x - actor.pos.x;
      const dz = other.pos.z - actor.pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 44) continue;
      const facing = (-Math.sin(actor.yaw) * dx - Math.cos(actor.yaw) * dz) / Math.max(0.01, distance);
      const heard = actor.lastDamagedBy === other.id && now - (actor.lastDamageAt ?? -Infinity) < 2;
      if (distance > 6 && facing < -0.35 && other.id !== ai.targetId && !heard) continue;
      if (!this.game.canSee(actor, other)) continue;
      const woundedBias = ai.personality === 'scavenger' ? (1 - other.health / other.maxHealth) * 12 : 0;
      const candidate = distance - (other.id === ai.targetId ? 6 : 0) - (heard ? 9 : 0) - woundedBias;
      if (candidate < score) { score = candidate; best = other; }
    }
    if (best) {
      if (best.id !== ai.targetId || now - ai.lastVisibleAt > 0.45) {
        ai.reactionAt = now + difficulty.reaction * (0.8 + this.random() * 0.5);
        ai.burstUntil = 0;
        ai.nextBurst = ai.reactionAt;
      }
      ai.targetId = best.id;
      ai.visible = true;
      ai.lastVisibleAt = now;
      ai.lastSeen = { ...best.pos, time: now };
    } else {
      ai.visible = false;
    }
  }

  manageWeapon(actor, ai, weapon, state, visible) {
    if (!state || !weapon || state.reloadEnd > this.game.time) return;
    if (state.ammo <= 0 && state.reserve <= 0) {
      if (this.game.time >= ai.nextSwitch) {
        this.game.combat.switchWeapon(actor, actor.activeSlot === 0 ? 1 : 0);
        ai.nextSwitch = this.game.time + 2;
      }
    } else if (state.ammo <= 0 || (!visible && state.ammo < weapon.magazine * 0.55)) {
      this.game.combat.reload(actor);
    }
  }

  fightMovement(actor, target, ai, profile, difficulty, preferred, reloading) {
    const now = this.game.time;
    if (now >= ai.nextStrafe) {
      ai.nextStrafe = now + 0.8 + this.random() * 1.8;
      if (this.random() < 0.75) ai.strafe *= -1;
    }
    const dx = target.pos.x - actor.pos.x;
    const dz = target.pos.z - actor.pos.z;
    const distance = Math.max(0.01, Math.hypot(dx, dz));
    const radialX = dx / distance;
    const radialZ = dz / distance;
    const wounded = actor.health / actor.maxHealth < profile.wounded;
    let advance = distance > preferred * 1.15 ? difficulty.aggression * profile.aggression : distance < preferred * 0.7 ? -0.8 : 0;
    if ((wounded || reloading) && distance < preferred * 1.4) advance = -1;
    const strafe = profile.strafe * ai.strafe;
    const desired = normalized(radialX * advance - radialZ * strafe, radialZ * advance + radialX * strafe);
    const test = { x: actor.pos.x + desired.x * 2, z: actor.pos.z + desired.z * 2 };
    if (this.navigation.segmentClear(actor.pos, test)) return desired;
    // Prefer a nearby legal sidestep; a larger detour uses the same A* route
    // planner as roaming. Steering never relies on seeing through a wall.
    for (const angle of [ai.strafe * 0.8, -ai.strafe * 0.8, ai.strafe * 1.6, -ai.strafe * 1.6]) {
      const x = desired.x * Math.cos(angle) - desired.z * Math.sin(angle);
      const z = desired.x * Math.sin(angle) + desired.z * Math.cos(angle);
      if (this.navigation.segmentClear(actor.pos, { x: actor.pos.x + x * 1.7, z: actor.pos.z + z * 1.7 })) return { x, z };
    }
    return this.navigate(actor, ai, ai.lastSeen || target.pos);
  }

  navigate(actor, ai, goal) {
    const now = this.game.time;
    const changed = !ai.destination || horizontalDistance(ai.destination, goal) > 2;
    if (now >= ai.nextPath && (changed || ai.pathIndex >= ai.path.length)) {
      ai.destination = { ...goal };
      ai.path = this.navigation.findPath(actor.pos, goal);
      ai.pathIndex = 0;
      ai.nextPath = now + 0.7 + this.random() * 0.4;
      if (!ai.path.length) ai.roamGoal = null;
    }
    while (ai.pathIndex < ai.path.length && horizontalDistance(actor.pos, ai.path[ai.pathIndex]) < 0.65) ai.pathIndex++;
    if (ai.pathIndex >= ai.path.length) return { x: 0, z: 0 };
    while (ai.pathIndex + 1 < ai.path.length && this.navigation.segmentClear(actor.pos, ai.path[ai.pathIndex + 1])) ai.pathIndex++;
    const point = ai.path[ai.pathIndex];
    return normalized(point.x - actor.pos.x, point.z - actor.pos.z);
  }

  avoidCrowding(actor, movement) {
    let x = movement.x;
    let z = movement.z;
    for (const other of this.game.actors) {
      if (other === actor || !other.alive || Math.abs(other.pos.y - actor.pos.y) > 2) continue;
      const dx = actor.pos.x - other.pos.x;
      const dz = actor.pos.z - other.pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.01 && distance < 1.5) {
        x += dx / distance * (1.5 - distance) * 1.2;
        z += dz / distance * (1.5 - distance) * 1.2;
      }
    }
    const next = normalized(x, z);
    if (this.navigation.segmentClear(actor.pos, { x: actor.pos.x + next.x, z: actor.pos.z + next.z })) return next;
    return movement;
  }

  recover(actor, ai, movement) {
    const now = this.game.time;
    let jump = false;
    if (now - ai.progressAt >= 0.8) {
      const distance = horizontalDistance(actor.pos, ai.progressPos);
      ai.stuck = Math.hypot(movement.x, movement.z) > 0.2 && distance < 0.35 ? ai.stuck + 1 : 0;
      ai.progressAt = now;
      ai.progressPos = { ...actor.pos };
      if (ai.stuck >= 2) {
        ai.path = [];
        ai.nextPath = 0;
        ai.roamGoal = null;
        ai.strafe *= -1;
        ai.recoveryUntil = now + 0.55;
        jump = actor.grounded;
        ai.stuck = 0;
      }
    }
    if (now < ai.recoveryUntil) {
      const heading = actor.yaw + ai.strafe * 1.8;
      movement.x = -Math.sin(heading);
      movement.z = -Math.cos(heading);
    }
    return jump;
  }

  aim(actor, target, ai, profile, difficulty, weapon, dt) {
    const now = this.game.time;
    const eye = this.game.eye(actor);
    const distance = horizontalDistance(actor.pos, target.pos);
    const speed = weapon?.projectileSpeed || weapon?.speed || 30;
    const lead = weapon?.kind === 'projectile' ? Math.min(0.55, distance / speed) * 0.65 : 0.025;
    const dx = target.pos.x + (target.vel?.x || 0) * lead - eye.x;
    const dz = target.pos.z + (target.vel?.z || 0) * lead - eye.z;
    const flightTime = Math.min(1.2, distance / speed);
    const arc = weapon?.kind === 'projectile' ? 0.5 * (weapon.gravity || 0) * flightTime ** 2 - (weapon.id === 'confetti' ? 2.2 * flightTime : 0) : 0;
    const dy = target.pos.y + target.height * 0.64 + (target.vel?.y || 0) * lead * 0.3 + arc - eye.y;
    if (now >= ai.nextAim) {
      const error = difficulty.error * profile.accuracy * (distance < 6 ? 0.65 : 1);
      ai.aimYawGoal = (this.random() * 2 - 1) * error;
      ai.aimPitchGoal = (this.random() * 2 - 1) * error * 0.7;
      ai.nextAim = now + 0.18 + this.random() * 0.22;
    }
    ai.aimYaw += (ai.aimYawGoal - ai.aimYaw) * Math.min(1, dt * 8);
    ai.aimPitch += (ai.aimPitchGoal - ai.aimPitch) * Math.min(1, dt * 8);
    const yaw = Math.atan2(-dx, -dz) + ai.aimYaw;
    const pitch = Math.atan2(dy, Math.hypot(dx, dz)) + ai.aimPitch;
    actor.yaw = turnToward(actor.yaw, yaw, difficulty.turn * dt);
    actor.pitch = approach(actor.pitch, Math.max(-1.2, Math.min(1.2, pitch)), difficulty.turn * dt * 0.8);
  }

  gadgets(actor, target, ai, profile, difficulty, dir, distance) {
    const now = this.game.time;
    if (now < ai.nextGadget) return;
    ai.nextGadget = now + 1.6 + this.random() * 2.6;
    if (this.random() > difficulty.gadgets) return;
    const equipment = actor.equipment;
    const wounded = actor.health / actor.maxHealth < Math.max(0.45, profile.wounded);
    if ((equipment.tactical === 'bubble' && wounded) ||
        (equipment.tactical === 'springpad' && distance < 10 && actor.grounded) ||
        (equipment.tactical === 'vortex' && distance > 4 && distance < 19)) {
      this.game.combat.useGadget(actor, 'tactical', dir);
    }
    if ((equipment.lethal === 'cherry' && distance > 5 && distance < 22) ||
        (equipment.lethal === 'whoopee' && distance < 11) ||
        (equipment.lethal === 'vortex' && distance > 4 && distance < 19)) {
      const toss = normalized3(dir.x, dir.y + (equipment.lethal === 'cherry' ? 0.2 : 0), dir.z);
      this.game.combat.useGadget(actor, 'lethal', toss);
    }
  }
}

function hash(text) { let value = 0; for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0; return value; }
function horizontalDistance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function normalized(x, z) { const length = Math.hypot(x, z); return length < 1e-6 ? { x: 0, z: 0 } : { x: x / length, z: z / length }; }
function normalized3(x, y, z) { const length = Math.hypot(x, y, z) || 1; return { x: x / length, y: y / length, z: z / length }; }
function angleDifference(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
function turnToward(value, target, step) { return value + Math.max(-step, Math.min(step, angleDifference(value, target))); }
function approach(value, target, step) { return value + Math.max(-step, Math.min(step, target - value)); }
function forward(yaw, pitch) { return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) }; }

export default AI;
