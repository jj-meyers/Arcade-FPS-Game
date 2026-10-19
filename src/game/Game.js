import { ARENA } from '../data/arena.js';
import { DEFAULT_LOADOUT, PRESETS, PERKS } from '../data/catalog.js';
import { Combat } from './Combat.js';
import { AI } from './AI.js';
import { moveActor, worldRaycast, groundHeight } from './physics.js';
import { clamp, direction, seededRandom, distance, normalize, sub, rayBox, raySphere } from './math.js';

const BOT_NAMES = ['Sir Wobbles', 'Tax Evasion', 'Soup.exe', 'Big Crouton', 'Drama Llama', 'Microwave', 'Lil Bonk', 'Moth Boss', 'Uncle Crunch', 'Kevin?!', 'Loose Goose', 'DJ Oops'];
const COLORS = ['#e1f64b', '#ff6b82', '#5ce3cd', '#b19bff', '#ffb65d', '#6fc9ff', '#ed88ce'];
const PERSONALITIES = ['aggressive', 'cautious', 'chaotic', 'precision'];

export class Game {
  constructor({ seed = Date.now(), loadout = DEFAULT_LOADOUT } = {}) {
    this.rng = seededRandom(seed); this.map = ARENA; this.time = 0; this.events = []; this.actors = []; this.paused = false;
    this.match = { state: 'menu', countdown: 0, remaining: 180, scoreLimit: 20, difficulty: 'normal', botCount: 5, duration: 180, winnerId: null };
    this.combat = new Combat(this); this.ai = new AI(this);
    this.player = this.createActor(0, true, loadout);
    for (let i = 1; i <= 5; i++) this.createActor(i, false, this.botLoadout(i));
  }
  botLoadout(index) { const presets = Object.values(PRESETS); return { ...(presets[index % Math.max(1, presets.length)]?.loadout || DEFAULT_LOADOUT) }; }
  createActor(index, isPlayer, equipment) {
    const actor = {
      id: isPlayer ? 'player' : `bot-${index}`, name: isPlayer ? 'YOU' : BOT_NAMES[(index - 1) % BOT_NAMES.length], isPlayer,
      color: COLORS[index % COLORS.length], personality: PERSONALITIES[(index - 1 + PERSONALITIES.length) % PERSONALITIES.length],
      pos: { ...this.map.spawns[index % this.map.spawns.length] }, vel: { x: 0, y: 0, z: 0 },
      yaw: isPlayer ? 0 : this.rng() * Math.PI * 2, pitch: 0, radius: .45, height: 1.8,
      health: 100, maxHealth: 100, alive: true, grounded: true, kills: 0, deaths: 0,
      respawnAt: 0, invulnerableUntil: 0, equipment: { ...equipment }, activeSlot: 0,
      inventory: {}, gadgetReady: {}, ai: {}, intent: {}, lastDamageAt: -999, lastDamagedBy: null, aiming: false,
    };
    actor.prevPos = { ...actor.pos };
    this.actors.push(actor); this.combat.equip(actor); return actor;
  }
  start(config = {}, loadout = DEFAULT_LOADOUT) {
    this.time = 0; this.events.length = 0; this.paused = false; this.actors = [];
    this.match = { state: 'countdown', countdown: 3, remaining: clamp(Number(config.duration) || 180, 30, 900), duration: clamp(Number(config.duration) || 180, 30, 900), scoreLimit: clamp(Math.round(Number(config.scoreLimit) || 20), 1, 100), botCount: clamp(Math.round(Number(config.botCount) || 5), 1, 12), difficulty: ['easy','normal','hard'].includes(config.difficulty) ? config.difficulty : 'normal', winnerId: null, endReason: null };
    this.combat = new Combat(this); this.ai = new AI(this);
    this.player = this.createActor(0, true, loadout);
    for (let i = 1; i <= this.match.botCount; i++) this.createActor(i, false, this.botLoadout(i + Math.floor(this.rng() * 8)));
    this.emit({ type: 'matchStart' });
  }
  emit(event) { this.events.push({ time: this.time, ...event }); if (this.events.length > 2000) this.events.splice(0, this.events.length - 2000); }
  getActor(id) { return this.actors.find(a => a.id === id); }
  eye(actor) { return { x: actor.pos.x, y: actor.pos.y + actor.height * .9, z: actor.pos.z }; }
  groundHeight(x, z) { return groundHeight(this.map, x, z); }
  worldRaycast(origin, dir, range) { return worldRaycast(this.map, origin, dir, range); }
  raycast(origin, dir, range, ignoreId = null) {
    let hit = this.worldRaycast(origin, dir, range);
    for (const actor of this.actors) {
      if (!actor.alive || actor.id === ignoreId) continue;
      const p = actor.pos, h = actor.height, r = actor.radius;
      const body = rayBox(origin, dir, { x: p.x - r, y: p.y + .1, z: p.z - r }, { x: p.x + r, y: p.y + h * .71, z: p.z + r }, range);
      const head = raySphere(origin, dir, { x: p.x, y: p.y + h * .82, z: p.z }, r * .87, range);
      for (const [test, headshot] of [[body, false], [head, true]]) if (test && (!hit || test.distance < hit.distance)) hit = { ...test, actor, headshot, obstacle: null };
    }
    return hit;
  }
  canSee(a, b) {
    if (!a.alive || !b.alive) return false;
    const from = this.eye(a), to = { ...b.pos, y: b.pos.y + b.height * .65 }, d = distance(from, to);
    const hit = this.worldRaycast(from, normalize(sub(to, from)), d);
    return !hit || hit.distance >= d - .05;
  }
  addImpulse(actor, impulse) {
    if (!actor.alive || !impulse) return;
    const resistance = PERKS[actor.equipment.perk]?.impulseResistance || 1;
    for (const key of ['x','y','z']) actor.vel[key] = clamp(actor.vel[key] + (Number(impulse[key]) || 0) * resistance, -32, 32);
    if (impulse.y > 1) actor.grounded = false;
  }
  damage(target, amount, { attackerId = null, weaponId = '', headshot = false, impulse = null } = {}) {
    if (this.match.state !== 'playing' || !target?.alive || this.time < target.invulnerableUntil || amount <= 0) return false;
    this.addImpulse(target, impulse); const dealt = Math.min(target.health, amount); target.health = Math.max(0, target.health - amount);
    target.lastDamageAt = this.time; target.lastDamagedBy = attackerId;
    this.emit({ type: 'damage', actorId: target.id, attackerId, amount: dealt, headshot, point: { ...target.pos, y: target.pos.y + 1 } });
    if (target.health === 0) {
      target.alive = false; target.deaths++; target.respawnAt = this.time + 2.8; target.intent = {};
      const attacker = this.getActor(attackerId);
      if (attacker && attacker !== target) attacker.kills++;
      this.emit({ type: 'eliminate', actorId: target.id, attackerId, weaponId, headshot, point: { ...target.pos, y: target.pos.y + .8 }, color: target.color });
      if (attacker && attacker.kills >= this.match.scoreLimit) this.end('score');
    }
    return true;
  }
  rankings() { return [...this.actors].sort((a,b) => b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name)); }
  end(reason) {
    if (this.match.state === 'ended') return;
    this.match.state = 'ended'; this.match.endReason = reason; this.match.winnerId = this.rankings()[0]?.id;
    this.emit({ type: 'matchEnd', winnerId: this.match.winnerId, reason });
  }
  respawn(actor) {
    // Score candidate spawns by nearest opponent; slight seeded variety breaks patterns.
    let best = this.map.spawns[0], score = -Infinity;
    for (const point of this.map.spawns) {
      const enemies = this.actors.filter(a => a !== actor && a.alive);
      const value = (enemies.length ? Math.min(...enemies.map(a => distance(a.pos, point))) : 30) + this.rng() * 3;
      if (value > score) { score = value; best = point; }
    }
    actor.pos = { ...best }; actor.prevPos = { ...best }; actor.vel = { x: 0, y: 0, z: 0 }; actor.alive = true; actor.health = actor.maxHealth;
    actor.height = 1.8; actor.grounded = true; actor.invulnerableUntil = this.time + 1.3; actor.ai = {}; actor.intent = {}; actor.pitch = 0;
    actor.yaw = Math.atan2(actor.pos.x, actor.pos.z); actor.lastDamageAt = -999; actor.lastDamagedBy = null; actor.activeSlot = 0;
    this.combat.equip(actor); this.emit({ type: 'spawn', actorId: actor.id, point: { ...actor.pos } });
  }
  setPaused(value) { this.paused = !!value; }
  step(dt, input = {}) {
    if (this.paused || !['countdown','playing'].includes(this.match.state)) return;
    if (!(dt > 0) || dt > .1) return;
    this.time += dt;
    const player = this.player;
    if (Number.isFinite(input.yaw)) player.yaw = input.yaw;
    if (Number.isFinite(input.pitch)) player.pitch = clamp(input.pitch, -1.48, 1.48);
    if (this.match.state === 'countdown') {
      this.match.countdown = Math.max(0, this.match.countdown - dt);
      if (this.match.countdown <= 1e-6) { this.match.state = 'playing'; this.match.countdown = 0; this.emit({ type: 'go' }); }
      return;
    }
    this.match.remaining = Math.max(0, this.match.remaining - dt);
    if (this.match.remaining <= 1e-6) { this.end('time'); return; }
    for (const actor of this.actors) if (!actor.alive && this.time >= actor.respawnAt) this.respawn(actor);
    if (player.alive) {
      const yaw = player.yaw, mx = input.moveX || 0, mz = input.moveZ || 0;
      player.intent = { moveX: Math.cos(yaw) * mx - Math.sin(yaw) * mz, moveZ: -Math.sin(yaw) * mx - Math.cos(yaw) * mz, sprint: !!input.sprint && !input.alt, crouch: !!input.crouch, jump: !!input.jump };
      player.aiming = !!input.alt;
      if (input.switchSlot === 0 || input.switchSlot === 1) this.combat.switchWeapon(player, input.switchSlot);
      if (input.reload) this.combat.reload(player);
      const dir = direction(player.yaw, player.pitch);
      if (input.tactical) this.combat.useGadget(player, 'tactical', dir);
      if (input.lethal) this.combat.useGadget(player, 'lethal', dir);
      if (input.fire) this.combat.fire(player, dir, !!input.alt);
    }
    this.ai.update(dt);
    if (this.match.state !== 'playing') return;
    for (const actor of this.actors) if (actor.alive) {
      actor.prevPos = { ...actor.pos };
      moveActor(actor, dt, this.map, PERKS[actor.equipment.perk], event => this.emit(event));
    }
    this.combat.update(dt);
  }
}
