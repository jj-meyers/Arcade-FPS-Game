import test from 'node:test';
import assert from 'node:assert/strict';
import { AI } from '../src/game/AI.js';
import { Game } from '../src/game/Game.js';

// Keep movement and damage frozen to isolate perception and timing. Real world
// raycasts and the actual weapon inventory still back these encounters.
function encounter(botCount = 1, difficulty = 'normal') {
  const game = new Game({ seed: 7 });
  game.start({ botCount, difficulty });
  game.match.state = 'playing';
  game.map = { size: 56, obstacles: [], ramps: [], spawns: [], pads: [] };
  game.ai = new AI(game);
  game.player.pos = { x: 0, y: 0, z: -12 };
  const bot = game.actors[1];
  bot.pos = { x: 0, y: 0, z: 0 };
  bot.yaw = 0;
  bot.equipment.primary = 'fizz';
  game.combat.equip(bot);
  const shots = [];
  game.combat.fire = (actor, dir) => { shots.push({ actorId: actor.id, time: game.time, dir }); return true; };
  game.combat.useGadget = () => false;
  function tick(frames = 1) {
    for (let i = 0; i < frames; i++) {
      game.time += 1 / 60;
      game.ai.update(1 / 60);
    }
  }
  return { game, bot, shots, tick };
}

test('bots acquire visible opponents but wait for their reaction latency before firing', () => {
  const { game, bot, shots, tick } = encounter();
  for (let i = 0; i < 30 && !bot.ai.targetId; i++) tick();
  assert.equal(bot.ai.targetId, game.player.id);
  const reactionAt = bot.ai.reactionAt;
  assert.ok(reactionAt - game.time > 0.2);
  while (game.time + 1 / 60 < reactionAt) tick();
  assert.equal(shots.length, 0, 'recognition should not result in an instant shot');
  tick(30);
  assert.ok(shots.length > 0);
  assert.ok(shots.every(shot => shot.time >= reactionAt));
});

test('occluded opponents cannot be shot or have their remembered position refreshed', () => {
  const { game, bot, shots, tick } = encounter();
  tick(70);
  assert.ok(shots.length > 0, 'the clear encounter should allow shooting');
  const remembered = { ...bot.ai.lastSeen };
  game.map = { ...game.map, obstacles: [{ id: 'cover', x: 0, y: 0, z: -6, w: 9, h: 4, d: 1 }] };
  game.player.pos.x = 1.5;
  shots.length = 0;
  tick(60);
  assert.equal(game.canSee(bot, game.player), false);
  assert.equal(shots.length, 0);
  assert.deepEqual(bot.ai.lastSeen, remembered, 'hidden live coordinates must not overwrite last-seen memory');
  tick(240);
  assert.equal(bot.ai.targetId, null, 'last-seen pursuit must expire');
});

test('free-for-all bots choose and fire at other bots, including when the player is absent', () => {
  const { game, bot, shots, tick } = encounter(2);
  game.player.alive = false;
  const rival = game.actors[2];
  rival.pos = { x: 0, y: 0, z: -9 };
  rival.yaw = Math.PI;
  tick(90);
  assert.equal(bot.ai.targetId, rival.id);
  assert.equal(rival.ai.targetId, bot.id);
  assert.ok(shots.some(shot => shot.actorId === bot.id));
  assert.ok(shots.some(shot => shot.actorId === rival.id));
});

test('hard difficulty reacts sooner than easy difficulty for the same encounter', () => {
  const delay = difficulty => {
    const { bot, tick } = encounter(1, difficulty);
    for (let i = 0; i < 30 && !bot.ai.targetId; i++) tick();
    return bot.ai.reactionAt - bot.ai.lastVisibleAt;
  };
  assert.ok(delay('hard') < delay('easy') * 0.5);
});
