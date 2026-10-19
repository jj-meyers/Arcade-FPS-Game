import test from 'node:test';
import assert from 'node:assert/strict';
import { moveActor, groundHeight, rampHeight, worldRaycast } from '../src/game/physics.js';
import { normalize } from '../src/game/math.js';
import { ARENA } from '../src/data/arena.js';

const flatMap = (obstacles = [], ramps = []) => ({ size: 56, obstacles, ramps });
const actor = (pos = { x: 0, y: 0, z: 0 }) => ({
  id: 'test', pos: { ...pos }, vel: { x: 0, y: 0, z: 0 },
  radius: 0.45, height: 1.8, grounded: true, intent: {},
});
const moveFor = (body, seconds, map = flatMap(), fps = 60, events = []) => {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) {
    moveActor(body, 1 / fps, map, {}, event => events.push(event));
  }
  return body;
};
const near = (actual, expected, epsilon = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
};

test('movement remains consistent across 30, 60 and 120 Hz updates', () => {
  const positions = [30, 60, 120].map(fps => {
    const body = actor();
    body.intent = { moveX: 1 };
    moveFor(body, 2, flatMap(), fps);
    near(body.vel.x, 6.5);
    near(body.pos.y, 0);
    return body.pos.x;
  });
  assert.ok(Math.max(...positions) - Math.min(...positions) < 0.12);
  assert.ok(positions.every(value => value > 12 && value < 13));
});

test('diagonal input is normalized and sprint/crouch alter real movement', () => {
  const walk = actor(), diagonal = actor(), sprint = actor(), crouch = actor();
  walk.intent = { moveX: 1 };
  diagonal.intent = { moveX: 1, moveZ: 1 };
  sprint.intent = { moveX: 1, sprint: true };
  crouch.intent = { moveX: 1, crouch: true };
  for (const body of [walk, diagonal, sprint, crouch]) moveFor(body, 1);
  near(Math.hypot(diagonal.vel.x, diagonal.vel.z), walk.vel.x);
  assert.ok(sprint.pos.x > walk.pos.x);
  assert.ok(crouch.pos.x < walk.pos.x);
  assert.ok(crouch.height < walk.height);
});

test('cover blocks running actors while preserving motion along its face', () => {
  const box = { id: 'cover', x: 0, y: 0, z: 0, w: 2, h: 3, d: 12 };
  const body = actor({ x: -4, y: 0, z: 0 });
  body.intent = { moveX: 1, moveZ: 0.3, sprint: true };
  moveFor(body, 1, flatMap([box]));
  near(body.pos.x, -1 - body.radius);
  assert.ok(body.pos.z > 1);
  near(body.pos.y, 0);
});

test('high momentum does not tunnel through thin cover or arena boundaries', () => {
  const box = { id: 'thin', x: 0, y: 0, z: 0, w: 0.2, h: 3, d: 4 };
  const body = actor({ x: -1, y: 0.1, z: 0 });
  body.grounded = false;
  body.vel.x = 32;
  moveActor(body, 0.1, flatMap([box]));
  assert.ok(body.pos.x <= -box.w / 2 - body.radius + 1e-6);
  const boundaryRunner = actor({ x: 27, y: 0, z: 0 });
  boundaryRunner.intent = { moveX: 1, sprint: true };
  moveFor(boundaryRunner, 2);
  near(boundaryRunner.pos.x, 28 - boundaryRunner.radius);
  near(boundaryRunner.vel.x, 0);
});

test('jump has an airborne arc, rejects an airborne jump, and lands once', () => {
  const body = actor(), events = [];
  body.intent = { jump: true };
  moveActor(body, 1 / 60, flatMap(), {}, event => events.push(event));
  assert.equal(body.grounded, false);
  assert.ok(body.vel.y > 0);
  const initialVelocity = body.vel.y;
  moveActor(body, 1 / 60, flatMap(), {}, event => events.push(event));
  assert.ok(body.vel.y < initialVelocity, 'holding jump in air must not reset vertical velocity');
  body.intent = {};
  let apex = body.pos.y;
  for (let frame = 0; frame < 90; frame++) {
    moveActor(body, 1 / 60, flatMap(), {}, event => events.push(event));
    apex = Math.max(apex, body.pos.y);
  }
  assert.ok(apex > 1.5 && apex < 1.8);
  near(body.pos.y, 0);
  assert.equal(body.grounded, true);
  assert.equal(events.filter(event => event.type === 'jump').length, 1);
  assert.equal(events.filter(event => event.type === 'land').length, 1);
});

test('the real arena ramp can be walked up and onto its platform', () => {
  const body = actor({ x: 2, y: 0, z: 1.5 });
  body.intent = { moveZ: 1 };
  moveFor(body, 1.8, ARENA);
  assert.ok(body.pos.z > 10.5 && body.pos.z < 15.5, `ramp traversal ended at z=${body.pos.z}`);
  near(body.pos.y, 2.4);
  assert.equal(body.grounded, true);
  body.intent = { moveZ: -1 };
  moveFor(body, 2, ARENA);
  assert.ok(body.pos.z < 2.5);
  near(body.pos.y, 0);
});

test('high ramp ends block side entry instead of teleporting onto the top', () => {
  const ramp = { id: 'ramp', x: 0, z: 0, w: 4, d: 8, h: 3 };
  const body = actor({ x: 0, y: 0, z: 6 });
  body.intent = { moveZ: -1 };
  moveFor(body, 1, flatMap([], [ramp]));
  assert.ok(body.pos.z >= 4);
  near(body.pos.y, 0);
  near(rampHeight(ramp, 0, 0), 1.5);
  assert.equal(rampHeight(ramp, 3, 0), null);
});

test('ground queries respect the available height and raycasts hit the slope exactly', () => {
  const ramp = { id: 'slope', x: 0, z: 0, w: 4, d: 8, h: 4 };
  const map = flatMap([{ id: 'box', x: 8, y: 0, z: 0, w: 2, h: 3, d: 2 }], [ramp]);
  near(groundHeight(map, 0, 0), 2);
  near(groundHeight(map, 8, 0, 1), 0);
  near(groundHeight(map, 8, 0, 4), 3);
  const hit = worldRaycast(map, { x: 0, y: 8, z: 0 }, { x: 0, y: -1, z: 0 }, 20);
  assert.equal(hit.obstacle.id, 'slope');
  near(hit.distance, 6);
  near(hit.point.y, 2);
  near(Math.hypot(hit.normal.x, hit.normal.y, hit.normal.z), 1);
  assert.ok(hit.normal.z < 0);
});

test('world rays select the nearest surface and obey their maximum range', () => {
  const map = flatMap([{ id: 'cover', x: 0, y: 0, z: -5, w: 2, h: 3, d: 2 }]);
  const origin = { x: 0, y: 1, z: 0 }, forward = { x: 0, y: 0, z: -1 };
  assert.equal(worldRaycast(map, origin, forward, 3), null);
  const cover = worldRaycast(map, origin, forward, 30);
  assert.equal(cover.obstacle.id, 'cover');
  near(cover.distance, 4);
  assert.deepEqual(cover.normal, { x: 0, y: 0, z: 1 });
  const boundary = worldRaycast(flatMap(), origin, { x: 1, y: 0, z: 0 }, 40);
  assert.equal(boundary.obstacle.id, 'boundary');
  near(boundary.distance, 28);
  const floor = worldRaycast(flatMap(), origin, normalize({ x: 1, y: -1, z: 0 }), 5);
  assert.equal(floor.obstacle.id, 'floor');
  near(floor.point.y, 0);
});
