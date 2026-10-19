// Static ground navigation. Geometry is inflated by the actor radius, so paths
// remain useful to the physical character instead of skimming wall edges.
export class NavigationGrid {
  constructor(map, { cellSize = 1.4, clearance = 0.62 } = {}) {
    this.map = map;
    this.size = map.size || 56;
    this.count = Math.ceil(this.size / cellSize);
    this.cellSize = this.size / this.count;
    this.half = this.size / 2;
    this.clearance = clearance;
    this.rects = [...(map.obstacles || []), ...(map.ramps || [])]
      .filter(box => box.w > 0 && box.d > 0)
      .map(box => ({
        minX: box.x - box.w / 2 - clearance,
        maxX: box.x + box.w / 2 + clearance,
        minZ: box.z - box.d / 2 - clearance,
        maxZ: box.z + box.d / 2 + clearance,
      }));
    this.walkable = new Uint8Array(this.count * this.count);
    this.free = [];
    for (let id = 0; id < this.walkable.length; id++) {
      const point = this.point(id);
      if (this.isWalkable(point.x, point.z)) {
        this.walkable[id] = 1;
        this.free.push(id);
      }
    }
    this.neighbors = new Array(this.walkable.length);
    for (const id of this.free) {
      const x = id % this.count;
      const z = Math.floor(id / this.count);
      this.neighbors[id] = [];
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dz) || x + dx < 0 || x + dx >= this.count || z + dz < 0 || z + dz >= this.count) continue;
          const next = id + dx + dz * this.count;
          if (!this.walkable[next]) continue;
          // Never squeeze diagonally through the corner of two blocked cells.
          if (dx && dz && (!this.walkable[id + dx] || !this.walkable[id + dz * this.count])) continue;
          if (!this.segmentClear(this.point(id), this.point(next))) continue;
          this.neighbors[id].push({ id: next, cost: dx && dz ? Math.SQRT2 : 1 });
        }
      }
    }
  }

  point(id) {
    return {
      x: (id % this.count + 0.5) * this.cellSize - this.half,
      y: 0,
      z: (Math.floor(id / this.count) + 0.5) * this.cellSize - this.half,
    };
  }

  isWalkable(x, z) {
    const edge = this.half - this.clearance;
    return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < edge && Math.abs(z) < edge &&
      !this.rects.some(box => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ);
  }

  segmentClear(from, to) {
    if (!this.isWalkable(from.x, from.z) || !this.isWalkable(to.x, to.z)) return false;
    return !this.rects.some(box => intersectsRectangle(from, to, box));
  }

  nearestId(point) {
    let best = -1;
    let bestDistance = Infinity;
    const fromFree = this.isWalkable(point.x, point.z);
    for (const id of this.free) {
      const candidate = this.point(id);
      const distance = (candidate.x - point.x) ** 2 + (candidate.z - point.z) ** 2;
      if (distance >= bestDistance || (fromFree && !this.segmentClear(point, candidate))) continue;
      best = id;
      bestDistance = distance;
    }
    return best;
  }

  findPath(from, to) {
    if (this.segmentClear(from, to)) return [{ x: to.x, y: 0, z: to.z }];
    const start = this.nearestId(from);
    const goal = this.nearestId(to);
    if (start < 0 || goal < 0) return [];
    const scores = new Float64Array(this.walkable.length).fill(Infinity);
    const previous = new Int32Array(this.walkable.length).fill(-1);
    const closed = new Uint8Array(this.walkable.length);
    const queue = new MinHeap();
    const goalX = goal % this.count;
    const goalZ = Math.floor(goal / this.count);
    const heuristic = id => {
      const dx = Math.abs(id % this.count - goalX);
      const dz = Math.abs(Math.floor(id / this.count) - goalZ);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    scores[start] = 0;
    queue.push(start, heuristic(start));
    while (queue.length) {
      const current = queue.pop();
      if (closed[current]) continue;
      if (current === goal) {
        const route = [];
        for (let id = current; id >= 0; id = previous[id]) route.push(this.point(id));
        route.reverse();
        if (this.segmentClear(route[route.length - 1], to)) route.push({ x: to.x, y: 0, z: to.z });
        return this.smooth(from, route);
      }
      closed[current] = 1;
      for (const next of this.neighbors[current] || []) {
        const score = scores[current] + next.cost;
        if (closed[next.id] || score >= scores[next.id]) continue;
        scores[next.id] = score;
        previous[next.id] = current;
        queue.push(next.id, score + heuristic(next.id));
      }
    }
    return [];
  }

  smooth(from, route) {
    const result = [];
    let current = from;
    let index = 0;
    while (index < route.length) {
      let furthest = index;
      for (let next = route.length - 1; next > index; next--) {
        if (this.segmentClear(current, route[next])) { furthest = next; break; }
      }
      result.push(route[furthest]);
      current = route[furthest];
      index = furthest + 1;
    }
    return result;
  }

  randomPoint(rng = Math.random, origin = null, minDistance = 6) {
    if (!this.free.length) return { x: 0, y: 0, z: 0 };
    let point;
    for (let attempt = 0; attempt < 24; attempt++) {
      point = this.point(this.free[Math.floor(rng() * this.free.length) % this.free.length]);
      if (!origin || Math.hypot(point.x - origin.x, point.z - origin.z) >= minDistance) return point;
    }
    return point;
  }
}

function intersectsRectangle(from, to, box) {
  let near = 0;
  let far = 1;
  for (const axis of ['X', 'Z']) {
    const key = axis.toLowerCase();
    const delta = to[key] - from[key];
    if (Math.abs(delta) < 1e-8) {
      if (from[key] < box[`min${axis}`] || from[key] > box[`max${axis}`]) return false;
      continue;
    }
    let a = (box[`min${axis}`] - from[key]) / delta;
    let b = (box[`max${axis}`] - from[key]) / delta;
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return false;
  }
  return true;
}

class MinHeap {
  constructor() { this.items = []; }
  get length() { return this.items.length; }
  push(id, priority) {
    const item = { id, priority };
    let index = this.items.length;
    this.items.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].priority <= priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    const result = this.items[0].id;
    const last = this.items.pop();
    if (!this.items.length) return result;
    let index = 0;
    while (true) {
      let child = index * 2 + 1;
      if (child >= this.items.length) break;
      if (child + 1 < this.items.length && this.items[child + 1].priority < this.items[child].priority) child++;
      if (last.priority <= this.items[child].priority) break;
      this.items[index] = this.items[child];
      index = child;
    }
    this.items[index] = last;
    return result;
  }
}

export default NavigationGrid;
