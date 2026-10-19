import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationGrid } from '../src/game/navigation.js';

const obstacle = (x, z, w, d) => ({ x, y: 0, z, w, h: 3, d });

test('navigation detours around cover and all smoothed segments respect actor clearance', () => {
  const nav = new NavigationGrid({ size: 28, obstacles: [obstacle(0, 0, 4, 12)], ramps: [] });
  const from = { x: -10, z: 0 };
  const goal = { x: 10, z: 0 };
  assert.equal(nav.segmentClear(from, goal), false);
  const path = nav.findPath(from, goal);
  assert.ok(path.length >= 2, 'route must bend around the wall');
  let previous = from;
  for (const point of path) {
    assert.equal(nav.segmentClear(previous, point), true, `route crossed geometry at ${JSON.stringify(point)}`);
    previous = point;
  }
  assert.deepEqual(path.at(-1), { ...goal, y: 0 });
});

test('sealed walls return no route instead of steering through a blocked cell', () => {
  const nav = new NavigationGrid({ size: 20, obstacles: [obstacle(0, 0, 2, 20)] });
  assert.deepEqual(nav.findPath({ x: -6, z: 0 }, { x: 6, z: 0 }), []);
});

test('thin geometry and diagonal corner gaps cannot be shortcut by path smoothing', () => {
  const nav = new NavigationGrid({ size: 20, obstacles: [obstacle(0.2, 0, 0.15, 12), obstacle(3, 4, 4, 0.15)] });
  const from = { x: -6, z: 0 };
  const path = nav.findPath(from, { x: 6, z: 0 });
  assert.ok(path.length);
  let previous = from;
  for (const point of path) {
    assert.ok(nav.segmentClear(previous, point));
    previous = point;
  }
  assert.equal(nav.isWalkable(0.65, 0), false, 'clearance must include the actor radius');
});

test('a bot displaced into a blocked footprint can recover to a free waypoint', () => {
  const nav = new NavigationGrid({ size: 20, obstacles: [obstacle(0, 0, 4, 4)] });
  const path = nav.findPath({ x: 0, z: 0 }, { x: 7, z: 7 });
  assert.ok(path.length > 0);
  assert.ok(path.every(point => nav.isWalkable(point.x, point.z)));
});

test('roaming destinations are reproducible, bounded and avoid ramps', () => {
  const nav = new NavigationGrid({ size: 20, ramps: [obstacle(0, 0, 6, 8)], obstacles: [] });
  assert.equal(nav.isWalkable(0, 0), false);
  assert.equal(nav.isWalkable(10, 0), false);
  assert.deepEqual(nav.randomPoint(() => 0.7), nav.randomPoint(() => 0.7));
  for (let n = 0; n < 20; n++) {
    const point = nav.randomPoint(() => n / 20);
    assert.ok(nav.isWalkable(point.x, point.z));
  }
});
