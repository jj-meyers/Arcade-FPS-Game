/** Gameplay values live here; simulation, UI and renderer share these IDs. */
export const WEAPONS = {
  fizz: {
    id: 'fizz', name: 'Fizzy Business', category: 'Soda SMG', color: '#c5f64a',
    description: 'A very shaken soda hose. Fast, forgiving spray; accuracy fades at long range.',
    damage: 11, fireInterval: 0.085, magazine: 32, reserve: 192, reloadTime: 1.55,
    range: 46, spread: 0.018, automatic: true, kind: 'hitscan',
    headshotMultiplier: 1.45, falloffStart: 17, minDamageScale: 0.5, knockback: 0.55,
  },
  doorbell: {
    id: 'doorbell', name: 'Ding-Dong, Gone', category: 'Recoil shotgun', color: '#ffb253',
    description: 'Nine pellets and an impolite kick. Jump, aim down and ring yourself into the air.',
    damage: 8, fireInterval: 0.82, magazine: 6, reserve: 42, reloadTime: 1.9,
    range: 26, spread: 0.095, automatic: true, kind: 'hitscan',
    pellets: 9, headshotMultiplier: 1.2, falloffStart: 8, minDamageScale: 0.32,
    knockback: 0.95, selfRecoil: 5.8,
  },
  bankshot: {
    id: 'bankshot', name: 'Rubber Duckruptcy', category: 'Ricochet launcher', color: '#ffe34a',
    description: 'Rubber rounds bounce three times. Every bank adds damage. Geometry pays dividends.',
    damage: 34, fireInterval: 0.4, magazine: 10, reserve: 70, reloadTime: 1.8,
    range: 85, spread: 0.009, automatic: true, kind: 'projectile',
    speed: 35, gravity: 0, radius: 0.18, lifetime: 3, bounces: 3,
    bounceDamage: 1.22, knockback: 5, headshotMultiplier: 1.25,
  },
  confetti: {
    id: 'confetti', name: 'Party Foul', category: 'Confetti mortar', color: '#ff6ab7',
    description: 'Lob a party popper. Bounces off cover; bursts on enemies or after a short fuse.',
    damage: 80, fireInterval: 0.95, magazine: 4, reserve: 28, reloadTime: 2.3,
    range: 65, spread: 0.013, automatic: true, kind: 'projectile',
    speed: 25, gravity: 9, radius: 0.2, lifetime: 1.8, bounces: 5,
    restitution: 0.62, blastRadius: 4.8, knockback: 12, selfDamage: 0.55,
  },
  rail: {
    id: 'rail', name: 'The Last Straw', category: 'Precision straw', color: '#77e8ff',
    description: 'A concentrated bad idea. Huge precision hit, tiny magazine, long follow-up delay.',
    damage: 78, fireInterval: 1.25, magazine: 5, reserve: 35, reloadTime: 2.15,
    range: 85, spread: 0.0015, automatic: true, kind: 'hitscan',
    headshotMultiplier: 1.65, falloffStart: 65, minDamageScale: 0.85, knockback: 6,
  },
  updraft: {
    id: 'updraft', name: 'Ceiling Fan Club', category: 'Air cannon', color: '#b99bff',
    description: 'Compressed nonsense lifts enemies skyward. Set up a midair follow-up with your secondary.',
    damage: 29, fireInterval: 0.52, magazine: 9, reserve: 63, reloadTime: 1.7,
    range: 42, spread: 0.012, automatic: true, kind: 'projectile',
    speed: 42, gravity: 0, radius: 0.27, lifetime: 1.05, bounces: 0,
    knockback: 3.5, lift: 10.8, headshotMultiplier: 1.1,
  },
  yoink: {
    id: 'yoink', name: 'Personal Space Invader', category: 'Momentum magnet', color: '#70edc4',
    description: 'LMB reels enemies in. Hold RMB + LMB to shove them away. Short range, maximum disrespect.',
    damage: 23, fireInterval: 0.42, magazine: 12, reserve: 84, reloadTime: 1.65,
    range: 24, spread: 0.006, automatic: true, kind: 'hitscan',
    headshotMultiplier: 1, falloffStart: 18, minDamageScale: 0.8,
    knockback: 8, lift: 2.6, pull: true,
  },
};

export const GADGETS = {
  springpad: {
    id: 'springpad', name: 'Boing Insurance', color: '#c5f64a', slot: 'tactical',
    description: 'Drop a spring pad for 18 seconds. Anyone stepping on it gets express delivery to the sky.',
    cooldown: 12, mechanic: 'spring', duration: 18, radius: 1.15, launch: 13.5,
  },
  bubble: {
    id: 'bubble', name: 'Personal Bubble', color: '#77e8ff', slot: 'tactical',
    description: 'Seven seconds of soap-based protection. Stops incoming shots; you can fire out. Pops after 160 damage.',
    cooldown: 17, mechanic: 'shield', duration: 7, radius: 3.1, health: 160,
  },
  vortex: {
    id: 'vortex', name: 'Drama Magnet', color: '#b99bff', slot: 'tactical',
    description: 'Plant a five-second gravity tantrum. Tugs nearby rivals and curves every flying projectile.',
    cooldown: 15, mechanic: 'vortex', duration: 5, radius: 5.5, force: 75,
  },
  cherry: {
    id: 'cherry', name: 'Cherry Bomb-ish', color: '#ff7387', slot: 'lethal',
    description: 'A bouncing cherry with a 1.65-second fuse. Loud, juicy, and absolutely not a snack.',
    cooldown: 9, mechanic: 'grenade', fuse: 1.65, damage: 90, radius: 5.1, knockback: 13,
  },
  whoopee: {
    id: 'whoopee', name: 'Whoopee Cushion', color: '#ffb253', slot: 'lethal',
    description: 'A proximity prank that arms after 0.8 seconds. Rivals trigger damage and an undignified launch.',
    cooldown: 12, mechanic: 'trap', duration: 22, radius: 1.6,
    blastRadius: 4.2, damage: 67, knockback: 10, lift: 10,
  },
};

export const PERKS = {
  spring: {
    id: 'spring', name: 'Loose Springs', color: '#c5f64a',
    description: 'Jump with 18% more oomph and move 8% faster. Incoming knockback gets 8% sillier too.',
    moveSpeed: 1.08, jump: 1.18, reload: 1, impulseResistance: 1.08,
  },
  heavy: {
    id: 'heavy', name: 'Emotional Baggage', color: '#ffb253',
    description: 'Take 45% less knockback. Move 9% slower, with slightly slower reloads and lower jumps.',
    moveSpeed: 0.91, jump: 0.95, reload: 1.08, impulseResistance: 0.55,
  },
  quick: {
    id: 'quick', name: 'Fast Hands, No Plans', color: '#77e8ff',
    description: 'Reload 30% faster. Ideal for terrible decisions that require another magazine.',
    moveSpeed: 1, jump: 1, reload: 0.7, impulseResistance: 1,
  },
};

export const DEFAULT_LOADOUT = {
  primary: 'fizz', secondary: 'doorbell', tactical: 'springpad', lethal: 'cherry', perk: 'spring',
};

export const PRESETS = {
  houseparty: {
    id: 'houseparty', name: 'House Party', color: '#c5f64a',
    description: 'The all-purpose welcome committee. Shake soda, ring doorbells, leave via the roof.',
    loadout: { ...DEFAULT_LOADOUT },
  },
  accounting: {
    id: 'accounting', name: 'Creative Accounting', color: '#ffe34a',
    description: 'Bank ricochets around cover and collect the airborne debt with a precision straw.',
    loadout: { primary: 'bankshot', secondary: 'rail', tactical: 'vortex', lethal: 'whoopee', perk: 'quick' },
  },
  space: {
    id: 'space', name: 'Space Program', color: '#b99bff',
    description: 'Send everyone upstairs, then politely decide whether they should come back.',
    loadout: { primary: 'updraft', secondary: 'yoink', tactical: 'springpad', lethal: 'whoopee', perk: 'spring' },
  },
  disaster: {
    id: 'disaster', name: 'Certified Disaster', color: '#ff6ab7',
    description: 'Pull the room together, throw a party, and hide inside your bubble.',
    loadout: { primary: 'confetti', secondary: 'yoink', tactical: 'bubble', lethal: 'cherry', perk: 'heavy' },
  },
};
