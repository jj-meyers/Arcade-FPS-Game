import { clamp, rayBox, add, mul } from './math.js';

export function rampHeight(r, x, z, margin = 0) {
  if (Math.abs(x - r.x) > r.w / 2 + margin || Math.abs(z - r.z) > r.d / 2 + margin) return null;
  return clamp((z - (r.z - r.d / 2)) / r.d, 0, 1) * r.h;
}
export function groundHeight(map, x, z, maxY = Infinity) {
  let h = 0;
  for (const b of map.obstacles) if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2 && b.y + b.h <= maxY) h = Math.max(h, b.y + b.h);
  for (const r of map.ramps) { const rh = rampHeight(r, x, z); if (rh !== null && rh <= maxY) h = Math.max(h, rh); }
  return h;
}

export function moveActor(actor, dt, map, perk = {}, emit = () => {}) {
  const intent = actor.intent || {}, prevGrounded = actor.grounded;
  const crouching = !!intent.crouch && actor.grounded;
  actor.height = crouching ? 1.18 : 1.8;
  const speed = (crouching ? 3.6 : intent.sprint ? 10 : 6.5) * (perk.moveSpeed || 1);
  let mx = intent.moveX || 0, mz = intent.moveZ || 0;
  const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
  const accel = actor.grounded ? (m ? 40 : 28) : 10;
  const change = (target, current) => current + clamp(target - current, -accel * dt, accel * dt);
  actor.vel.x = change(mx * speed, actor.vel.x); actor.vel.z = change(mz * speed, actor.vel.z);
  if (intent.jump && actor.grounded) {
    actor.vel.y = 9 * (perk.jump || 1); actor.grounded = false;
    emit({ type: 'jump', actorId: actor.id, point: { ...actor.pos } });
  }
  const fallSpeed = actor.vel.y;
  actor.vel.y = Math.max(-38, actor.vel.y - 24 * dt);
  const steps = Math.max(1, Math.ceil(Math.hypot(actor.vel.x, actor.vel.y, actor.vel.z) * dt / .24));
  const step = dt / steps, limit = map.size / 2 - actor.radius;
  let landed = false;
  for (let i = 0; i < steps; i++) {
    const oldY = actor.pos.y;
    for (const axis of ['x', 'z']) {
      const other = axis === 'x' ? 'z' : 'x';
      const old = actor.pos[axis];
      actor.pos[axis] = clamp(old + actor.vel[axis] * step, -limit, limit);
      if (actor.pos[axis] === -limit || actor.pos[axis] === limit) actor.vel[axis] = 0;
      for (const b of map.obstacles) {
        const half = (axis === 'x' ? b.w : b.d) / 2, otherHalf = (axis === 'x' ? b.d : b.w) / 2;
        if (Math.abs(actor.pos[other] - b[other]) >= otherHalf + actor.radius || Math.abs(actor.pos[axis] - b[axis]) >= half + actor.radius) continue;
        if (actor.pos.y >= b.y + b.h - .025 || actor.pos.y + actor.height <= b.y) continue;
        if (b.y + b.h <= actor.pos.y + .28 && actor.grounded) { actor.pos.y = b.y + b.h; continue; }
        actor.pos[axis] = old <= b[axis] ? b[axis] - half - actor.radius : b[axis] + half + actor.radius;
        actor.vel[axis] = 0;
      }
      for (const r of map.ramps) {
        const h = rampHeight(r, actor.pos.x, actor.pos.z, actor.radius * .5);
        if (h !== null && h > actor.pos.y + .35) { actor.pos[axis] = old; actor.vel[axis] = 0; }
      }
    }
    actor.pos.y += actor.vel.y * step;
    let floor = groundHeight(map, actor.pos.x, actor.pos.z, Math.max(oldY, actor.pos.y) + .34);
    // Let the capsule retain support near an edge, but never pull it up through a box.
    for (const b of map.obstacles) if (Math.abs(actor.pos.x - b.x) < b.w / 2 + actor.radius * .65 && Math.abs(actor.pos.z - b.z) < b.d / 2 + actor.radius * .65 && oldY >= b.y + b.h - .035) floor = Math.max(floor, b.y + b.h);
    if (actor.pos.y <= floor && actor.vel.y <= 0) {
      actor.pos.y = floor; actor.vel.y = 0; landed = true; actor.grounded = true;
    } else if (actor.pos.y > floor + .05) actor.grounded = false;
  }
  if (landed && !prevGrounded && fallSpeed < -3) emit({ type: 'land', actorId: actor.id, point: { ...actor.pos }, strength: Math.min(1, -fallSpeed / 20) });
  if (!Number.isFinite(actor.pos.x + actor.pos.y + actor.pos.z)) { actor.pos = { x: 0, y: 4, z: 22 }; actor.vel = { x: 0, y: 0, z: 0 }; }
}

export function worldRaycast(map, origin, dir, range) {
  let result = null;
  const take = (hit, obstacle) => { if (hit && hit.distance <= range && (!result || hit.distance < result.distance)) result = { ...hit, obstacle, actor: null, headshot: false }; };
  for (const b of map.obstacles) take(rayBox(origin, dir, { x: b.x - b.w / 2, y: b.y, z: b.z - b.d / 2 }, { x: b.x + b.w / 2, y: b.y + b.h, z: b.z + b.d / 2 }, range), b);
  // Exact sloped top plane plus solid side/end surfaces for each simple wedge.
  for (const r of map.ramps) {
    const slope = r.h / r.d, z0 = r.z - r.d / 2;
    const denom = dir.y - slope * dir.z;
    if (Math.abs(denom) > 1e-9) {
      const t = (slope * (origin.z - z0) - origin.y) / denom;
      const point = add(origin, mul(dir, t));
      if (t >= 0 && Math.abs(point.x - r.x) <= r.w / 2 && point.z >= z0 && point.z <= z0 + r.d) take({ distance: t, point, normal: { x: 0, y: 1 / Math.hypot(1, slope), z: -slope / Math.hypot(1, slope) } }, r);
    }
    for (const [axis, value, normal] of [['x', r.x - r.w / 2, {x:-1,y:0,z:0}], ['x', r.x + r.w / 2, {x:1,y:0,z:0}], ['z', r.z + r.d / 2, {x:0,y:0,z:1}]]) {
      if (Math.abs(dir[axis]) < 1e-9) continue;
      const t = (value - origin[axis]) / dir[axis], point = add(origin, mul(dir, t));
      const h = rampHeight(r, point.x, point.z, 1e-6);
      if (t >= 0 && h !== null && point.y >= 0 && point.y <= h) take({distance:t,point,normal},r);
    }
  }
  if (dir.y < -1e-9) { const t = -origin.y / dir.y; if (t >= 0) take({ distance: t, point: add(origin, mul(dir, t)), normal: {x:0,y:1,z:0} }, {id:'floor'}); }
  for (const axis of ['x', 'z']) if (Math.abs(dir[axis]) > 1e-9) {
    const side = dir[axis] > 0 ? 1 : -1, t = (side * map.size / 2 - origin[axis]) / dir[axis];
    if (t >= 0) { const normal = {x:0,y:0,z:0}; normal[axis] = -side; take({distance:t,point:add(origin,mul(dir,t)),normal}, {id:'boundary'}); }
  }
  return result;
}
