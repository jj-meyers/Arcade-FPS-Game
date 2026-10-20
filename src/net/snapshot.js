// Snapshots are render state. The receiving browser must not step Game or Combat.
const ACTOR_KEYS = [
  'id', 'name', 'isHuman', 'team', 'color', 'personality', 'pos', 'vel', 'yaw', 'pitch', 'radius', 'height',
  'health', 'maxHealth', 'alive', 'grounded', 'kills', 'deaths', 'assists', 'respawnAt', 'invulnerableUntil',
  'equipment', 'classId', 'cosmetics', 'activeSlot', 'inventory', 'gadgetReady', 'intent', 'lastDamageAt',
  'lastDamagedBy', 'aiming', 'lastShotAt', 'abilityReady', 'impulseCharge', 'impulseReady', 'bracedUntil',
  'hasteUntil', 'slowedUntil', 'slideRemaining', 'slideCooldown', 'damageDealt', 'shotsFired', 'streak', 'bestStreak',
];
const copy = value => JSON.parse(JSON.stringify(value));

export function makeSnapshot(game, { tick, playerId, events = [] }) {
  return {
    type: 'snapshot', tick, playerId, time: game.time, match: copy(game.match),
    actors: game.actors.map(actor => {
      const result = {};
      for (const key of ACTOR_KEYS) if (actor[key] !== undefined) result[key] = actor[key];
      return copy(result);
    }),
    projectiles: copy(game.combat.projectiles.slice(0, 256)),
    fields: copy(game.combat.fields.slice(0, 128)),
    events: copy(events.slice(-256)),
  };
}

export function applySnapshot(game, snapshot, localPlayerId = snapshot?.playerId) {
  if (!snapshot || !Number.isSafeInteger(snapshot.tick) || !Number.isFinite(snapshot.time) ||
      !snapshot.match || !Array.isArray(snapshot.actors) || snapshot.actors.length > 20 ||
      !snapshot.actors.some(actor => actor.id === localPlayerId)) return false;
  // A new connection can restart its sequence at zero; NetworkClient identifies it.
  if (game.networkSession === snapshot.session && snapshot.tick <= (game.networkTick ?? -1)) return false;
  const previous = new Map(game.actors.map(actor => [actor.id, actor]));
  game.actors = snapshot.actors.map(source => {
    const actor = copy(source);
    actor.isPlayer = actor.id === localPlayerId;
    actor.prevPos = { ...(previous.get(actor.id)?.pos || actor.pos) };
    actor.ai = {};
    return actor;
  });
  game.player = game.actors.find(actor => actor.id === localPlayerId);
  game.time = snapshot.time;
  game.match = copy(snapshot.match);
  game.combat.projectiles = copy((snapshot.projectiles || []).slice(0, 256));
  game.combat.fields = copy((snapshot.fields || []).slice(0, 128));
  game.events.push(...copy((snapshot.events || []).slice(-256)));
  if (game.events.length > 512) game.events.splice(0, game.events.length - 512);
  game.networkTick = snapshot.tick;
  game.networkSession = snapshot.session;
  return true;
}
