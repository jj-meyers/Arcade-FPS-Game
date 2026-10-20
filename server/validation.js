import { CLASSES, normalizeLoadout } from '../src/data/customization.js';

export const LIMITS = Object.freeze({ humans: 8, bots: 12, rooms: 8, connections: 128, payload: 8192, staleInputMs: 250, joinTimeoutMs: 30000 });
export const EDGE_KEYS = ['jump', 'reload', 'tactical', 'lethal', 'ability', 'impulse'];
const HELD_KEYS = ['sprint', 'crouch', 'fire', 'alt'];
const INPUT_KEYS = new Set(['moveX', 'moveZ', 'yaw', 'pitch', 'switchSlot', ...EDGE_KEYS, ...HELD_KEYS]);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function record(value, label) {
  if (!plain(value)) throw new Error(`${label} must be an object.`);
  return value;
}

export function playerName(value) {
  if (value === undefined) return 'Player';
  if (typeof value !== 'string') throw new Error('Player name must be text.');
  const name = value.normalize('NFKC').trim();
  if (!name || [...name].length > 16 || /[\p{C}<>]/u.test(name)) throw new Error('Use a player name of 1–16 visible characters.');
  return name;
}

function boundedData(value, depth = 0) {
  if (depth > 4) throw new Error('Loadout is nested too deeply.');
  if (typeof value === 'string' && value.length <= 64) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value === 'boolean' || value === null) return;
  if (!plain(value) || Object.keys(value).length > 30) throw new Error('Invalid loadout.');
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid loadout field.');
    boundedData(child, depth + 1);
  }
}

export function loadout(value = {}) {
  record(value, 'Loadout');
  boundedData(value);
  // The shared normalizer allowlists equipment, modifiers and cosmetic IDs,
  // enforcing the same tuning budget as local play.
  return normalizeLoadout(value);
}

export function matchConfig(value = {}) {
  record(value, 'Match configuration');
  const number = (key, fallback, min, max) => {
    const n = value[key] === undefined ? fallback : Number(value[key]);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) throw new Error(`${key} must be an integer from ${min} to ${max}.`);
    return n;
  };
  const choice = (key, fallback, values) => {
    const selected = value[key] ?? fallback;
    if (!values.includes(selected)) throw new Error(`Invalid ${key}.`);
    return selected;
  };
  const config = {
    mode: choice('mode', 'ffa', ['ffa', 'tdm']),
    difficulty: choice('difficulty', 'normal', ['easy', 'normal', 'hard', 'veteran']),
    botCount: number('botCount', 5, 0, LIMITS.bots),
    duration: number('duration', 180, 30, 900),
    scoreLimit: number('scoreLimit', 20, 1, 100),
    playerTeam: choice('playerTeam', 'a', ['a', 'b']),
  };
  if (value.botClasses !== undefined) {
    if (!Array.isArray(value.botClasses) || value.botClasses.length > 12 || value.botClasses.some(id => !Object.hasOwn(CLASSES, id))) throw new Error('Invalid bot class selection.');
    config.botClasses = [...value.botClasses];
  }
  return config;
}

export function inputState(value) {
  record(value, 'Input');
  if (Object.keys(value).some(key => !INPUT_KEYS.has(key))) throw new Error('Only movement, aim and action inputs are accepted.');
  const result = { moveX: 0, moveZ: 0 };
  for (const key of ['moveX', 'moveZ', 'yaw', 'pitch']) {
    if (value[key] === undefined) continue;
    const n = value[key], max = key === 'yaw' ? 1e6 : key === 'pitch' ? 1.48 : 1;
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > max) throw new Error(`Invalid ${key} input.`);
    result[key] = key === 'yaw' ? ((n + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI : n;
  }
  for (const key of [...HELD_KEYS, ...EDGE_KEYS]) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new Error(`Invalid ${key} input.`);
    result[key] = value[key] === true;
  }
  if (value.switchSlot !== undefined && value.switchSlot !== null && value.switchSlot !== 0 && value.switchSlot !== 1) throw new Error('Invalid weapon slot.');
  result.switchSlot = value.switchSlot ?? null;
  return result;
}

export function roomCode(value) {
  if (typeof value !== 'string' || !/^[A-Z2-9]{6}$/.test(value.trim().toUpperCase())) throw new Error('Room codes contain six letters or digits.');
  return value.trim().toUpperCase();
}
