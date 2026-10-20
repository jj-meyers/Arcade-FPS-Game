// Static ground navigation. Geometry is inflated by the actor radius, so paths
// remain useful to the physical character instead of skimming wall edges.
export class NavigationGrid {
  constructor(map, { cellSize = 1.4, clearance = 0.62, traverseRamps = false } = {}) {
    this.map = map;
    this.size = map.size || 56;
    this.count = Math.ceil(this.size / cellSize);
    this.cellSize = this.size / this.count;
    this.half = this.size / 2;
    this.clearance = clearance;
    this.traverseRamps = traverseRamps;
    this.obstacles = map.obstacles || [];
    this.ramps = map.ramps || [];
    this.lastExpanded = 0;
    this.positions = new Array(this.count * this.count);
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
    // Roaming may choose a ramp/platform reached from the ground, but never an
    // isolated rooftop that would require an unavailable jump or teleport.
    this.roamable = this.free;
    if (traverseRamps) {
      const reachable = new Uint8Array(this.walkable.length);
      const queue = this.free.filter(id => this.point(id).y < 0.05);
      for (const id of queue) reachable[id] = 1;
      for (let cursor = 0; cursor < queue.length; cursor++) for (const edge of this.neighbors[queue[cursor]] || []) {
        if (!reachable[edge.id]) { reachable[edge.id] = 1; queue.push(edge.id); }
      }
      this.roamable = queue;
    }
  }

  point(id) {
    if (this.positions[id]) return this.positions[id];
    const x = (id % this.count + 0.5) * this.cellSize - this.half;
    const z = (Math.floor(id / this.count) + 0.5) * this.cellSize - this.half;
    return this.positions[id] = { x, y: this.surfaceHeight(x, z), z };
  }

  surfaceHeight(x, z) {
    if (!this.traverseRamps) return 0;
    let height = 0;
    for (const box of this.obstacles) if (Math.abs(x - box.x) <= box.w / 2 && Math.abs(z - box.z) <= box.d / 2) height = Math.max(height, (box.y || 0) + box.h);
    for (const ramp of this.ramps) if (Math.abs(x - ramp.x) <= ramp.w / 2 && Math.abs(z - ramp.z) <= ramp.d / 2) {
      height = Math.max(height, (z - ramp.z + ramp.d / 2) / ramp.d * ramp.h);
    }
    return height;
  }

  isWalkable(x, z) {
    const edge = this.half - this.clearance;
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) >= edge || Math.abs(z) >= edge) return false;
    if (!this.traverseRamps) return !this.rects.some(box => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ);
    const height = this.surfaceHeight(x, z);
    for (const box of this.obstacles) {
      if (Math.abs(x - box.x) < box.w / 2 + this.clearance && Math.abs(z - box.z) < box.d / 2 + this.clearance && height < (box.y || 0) + box.h - 0.26) return false;
    }
    for (const ramp of this.ramps) {
      // Stay away from raised ramp side edges. The low entrance remains open.
      const progress = Math.max(0, Math.min(1, (z - ramp.z + ramp.d / 2) / ramp.d));
      if (Math.abs(x - ramp.x) < ramp.w / 2 + this.clearance && Math.abs(z - ramp.z) < ramp.d / 2 + this.clearance) {
        if (height < progress * ramp.h - 0.04) return false;
        if (progress * ramp.h > 0.28 && Math.abs(x - ramp.x) > ramp.w / 2 - this.clearance && height <= progress * ramp.h + 0.04) return false;
      }
    }
    return true;
  }

  segmentClear(from, to) {
    if (!this.isWalkable(from.x, from.z) || !this.isWalkable(to.x, to.z)) return false;
    if (this.traverseRamps) {
      const distance = Math.hypot(to.x - from.x, to.z - from.z);
      const steps = Math.max(1, Math.ceil(distance / 0.24));
      let previousHeight = this.surfaceHeight(from.x, from.z);
      for (let i = 1; i <= steps; i++) {
        const x = from.x + (to.x - from.x) * i / steps;
        const z = from.z + (to.z - from.z) * i / steps;
        if (!this.isWalkable(x, z)) return false;
        const height = this.surfaceHeight(x, z);
        // Physics allows low steps and downhill drops, not climbing box faces.
        if (height - previousHeight > 0.26 || previousHeight - height > 3) return false;
        previousHeight = height;
      }
      return true;
    }
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

  nearestGroundPoint(from) {
    let best = null, distance = Infinity;
    for (const id of this.free) {
      const point = this.point(id);
      if (point.y > .1) continue;
      const candidate = (point.x - from.x) ** 2 + (point.z - from.z) ** 2;
      if (candidate < distance) { distance = candidate; best = point; }
    }
    return best ? { ...best } : null;
  }

  findPath(from, to, { maxExpanded = 1600 } = {}) {
    this.lastExpanded = 0;
    if (this.segmentClear(from, to)) return [{ x: to.x, y: this.surfaceHeight(to.x, to.z), z: to.z }];
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
      if (this.lastExpanded >= maxExpanded) return [];
      this.lastExpanded++;
      if (current === goal) {
        const route = [];
        for (let id = current; id >= 0; id = previous[id]) route.push(this.point(id));
        route.reverse();
        if (this.segmentClear(route[route.length - 1], to)) route.push({ x: to.x, y: this.surfaceHeight(to.x, to.z), z: to.z });
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
    if (!this.roamable.length) return { x: 0, y: 0, z: 0 };
    let point;
    for (let attempt = 0; attempt < 24; attempt++) {
      point = this.point(this.roamable[Math.floor(rng() * this.roamable.length) % this.roamable.length]);
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
