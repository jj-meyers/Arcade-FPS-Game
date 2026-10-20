import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cpus, arch, platform } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Game } from '../src/game/Game.js';

// Simulation CPU measurement only. This does not render, measure GPU frame rate,
// emulate WAN latency, or establish how the game feels on a player's machine.
const DT = 1 / 60;
const duration = 90;
const cases = [];
const percentile = (values, p) => values[Math.min(values.length - 1, Math.floor(values.length * p))];

for (const difficulty of ['easy', 'normal', 'hard', 'veteran']) {
  const game = new Game({ seed: 2031 });
  game.start({ mode: 'ffa', botCount: 12, difficulty, duration, scoreLimit: 100 });
  assert.equal(game.match.difficulty, difficulty, 'benchmark must measure the requested difficulty');
  const samples = [], counters = {}, weapons = new Set(), activeClasses = new Set();
  let maxProjectiles = 0, maxFields = 0;
  const cpuBefore = process.cpuUsage();
  const start = performance.now();
  for (let frame = 0; frame < (duration + 4) * 60 && game.match.state !== 'ended'; frame++) {
    const before = performance.now();
    game.step(DT);
    samples.push(performance.now() - before);
    for (const event of game.events) {
      counters[event.type] = (counters[event.type] || 0) + 1;
      if (event.type === 'shot') weapons.add(event.weaponId);
      if (event.type === 'ability') activeClasses.add(event.classId);
    }
    game.events.length = 0;
    maxProjectiles = Math.max(maxProjectiles, game.combat.projectiles.length);
    maxFields = Math.max(maxFields, game.combat.fields.length);
    for (const actor of game.actors) {
      assert.ok([...Object.values(actor.pos), ...Object.values(actor.vel), actor.health].every(Number.isFinite));
      assert.ok(Math.abs(actor.pos.x) <= 28 && Math.abs(actor.pos.z) <= 28 && actor.pos.y >= 0);
      assert.ok(actor.health >= 0 && actor.health <= actor.maxHealth);
    }
  }
  const elapsedMs = performance.now() - start;
  const cpu = process.cpuUsage(cpuBefore);
  samples.sort((a, b) => a - b);
  assert.equal(game.match.state, 'ended');
  assert.ok(counters.shot > 100);
  assert.ok(counters.eliminate > 0);
  const record = {
    difficulty, mode: 'ffa', bots: 12, simulatedSeconds: game.time,
    simulationSteps: samples.length, elapsedMs,
    simulationStepMs: { median: percentile(samples, .5), p95: percentile(samples, .95), p99: percentile(samples, .99), maximum: samples.at(-1) },
    cpuMs: { user: cpu.user / 1000, system: cpu.system / 1000 },
    maxProjectiles, maxFields, counters, weaponsUsed: [...weapons].sort(), classesUsingAbilities: [...activeClasses].sort(),
    finalScore: game.actors.map(({ id, kills, deaths }) => ({ id, kills, deaths })),
  };
  cases.push(record);
  console.log(`${difficulty}: ${game.time.toFixed(1)} simulated seconds, ${elapsedMs.toFixed(0)} ms wall time, p95 ${record.simulationStepMs.p95.toFixed(3)} ms/step; ${counters.shot} shots, ${counters.eliminate} eliminations, peaks ${maxProjectiles} projectiles/${maxFields} fields`);
}

mkdirSync('test-results', { recursive: true });
const report = {
  recordedAt: new Date().toISOString(), node: process.version,
  host: { platform: platform(), architecture: arch(), cpuModel: cpus()[0]?.model, logicalCpus: cpus().length },
  note: 'Seed 2031, 60 Hz simulation, 12 bots and stationary human. Includes assert/event accounting overhead in elapsed time; per-step timings isolate Game.step. No rendering, network, or hardware FPS claim. Shared host timings vary.',
  cases,
};
writeFileSync('test-results/benchmark.json', JSON.stringify(report, null, 2));
