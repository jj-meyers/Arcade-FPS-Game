export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const length = (v) => Math.hypot(v.x, v.y, v.z);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, n) => ({ x: a.x * n, y: a.y * n, z: a.z * n });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export function normalize(v) { const n = length(v); return n > 1e-8 ? mul(v, 1 / n) : { x: 0, y: 0, z: -1 }; }
export function direction(yaw, pitch = 0) { return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) }; }
export function seededRandom(seed = 98765) {
  let state = seed >>> 0;
  return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function rayBox(origin, dir, min, max, range = Infinity) {
  let near = -Infinity, far = range, normal = { x: 0, y: 0, z: 0 };
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(dir[axis]) < 1e-9) { if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null; continue; }
    let t1 = (min[axis] - origin[axis]) / dir[axis], t2 = (max[axis] - origin[axis]) / dir[axis];
    const sign = dir[axis] > 0 ? -1 : 1;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > near) { near = t1; normal = { x: 0, y: 0, z: 0 }; normal[axis] = sign; }
    far = Math.min(far, t2);
    if (near > far || far < 0) return null;
  }
  if (near > range) return null;
  const t = Math.max(0, near);
  return { distance: t, point: add(origin, mul(dir, t)), normal };
}
export function raySphere(origin, dir, center, radius, range = Infinity) {
  const delta = sub(origin, center), b = dot(delta, dir), c = dot(delta, delta) - radius * radius, det = b * b - c;
  if (det < 0) return null;
  let t = -b - Math.sqrt(det); if (t < 0) t = -b + Math.sqrt(det);
  if (t < 0 || t > range) return null;
  const point = add(origin, mul(dir, t));
  return { distance: t, point, normal: normalize(sub(point, center)) };
}
