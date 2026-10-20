import { NavigationGrid } from './navigation.js';

// Difficulty changes information, execution and decisions. It never modifies
// health, damage, collision dimensions, weapon cooldowns or resource costs.
export const AI_DIFFICULTIES = Object.freeze({
  easy: { reaction: .62, error: .095, turn: 3.3, sense: .32, memory: 2.2, aggression: .72, equipment: .34, sight: 32, halfFov: 72, checks: 4, decision: .85, tactics: .23, mistake: .28, lead: .42, strafe: .68 },
  normal: { reaction: .34, error: .052, turn: 5.2, sense: .22, memory: 3, aggression: 1, equipment: .60, sight: 40, halfFov: 90, checks: 5, decision: .55, tactics: .55, mistake: .14, lead: .65, strafe: .88 },
  hard: { reaction: .19, error: .026, turn: 7.4, sense: .15, memory: 3.8, aggression: 1.14, equipment: .82, sight: 46, halfFov: 105, checks: 6, decision: .36, tactics: .78, mistake: .065, lead: .82, strafe: 1 },
  veteran: { reaction: .14, error: .018, turn: 8.8, sense: .11, memory: 4.4, aggression: 1.22, equipment: .94, sight: 50, halfFov: 115, checks: 7, decision: .26, tactics: .93, mistake: .025, lead: .92, strafe: 1.08 },
});
const PROFILES = {
  rusher: { range: .7, strafe: .55, jump: .28, accuracy: 1.15, aggression: 1.25, retreat: .23, flank: .18 },
  trickster: { range: .95, strafe: 1.15, jump: .76, accuracy: 1.1, aggression: 1, retreat: .38, flank: .65 },
  sentinel: { range: 1.35, strafe: .45, jump: .1, accuracy: .8, aggression: .85, retreat: .48, flank: .3 },
  scavenger: { range: 1.05, strafe: .8, jump: .35, accuracy: 1, aggression: .95, retreat: .55, flank: .42 },
};
const PROFILE_KEYS = Object.keys(PROFILES);
const ALIASES = { aggressive: 'rusher', aggressor: 'rusher', brawler: 'rusher', chaotic: 'trickster', flanker: 'trickster', mobile: 'trickster', precision: 'sentinel', sniper: 'sentinel', camper: 'sentinel', defensive: 'sentinel', cautious: 'scavenger', opportunist: 'scavenger', gadget: 'scavenger' };
const RANGE = { fizz: 13, doorbell: 5, bankshot: 15, confetti: 12, rail: 23, updraft: 7, yoink: 12, burst: 19, spool: 13, tack: 12, disc: 11, arc: 9 };
const HAZARDS = new Set(['vortex', 'dampen', 'trap', 'whoopee', 'repulsor']);

export class AI {
  constructor(game) {
    this.game = game;
    this.cursor = 0;
    this.stats = { perceptionPasses: 0, decisions: 0, paths: 0, sightRays: 0, expanded: 0 };
    this.prepareMap();
  }

  prepareMap() {
    this.map = this.game.map;
    this.navigation = new NavigationGrid(this.map, { traverseRamps: true });
    this.coverPoints = [];
    for (const box of this.map.obstacles || []) {
      if (box.h < .9) continue;
      const w = box.w / 2 + 1.05, d = box.d / 2 + 1.05;
      for (const [dx, dz] of [[-w, 0], [w, 0], [0, -d], [0, d], [-w, -d], [w, -d], [-w, d], [w, d]]) {
        const point = { x: box.x + dx, z: box.z + dz };
        if (this.navigation.isWalkable(point.x, point.z)) this.coverPoints.push({ ...point, y: this.navigation.surfaceHeight(point.x, point.z) });
      }
    }
  }

  update(dt) {
    if (this.map !== this.game.map) this.prepareMap();
    this.budget = { sense: 3, decisions: 2, paths: 2 };
    this.frameStats = { perceptionPasses: 0, decisions: 0, paths: 0, sightRays: 0, expanded: 0 };
    const difficulty = AI_DIFFICULTIES[this.game.match.difficulty] || AI_DIFFICULTIES.normal;
    const actors = this.game.actors;
    // Rotate service order so a shared work budget cannot starve late actors.
    for (let n = 0; n < actors.length; n++) {
      const actor = actors[(n + this.cursor) % actors.length];
      if (actor.isPlayer || actor.isHuman) continue;
      if (!actor.alive) { actor.intent = { moveX: 0, moveZ: 0, sprint: false, jump: false, crouch: false }; continue; }
      this.updateActor(actor, dt, difficulty);
    }
    this.cursor = (this.cursor + 1) % Math.max(1, actors.length);
    for (const key of Object.keys(this.stats)) this.stats[key] += this.frameStats[key];
  }

  enemies(a, b) { return !!b && (this.game.areEnemies ? this.game.areEnemies(a, b) : a !== b); }
  random() { return this.game.rng(); }
  sight(a, b) { this.frameStats.sightRays++; return this.game.canSee(a, b); }

  initialize(actor) {
    const now = this.game.time, given = String(actor.personality || '').toLowerCase();
    const personality = PROFILES[given] ? given : ALIASES[given] || PROFILE_KEYS[hash(String(actor.id)) % PROFILE_KEYS.length];
    const behavior = { ...PROFILES[personality] }, classId = actor.classId || actor.equipment.classId;
    if (classId === 'runner') { behavior.range *= .9; behavior.strafe *= 1.1; }
    if (classId === 'bulwark') { behavior.range *= .85; behavior.retreat *= .75; }
    if (classId === 'medic') { behavior.retreat = Math.max(.58, behavior.retreat); behavior.range *= 1.12; }
    if (classId === 'engineer') behavior.flank *= .8;
    if (classId === 'disruptor') behavior.range *= .78;
    if (classId === 'acrobat') { behavior.jump = Math.min(.9, behavior.jump + .25); behavior.strafe *= 1.15; }
    return actor.ai = {
      initialized: true, personality, behavior, mode: 'roam', targetId: null, visible: false, lastSeen: null, lastHeard: null,
      nextSense: now + this.random() * .2, scanCursor: 0, nextDecision: now + this.random() * .25,
      reactionAt: now + .5, path: [], pathIndex: 0, destination: null, nextPath: 0, roamGoal: null,
      tacticGoal: null, tacticUntil: 0, mistakeUntil: 0, knownFields: [], incoming: null,
      strafe: this.random() < .5 ? -1 : 1, nextStrafe: now + .6 + this.random(),
      aimYaw: 0, aimPitch: 0, aimYawGoal: 0, aimPitchGoal: 0, nextAim: 0,
      nextEquipment: now + 1 + this.random() * 2, nextJump: now + 2 + this.random() * 3,
      nextSwitch: 0, nextWeaponChoice: 0, burstUntil: 0, nextBurst: now, progressAt: now, progressPos: { ...actor.pos },
      stuck: 0, recoveryUntil: 0, heardDamageAt: -Infinity, lastVisibleAt: -Infinity,
    };
  }

  updateActor(actor, dt, difficulty) {
    const now = this.game.time;
    const ai = actor.ai?.initialized ? actor.ai : this.initialize(actor), profile = ai.behavior || PROFILES[ai.personality], combat = this.game.combat;
    if (now >= ai.nextSense && this.budget.sense > 0) {
      this.budget.sense--; this.frameStats.perceptionPasses++;
      this.sense(actor, ai, difficulty);
      ai.nextSense = now + difficulty.sense * (.85 + this.random() * .3);
    }
    let target = ai.targetId ? this.game.getActor(ai.targetId) : null;
    const visible = !!(target?.alive && this.enemies(actor, target) && ai.visible && this.sight(actor, target));
    ai.visible = visible;
    if (visible) { ai.lastSeen = { ...target.pos, time: now }; ai.lastVisibleAt = now; }
    else if (!target?.alive || !this.enemies(actor, target) || now - ai.lastVisibleAt > difficulty.memory) { ai.targetId = null; target = null; }
    const distance = visible ? distanceXZ(actor.pos, target.pos) : Infinity;
    let weapon = combat.getWeapon(actor), state = combat.getWeaponState(actor);
    if (now >= ai.nextDecision && this.budget.decisions > 0) {
      this.budget.decisions--; this.frameStats.decisions++;
      this.decide(actor, ai, profile, difficulty, visible ? target : null, weapon, state);
      ai.nextDecision = now + difficulty.decision * (.85 + this.random() * .3);
    }
    this.manageWeapon(actor, ai, weapon, state, visible, distance, difficulty);
    weapon = combat.getWeapon(actor); state = combat.getWeaponState(actor);
    const preferred = Math.min(RANGE[weapon?.id] || 13, (weapon?.range || 50) * .65) * profile.range;
    const reloading = state?.reloadEnd > now;
    let movement;
    if (ai.tacticGoal && now < ai.tacticUntil) {
      movement = distanceXZ(actor.pos, ai.tacticGoal) < .8 ? { x: 0, z: 0 } : this.navigate(actor, ai, ai.tacticGoal);
    } else if (visible) {
      movement = this.fightMovement(actor, target, ai, profile, difficulty, preferred, reloading);
    } else {
      let goal = null;
      if (ai.lastSeen && now - ai.lastSeen.time < difficulty.memory && distanceXZ(actor.pos, ai.lastSeen) > 1.1) { goal = ai.lastSeen; ai.mode = 'pursue'; }
      else if (ai.lastHeard && now - ai.lastHeard.time < 2.5 && distanceXZ(actor.pos, ai.lastHeard) > 1.2) { goal = ai.lastHeard; ai.mode = 'investigate'; }
      if (!goal) {
        ai.mode = 'roam';
        if (!ai.roamGoal || distanceXZ(actor.pos, ai.roamGoal) < 1.5) ai.roamGoal = this.navigation.randomPoint(() => this.random(), actor.pos, 10);
        goal = ai.roamGoal;
      }
      movement = this.navigate(actor, ai, goal);
    }
    movement = this.avoidHazards(actor, ai, movement, difficulty);
    movement = this.avoidCrowding(actor, movement);
    if (visible) this.aim(actor, target, ai, profile, difficulty, weapon, dt);
    else if (Math.hypot(movement.x, movement.z) > .1) {
      actor.yaw = turnToward(actor.yaw, Math.atan2(-movement.x, -movement.z), difficulty.turn * dt);
      actor.pitch = approach(actor.pitch, 0, dt * 1.5);
    }
    let jump = this.recover(actor, ai, movement);
    if (actor.grounded && now >= ai.nextJump) {
      ai.nextJump = now + 2.5 + this.random() * 4;
      if (visible && distance < 18 && this.random() < profile.jump * difficulty.strafe) jump = true;
    }
    const sheltering = ['retreat', 'reload', 'heal', 'resupply'].includes(ai.mode);
    actor.intent = { moveX: movement.x, moveZ: movement.z, sprint: !visible || (sheltering && !reloading) || distance > preferred * 1.8, jump,
      crouch: sheltering && ai.tacticGoal && distanceXZ(actor.pos, ai.tacticGoal) < .9 && !visible };
    const dir = forward(actor.yaw, actor.pitch);
    if (visible && now >= ai.reactionAt) {
      const targetYaw = Math.atan2(-(target.pos.x - actor.pos.x), -(target.pos.z - actor.pos.z));
      if (now >= ai.nextBurst && now >= ai.burstUntil) {
        const sustained = weapon?.id === 'spool' ? 1.7 : 1;
        ai.burstUntil = now + (.4 + this.random() * .8) * difficulty.aggression * profile.aggression * sustained;
        ai.nextBurst = ai.burstUntil + (.12 + this.random() * .3) / difficulty.aggression;
      }
      if (!reloading && Math.abs(angleDifference(actor.yaw, targetYaw)) < .23 && now < ai.burstUntil && distance < (weapon?.range || 55)) {
        let allyBlocking = false;
        if (actor.team && this.game.match.mode === 'tdm' && now + 1e-8 >= (state?.nextFire || 0)) {
          const hit = this.game.raycast(this.game.eye(actor), dir, Math.min(distance + 1, weapon?.range || 55), actor.id);
          allyBlocking = !!hit?.actor && !this.enemies(actor, hit.actor);
        }
        if (!allyBlocking) combat.fire(actor, dir, weapon?.id === 'rail' || (weapon?.id === 'yoink' && distance < 7));
      }
    }
    this.equipment(actor, ai, profile, difficulty, visible && now >= ai.reactionAt ? target : null, dir, distance, weapon, state);
  }

  sense(actor, ai, difficulty) {
    const now = this.game.time;
    if (Number.isFinite(actor.lastDamageAt) && actor.lastDamageAt > ai.heardDamageAt && now - actor.lastDamageAt < 2) {
      ai.heardDamageAt = actor.lastDamageAt;
      const attacker = this.game.getActor(actor.lastDamagedBy);
      if (attacker?.alive && this.enemies(actor, attacker)) ai.lastHeard = { x: attacker.pos.x + (this.random() - .5) * 4, y: attacker.pos.y, z: attacker.pos.z + (this.random() - .5) * 4, time: now };
    }
    let best = null, score = Infinity, checks = 0;
    const actors = this.game.actors, candidates = [];
    const previous = this.game.getActor(ai.targetId);
    if (previous) candidates.push(previous);
    for (let n = 0; n < actors.length; n++) {
      const other = actors[(n + ai.scanCursor) % actors.length];
      if (other !== previous) candidates.push(other);
    }
    ai.scanCursor = (ai.scanCursor + difficulty.checks) % Math.max(1, actors.length);
    for (const other of candidates) {
      if (!other.alive || !this.enemies(actor, other) || other.invulnerableUntil > now + .15) continue;
      const dx = other.pos.x - actor.pos.x, dz = other.pos.z - actor.pos.z, distance = Math.hypot(dx, dz);
      if (distance > difficulty.sight) continue;
      const facing = (-Math.sin(actor.yaw) * dx - Math.cos(actor.yaw) * dz) / Math.max(.01, distance);
      const heard = actor.lastDamagedBy === other.id && now - (actor.lastDamageAt ?? -Infinity) < 2;
      if (distance > 4 && facing < Math.cos(difficulty.halfFov * Math.PI / 180) && other.id !== ai.targetId && !heard) continue;
      if (checks++ >= difficulty.checks) break;
      if (!this.sight(actor, other)) continue;
      const woundedBias = ai.personality === 'scavenger' ? (1 - other.health / other.maxHealth) * 10 : 0;
      const candidate = distance - (other.id === ai.targetId ? 6 : 0) - (heard ? 9 : 0) - woundedBias;
      if (candidate < score) { score = candidate; best = other; }
    }
    if (best) {
      if (best.id !== ai.targetId || now - ai.lastVisibleAt > .45) {
        ai.reactionAt = now + difficulty.reaction * (.8 + this.random() * .5);
        ai.burstUntil = 0; ai.nextBurst = ai.reactionAt;
      }
      ai.targetId = best.id; ai.visible = true; ai.lastVisibleAt = now; ai.lastSeen = { ...best.pos, time: now };
    } else ai.visible = false;
  }

  seesPoint(actor, point, height = .4) {
    const eye = this.game.eye(actor), delta = { x: point.x - eye.x, y: (point.y || 0) + height - eye.y, z: point.z - eye.z };
    const length = Math.hypot(delta.x, delta.y, delta.z);
    if (length < .1) return true;
    this.frameStats.sightRays++;
    const hit = this.game.worldRaycast(eye, normalized3(delta.x, delta.y, delta.z), length);
    return !hit || hit.distance >= length - .12;
  }

  observeFields(actor, ai) {
    const now = this.game.time, observations = [];
    // Nearer candidates first, but no tactical use before actual LOS succeeds.
    const fields = (this.game.combat.fields || []).filter(f => f.pos && f.expires > now && distanceXZ(actor.pos, f.pos) < 22)
      .sort((a, b) => distanceXZ(actor.pos, a.pos) - distanceXZ(actor.pos, b.pos)).slice(0, 8);
    for (const field of fields) {
      const owner = this.game.getActor(field.ownerId), friendly = owner === actor || (owner && !this.enemies(actor, owner)) ||
        (this.game.match.mode === 'tdm' && actor.team && field.ownerTeam === actor.team);
      if (owner !== actor && !this.seesPoint(actor, field.pos)) continue;
      observations.push({ id: field.id, pos: { ...field.pos }, kind: field.kind, radius: field.radius || 2, expires: field.expires, friendly });
    }
    ai.knownFields = observations;
    ai.incoming = null;
    const projectiles = (this.game.combat.projectiles || []).filter(p => p.pos && p.ownerId !== actor.id && distanceXZ(actor.pos, p.pos) < 9)
      .sort((a, b) => distanceXZ(actor.pos, a.pos) - distanceXZ(actor.pos, b.pos)).slice(0, 4);
    for (const p of projectiles) {
      const owner = this.game.getActor(p.ownerId);
      if (owner && !this.enemies(actor, owner) || this.game.match.mode === 'tdm' && actor.team && p.ownerTeam === actor.team) continue;
      if (!this.seesPoint(actor, p.pos, 0)) continue;
      const dx = actor.pos.x - p.pos.x, dz = actor.pos.z - p.pos.z;
      if (dx * (p.vel?.x || 0) + dz * (p.vel?.z || 0) <= 0 && !(p.blastRadius > 0)) continue;
      ai.incoming = { pos: { ...p.pos }, time: now, kind: p.kind, blastRadius: p.blastRadius || 0 }; break;
    }
  }

  decide(actor, ai, profile, difficulty, target, weapon, state) {
    const now = this.game.time;
    this.observeFields(actor, ai);
    if (this.random() < difficulty.mistake) ai.mistakeUntil = now + .55 + this.random() * .7;
    if (ai.mistakeUntil > now) { ai.mode = target ? 'engage' : 'roam'; ai.tacticGoal = null; return; }
    const health = actor.health / actor.maxHealth, ammoLow = this.needsAmmo(weapon, state);
    const resource = ai.knownFields.filter(f => f.friendly && f.expires > now + 1.5 && ((f.kind === 'heal' && health < .8) || (f.kind === 'supply' && ammoLow)))
      .sort((a, b) => distanceXZ(actor.pos, a.pos) - distanceXZ(actor.pos, b.pos))[0];
    if (resource && this.random() < difficulty.tactics) {
      ai.mode = resource.kind === 'heal' ? 'heal' : 'resupply'; ai.tacticGoal = { ...resource.pos }; ai.tacticUntil = now + 2.5; return;
    }
    if (ai.tacticGoal && now < ai.tacticUntil) {
      if (ai.mode === 'heal' && health >= .85 || ai.mode === 'resupply' && !ammoLow) ai.tacticUntil = 0;
      else return;
    }
    ai.tacticGoal = null;
    const threat = target?.pos || (ai.lastSeen && now - ai.lastSeen.time < difficulty.memory ? ai.lastSeen : null);
    const empty = state && state.ammo + state.reserve <= 0;
    const retreat = health < profile.retreat || empty || (state?.reloadEnd > now && threat);
    if (threat && retreat && this.random() < difficulty.tactics) {
      const cover = this.findCover(actor, threat, ai);
      if (cover) { ai.mode = health < profile.retreat ? 'retreat' : 'reload'; ai.tacticGoal = cover; ai.tacticUntil = now + 1.4 + this.random(); return; }
    }
    if (target && this.random() < profile.flank * difficulty.tactics) {
      const distance = distanceXZ(actor.pos, target.pos), radial = normalized(actor.pos.x - target.pos.x, actor.pos.z - target.pos.z);
      const goal = { x: target.pos.x + radial.x * distance - radial.z * ai.strafe * 6, z: target.pos.z + radial.z * distance + radial.x * ai.strafe * 6 };
      if (this.navigation.isWalkable(goal.x, goal.z) && this.hazardCost(goal, ai) < .1) { ai.mode = 'flank'; ai.tacticGoal = goal; ai.tacticUntil = now + 1.1; return; }
    }
    ai.mode = target ? 'engage' : 'roam';
  }

  findCover(actor, threat, ai) {
    const candidates = this.coverPoints.filter(p => distanceXZ(actor.pos, p) < 14 && distanceXZ(actor.pos, p) > 1.2)
      .sort((a, b) => distanceXZ(actor.pos, a) - distanceXZ(actor.pos, b)).slice(0, 12);
    let best = null, score = Infinity;
    for (const point of candidates) {
      if (this.hazardCost(point, ai) > .1) continue;
      const origin = { ...threat, y: (threat.y || 0) + 1.6 }, chest = { ...point, y: point.y + 1.05 };
      const d = Math.hypot(chest.x - origin.x, chest.y - origin.y, chest.z - origin.z);
      this.frameStats.sightRays++;
      const hit = this.game.worldRaycast(origin, normalized3(chest.x - origin.x, chest.y - origin.y, chest.z - origin.z), d);
      if (!hit || hit.distance >= d - .4) continue;
      const value = distanceXZ(actor.pos, point) - Math.min(25, distanceXZ(point, threat)) * .18;
      if (value < score) { score = value; best = point; }
    }
    return best ? { ...best } : null;
  }

  manageWeapon(actor, ai, weapon, state, visible, distance, difficulty) {
    if (!state || !weapon || state.reloadEnd > this.game.time) return;
    const otherSlot = actor.activeSlot === 0 ? 1 : 0, otherId = actor.equipment[otherSlot === 0 ? 'primary' : 'secondary'];
    const otherState = actor.inventory[otherId], otherAmmo = otherState && otherState.ammo + otherState.reserve > 0;
    let badRange = false;
    if (this.game.time >= ai.nextWeaponChoice) {
      ai.nextWeaponChoice = this.game.time + difficulty.decision;
      badRange = visible && ai.mistakeUntil <= this.game.time && this.random() < difficulty.tactics && Math.abs(distance - (RANGE[otherId] || 13)) + 5 < Math.abs(distance - (RANGE[weapon.id] || 13));
    }
    if (otherAmmo && this.game.time >= ai.nextSwitch && ((state.ammo <= 0 && (state.reserve <= 0 || distance < 8)) || badRange)) {
      this.game.combat.switchWeapon(actor, otherSlot); ai.nextSwitch = this.game.time + 2.2;
    } else if (state.ammo <= 0 || (!visible && state.ammo < weapon.magazine * .55)) this.game.combat.reload(actor);
  }

  fightMovement(actor, target, ai, profile, difficulty, preferred, reloading) {
    const now = this.game.time;
    if (now >= ai.nextStrafe) { ai.nextStrafe = now + .65 + this.random() * 1.8; if (this.random() < .75) ai.strafe *= -1; }
    const dx = target.pos.x - actor.pos.x, dz = target.pos.z - actor.pos.z, distance = Math.max(.01, Math.hypot(dx, dz));
    let advance = distance > preferred * 1.15 ? difficulty.aggression * profile.aggression : distance < preferred * .7 ? -.8 : 0;
    if ((actor.health / actor.maxHealth < profile.retreat || reloading) && distance < preferred * 1.4) advance = -1;
    const strafe = profile.strafe * ai.strafe * difficulty.strafe * (ai.mistakeUntil > now ? .3 : 1);
    const desired = normalized(dx / distance * advance - dz / distance * strafe, dz / distance * advance + dx / distance * strafe);
    if (this.navigation.segmentClear(actor.pos, { x: actor.pos.x + desired.x * 2, z: actor.pos.z + desired.z * 2 })) return desired;
    for (const angle of [ai.strafe * .8, -ai.strafe * .8, ai.strafe * 1.6, -ai.strafe * 1.6]) {
      const x = desired.x * Math.cos(angle) - desired.z * Math.sin(angle), z = desired.x * Math.sin(angle) + desired.z * Math.cos(angle);
      if (this.navigation.segmentClear(actor.pos, { x: actor.pos.x + x * 1.7, z: actor.pos.z + z * 1.7 })) return { x, z };
    }
    return this.navigate(actor, ai, ai.lastSeen || target.pos);
  }

  navigate(actor, ai, goal) {
    const now = this.game.time, changed = !ai.destination || distanceXZ(ai.destination, goal) > 2;
    if (now >= ai.nextPath && (changed || ai.pathIndex >= ai.path.length) && this.budget.paths > 0) {
      this.budget.paths--; this.frameStats.paths++;
      ai.destination = { ...goal }; ai.path = this.navigation.findPath(actor.pos, goal, { maxExpanded: 1600 });
      this.frameStats.expanded += this.navigation.lastExpanded;
      // Impulses can deposit bots on isolated cover tops outside the ramp
      // graph. A short physical drop to nearby open ground gets them back onto
      // navigation; it never teleports or asks the graph to climb a wall.
      if (!ai.path.length && actor.pos.y > .5 && this.navigation.surfaceHeight(actor.pos.x, actor.pos.z) > .4) {
        const landing = this.navigation.nearestGroundPoint(actor.pos);
        if (landing && distanceXZ(actor.pos, landing) < 8) ai.path = [landing];
      }
      ai.pathIndex = 0; ai.nextPath = now + .7 + this.random() * .4;
      if (!ai.path.length) { ai.roamGoal = null; ai.tacticUntil = 0; }
    }
    while (ai.pathIndex < ai.path.length && distanceXZ(actor.pos, ai.path[ai.pathIndex]) < .65) ai.pathIndex++;
    if (ai.pathIndex >= ai.path.length) return { x: 0, z: 0 };
    if (ai.pathIndex + 1 < ai.path.length && this.navigation.segmentClear(actor.pos, ai.path[ai.pathIndex + 1])) ai.pathIndex++;
    const point = ai.path[ai.pathIndex];
    return normalized(point.x - actor.pos.x, point.z - actor.pos.z);
  }

  hazardCost(point, ai) {
    let cost = 0;
    for (const field of ai.knownFields) if (!field.friendly && field.expires > this.game.time && HAZARDS.has(field.kind)) cost += Math.max(0, field.radius + 1.5 - distanceXZ(point, field.pos));
    return cost;
  }

  avoidHazards(actor, ai, movement, difficulty) {
    let x = movement.x, z = movement.z;
    for (const field of ai.knownFields) {
      if (field.friendly || field.expires <= this.game.time || !HAZARDS.has(field.kind)) continue;
      const dx = actor.pos.x - field.pos.x, dz = actor.pos.z - field.pos.z, d = Math.hypot(dx, dz);
      if (d > .01 && d < field.radius + 2.5) { const force = Math.min(2.5, (field.radius + 2.5 - d) * difficulty.tactics); x += dx / d * force; z += dz / d * force; }
    }
    if (ai.incoming && this.game.time - ai.incoming.time < .4) {
      const away = normalized(actor.pos.x - ai.incoming.pos.x, actor.pos.z - ai.incoming.pos.z);
      if (ai.incoming.blastRadius > 0) { x += away.x * difficulty.tactics * 2.5; z += away.z * difficulty.tactics * 2.5; }
      else { x += -away.z * ai.strafe * difficulty.tactics; z += away.x * ai.strafe * difficulty.tactics; }
    }
    const next = normalized(x, z);
    if (this.navigation.segmentClear(actor.pos, { x: actor.pos.x + next.x, z: actor.pos.z + next.z })) return next;
    return movement;
  }

  avoidCrowding(actor, movement) {
    let x = movement.x, z = movement.z;
    for (const other of this.game.actors) {
      if (other === actor || !other.alive || Math.abs(other.pos.y - actor.pos.y) > 2) continue;
      const dx = actor.pos.x - other.pos.x, dz = actor.pos.z - other.pos.z, distance = Math.hypot(dx, dz);
      if (distance > .01 && distance < 1.5) { x += dx / distance * (1.5 - distance) * 1.2; z += dz / distance * (1.5 - distance) * 1.2; }
    }
    const next = normalized(x, z);
    return this.navigation.segmentClear(actor.pos, { x: actor.pos.x + next.x, z: actor.pos.z + next.z }) ? next : movement;
  }

  recover(actor, ai, movement) {
    const now = this.game.time;
    let jump = false;
    if (now - ai.progressAt >= .8) {
      const distance = distanceXZ(actor.pos, ai.progressPos);
      ai.stuck = Math.hypot(movement.x, movement.z) > .2 && distance < .35 && actor.grounded ? ai.stuck + 1 : 0;
      ai.progressAt = now; ai.progressPos = { ...actor.pos };
      if (ai.stuck >= 2) {
        ai.path = []; ai.nextPath = 0; ai.roamGoal = null; ai.tacticUntil = 0; ai.strafe *= -1;
        ai.recoveryUntil = now + .55; jump = actor.grounded; ai.stuck = 0;
      }
    }
    if (now < ai.recoveryUntil) { const heading = actor.yaw + ai.strafe * 1.8; movement.x = -Math.sin(heading); movement.z = -Math.cos(heading); }
    return jump;
  }

  aim(actor, target, ai, profile, difficulty, weapon, dt) {
    const now = this.game.time, eye = this.game.eye(actor), distance = distanceXZ(actor.pos, target.pos);
    const speed = weapon?.projectileSpeed || weapon?.speed || 30;
    const lead = weapon?.kind === 'projectile' ? Math.min(.75, distance / speed) * difficulty.lead : .025 * difficulty.lead;
    const dx = target.pos.x + (target.vel?.x || 0) * lead - eye.x, dz = target.pos.z + (target.vel?.z || 0) * lead - eye.z;
    const flight = Math.min(1.2, distance / speed);
    const arc = weapon?.kind === 'projectile' ? .5 * (weapon.gravity || 0) * flight ** 2 - (weapon.id === 'confetti' ? 2.2 * flight : 0) : 0;
    const dy = target.pos.y + target.height * .64 + (target.vel?.y || 0) * lead * .3 + arc - eye.y;
    if (now >= ai.nextAim) {
      const airborne = actor.grounded ? 1 : 1.3, mistake = ai.mistakeUntil > now ? 1.8 : 1;
      const error = difficulty.error * profile.accuracy * airborne * mistake * (distance < 6 ? .65 : 1);
      ai.aimYawGoal = (this.random() * 2 - 1) * error; ai.aimPitchGoal = (this.random() * 2 - 1) * error * .7;
      ai.nextAim = now + .18 + this.random() * .22;
    }
    ai.aimYaw += (ai.aimYawGoal - ai.aimYaw) * Math.min(1, dt * 8); ai.aimPitch += (ai.aimPitchGoal - ai.aimPitch) * Math.min(1, dt * 8);
    actor.yaw = turnToward(actor.yaw, Math.atan2(-dx, -dz) + ai.aimYaw, difficulty.turn * dt);
    actor.pitch = approach(actor.pitch, Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz)) + ai.aimPitch)), difficulty.turn * dt * .8);
  }

  equipment(actor, ai, profile, difficulty, target, dir, distance, weapon, state) {
    const now = this.game.time;
    if (now < ai.nextEquipment) return;
    ai.nextEquipment = now + (.75 + this.random() * 1.1) * (1.15 - difficulty.equipment * .5);
    if (ai.mistakeUntil > now || this.random() > difficulty.equipment) return;
    const combat = this.game.combat, equipment = actor.equipment, health = actor.health / actor.maxHealth;
    const retreating = ['retreat', 'reload', 'heal', 'resupply'].includes(ai.mode);
    const incoming = ai.incoming && now - ai.incoming.time < .5;
    const ammoLow = this.needsAmmo(weapon, state);
    const classId = actor.classId || equipment.classId;
    let ability = false;
    if (classId === 'medic') {
      ability = health < .76;
      if (!ability && actor.team) ability = this.game.actors.some(other => other !== actor && other.alive && !this.enemies(actor, other) && other.health / other.maxHealth < .65 && distanceXZ(actor.pos, other.pos) < 6 && this.sight(actor, other));
    } else if (classId === 'engineer') ability = ammoLow;
    else if (classId === 'bulwark') ability = !!target && (health < .72 || now - actor.lastDamageAt < 1.2 || incoming);
    else if (classId === 'runner') ability = actor.grounded && Math.hypot(actor.intent.moveX, actor.intent.moveZ) > .5 && (retreating || !!target && distance > 14);
    else if (classId === 'acrobat') ability = actor.grounded && !!target && distance < 18 && (retreating || incoming || this.random() < .4);
    else if (classId === 'disruptor') ability = !!target && distance < 13;
    if (ability && combat.useAbility) {
      const movementDir = normalized3(actor.intent.moveX, .05, actor.intent.moveZ);
      combat.useAbility(actor, classId === 'runner' ? movementDir : dir);
    }
    if (actor.impulseCharge >= 100 && combat.useImpulse && ((target && distance < 7.2 && (equipment.impulseCore !== 'pull' || distance > 3)) || incoming)) {
      const impulseDir = incoming && !target ? normalized3(ai.incoming.pos.x - actor.pos.x, ai.incoming.pos.y - actor.pos.y - 1, ai.incoming.pos.z - actor.pos.z) : dir;
      combat.useImpulse(actor, impulseDir);
    }
    const tactical = equipment.tactical;
    if ((tactical === 'bubble' && (health < .55 || retreating && target)) ||
        (tactical === 'springpad' && target && distance < 10 && actor.grounded) ||
        (tactical === 'vortex' && target && distance > 4 && distance < 19) ||
        (tactical === 'booster' && (retreating || actor.intent.sprint && Math.hypot(actor.intent.moveX, actor.intent.moveZ) > .5)) ||
        (tactical === 'repulsor' && (incoming || target && distance < 8))) combat.useGadget(actor, 'tactical', dir);
    if (!target) return;
    if ((['cherry', 'cluster'].includes(equipment.lethal) && distance > 7 && distance < 23) ||
        (equipment.lethal === 'whoopee' && distance < 11 && (retreating || ai.personality === 'trickster'))) {
      combat.useGadget(actor, 'lethal', normalized3(dir.x, dir.y + (equipment.lethal !== 'whoopee' ? .2 : 0), dir.z));
    }
  }

  needsAmmo(weapon, state) {
    return !!state && (state.ammo + state.reserve < (weapon?.magazine || 10) * 1.5 || state.reserve < (weapon?.reserve || 0) * .9);
  }
}

function hash(text) { let value = 0; for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0; return value; }
function distanceXZ(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function normalized(x, z) { const length = Math.hypot(x, z); return length < 1e-6 ? { x: 0, z: 0 } : { x: x / length, z: z / length }; }
function normalized3(x, y, z) { const length = Math.hypot(x, y, z) || 1; return { x: x / length, y: y / length, z: z / length }; }
function angleDifference(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
function turnToward(value, target, step) { return value + Math.max(-step, Math.min(step, angleDifference(value, target))); }
function approach(value, target, step) { return value + Math.max(-step, Math.min(step, target - value)); }
function forward(yaw, pitch) { return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) }; }
export default AI;
