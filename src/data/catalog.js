/** Shared, data-driven equipment. Colors communicate families; labels stay brief. */
export const WEAPONS = {
  fizz: {
    id: 'fizz', name: 'Fizz', category: 'Soda SMG', color: '#c5f64a',
    description: 'Fast spray. Best at short range.',
    damage: 11, fireInterval: 0.085, magazine: 32, reserve: 192, reloadTime: 1.55,
    range: 46, spread: 0.018, automatic: true, kind: 'hitscan',
    headshotMultiplier: 1.45, falloffStart: 17, minDamageScale: 0.5, knockback: 0.55,
  },
  doorbell: {
    id: 'doorbell', name: 'Doorbell', category: 'Recoil shotgun', color: '#ffb253',
    description: 'Nine pellets. Fire downward to recoil-jump.',
    damage: 8, fireInterval: 0.82, magazine: 6, reserve: 42, reloadTime: 1.9,
    range: 26, spread: 0.095, automatic: true, kind: 'hitscan',
    pellets: 9, headshotMultiplier: 1.2, falloffStart: 8, minDamageScale: 0.32,
    knockback: 0.95, selfRecoil: 5.8,
  },
  bankshot: {
    id: 'bankshot', name: 'Bankshot', category: 'Ricochet launcher', color: '#ffe34a',
    description: 'Three bounces. Each bounce adds 22% damage.',
    damage: 34, fireInterval: 0.4, magazine: 10, reserve: 70, reloadTime: 1.8,
    range: 85, spread: 0.009, automatic: true, kind: 'projectile',
    speed: 35, gravity: 0, radius: 0.18, lifetime: 3, bounces: 3,
    bounceDamage: 1.22, knockback: 5, headshotMultiplier: 1.25,
  },
  confetti: {
    id: 'confetti', name: 'Confetti', category: 'Lobbed explosive', color: '#ff6ab7',
    description: 'Bounces off cover. Bursts on rivals or after 1.8 seconds.',
    damage: 80, fireInterval: 0.95, magazine: 4, reserve: 28, reloadTime: 2.3,
    range: 65, spread: 0.013, automatic: true, kind: 'projectile',
    speed: 25, gravity: 9, radius: 0.2, lifetime: 1.8, bounces: 5,
    restitution: 0.62, blastRadius: 4.8, knockback: 12, selfDamage: 0.55,
  },
  rail: {
    id: 'rail', name: 'Last Straw', category: 'Precision rifle', color: '#77e8ff',
    description: 'Powerful headshots. Slow follow-up, small magazine.',
    damage: 78, fireInterval: 1.25, magazine: 5, reserve: 35, reloadTime: 2.15,
    range: 85, spread: 0.0015, automatic: true, kind: 'hitscan',
    headshotMultiplier: 1.65, falloffStart: 65, minDamageScale: 0.85, knockback: 6,
  },
  updraft: {
    id: 'updraft', name: 'Updraft', category: 'Air cannon', color: '#b99bff',
    description: 'Launches rivals. Switch weapons for a midair follow-up.',
    damage: 29, fireInterval: 0.52, magazine: 9, reserve: 63, reloadTime: 1.7,
    range: 42, spread: 0.012, automatic: true, kind: 'projectile',
    speed: 42, gravity: 0, radius: 0.27, lifetime: 1.05, bounces: 0,
    knockback: 3.5, lift: 10.8, headshotMultiplier: 1.1,
  },
  yoink: {
    id: 'yoink', name: 'Yoink', category: 'Momentum magnet', color: '#70edc4',
    description: 'Pulls rivals in. Hold RMB + fire to push them away.',
    damage: 23, fireInterval: 0.42, magazine: 12, reserve: 84, reloadTime: 1.65,
    range: 24, spread: 0.006, automatic: true, kind: 'hitscan',
    headshotMultiplier: 1, falloffStart: 18, minDamageScale: 0.8,
    knockback: 8, lift: 2.6, pull: true,
  },
  burst: {
    id: 'burst', name: 'Burst Stapler', category: 'Burst rifle', color: '#ffba72',
    description: 'Three precise staples per burst. Track your target between shots.',
    damage: 20, fireInterval: 0.52, magazine: 24, reserve: 144, reloadTime: 1.8,
    range: 54, spread: 0.008, automatic: true, kind: 'hitscan',
    burstCount: 3, burstInterval: 0.09, headshotMultiplier: 1.3,
    falloffStart: 26, minDamageScale: 0.65, knockback: 1.1,
  },
  spool: {
    id: 'spool', name: 'Spool', category: 'Spin-up repeater', color: '#f2ca57',
    description: 'Hold fire to spin up. Faster fire brings wider spread.',
    damage: 8, fireInterval: 0.16, magazine: 55, reserve: 220, reloadTime: 2.6,
    range: 40, spread: 0.018, automatic: true, kind: 'hitscan',
    spinInterval: 0.055, spinTime: 0.85, headshotMultiplier: 1.15,
    falloffStart: 15, minDamageScale: 0.4, knockback: 0.35,
  },
  tack: {
    id: 'tack', name: 'Tack', category: 'Glue launcher', color: '#9de2ac',
    description: 'Sticky shots slow rivals for 1.6 seconds. Low direct damage.',
    damage: 24, fireInterval: 0.5, magazine: 10, reserve: 60, reloadTime: 1.75,
    range: 38, spread: 0.012, automatic: true, kind: 'projectile',
    speed: 28, gravity: 2.5, radius: 0.2, lifetime: 1.5, bounces: 0,
    slowDuration: 1.6, knockback: 1, headshotMultiplier: 1.15,
  },
  disc: {
    id: 'disc', name: 'Return Disc', category: 'Returning projectile', color: '#ff9bc8',
    description: 'Hits once going out and once coming back. Steer its return by moving.',
    damage: 32, fireInterval: 0.78, magazine: 6, reserve: 42, reloadTime: 1.9,
    range: 52, spread: 0.003, automatic: true, kind: 'projectile',
    speed: 23, gravity: 0, radius: 0.22, lifetime: 2.5, bounces: 0,
    returnAfter: 0.65, knockback: 3, headshotMultiplier: 1,
  },
  arc: {
    id: 'arc', name: 'Arc', category: 'Chain conductor', color: '#81c9ff',
    description: 'Jumps to two nearby rivals. Walls and bubbles break the chain.',
    damage: 27, fireInterval: 0.38, magazine: 12, reserve: 84, reloadTime: 1.95,
    range: 16, spread: 0.004, automatic: true, kind: 'hitscan',
    chainCount: 2, chainRange: 6, chainScale: 0.65, headshotMultiplier: 1,
    falloffStart: 12, minDamageScale: 0.85, knockback: 1,
  },
};

export const GADGETS = {
  springpad: {
    id: 'springpad', name: 'Spring Pad', color: '#c5f64a', slot: 'tactical',
    description: 'Launch pad. In team matches, only you and allies can trigger it.',
    cooldown: 12, mechanic: 'spring', duration: 18, radius: 1.15, launch: 13.5,
  },
  bubble: {
    id: 'bubble', name: 'Bubble', color: '#77e8ff', slot: 'tactical',
    description: 'Blocks enemy shots for seven seconds or 160 damage. Allies fire through.',
    cooldown: 17, mechanic: 'shield', duration: 7, radius: 3.1, health: 160,
  },
  vortex: {
    id: 'vortex', name: 'Vortex', color: '#b99bff', slot: 'tactical',
    description: 'Pulls rivals inward. Curves your shots and enemy projectiles.',
    cooldown: 15, mechanic: 'vortex', duration: 5, radius: 5.5, force: 75,
  },
  cherry: {
    id: 'cherry', name: 'Cherry Bomb', color: '#ff7387', slot: 'lethal',
    description: 'Bouncing grenade. 1.65-second fuse. Keep your distance.',
    cooldown: 9, mechanic: 'grenade', fuse: 1.65, damage: 90, radius: 5.1, knockback: 13,
  },
  whoopee: {
    id: 'whoopee', name: 'Whoopee Trap', color: '#ffb253', slot: 'lethal',
    description: 'Arms in 0.8 seconds. Rivals trigger damage and a launch.',
    cooldown: 12, mechanic: 'trap', duration: 22, radius: 1.6,
    blastRadius: 4.2, damage: 67, knockback: 10, lift: 10,
  },
  booster: {
    id: 'booster', name: 'Rush Pad', color: '#c5f64a', slot: 'tactical',
    description: 'You and allies gain 20% speed while nearby, lasting one second after leaving.',
    cooldown: 14, mechanic: 'booster', duration: 6, radius: 3.5,
  },
  repulsor: {
    id: 'repulsor', name: 'Repulsor', color: '#70edc4', slot: 'tactical',
    description: 'Pushes rivals away and deflects incoming enemy projectiles.',
    cooldown: 16, mechanic: 'repulsor', duration: 4.5, radius: 4, force: 85,
  },
  cluster: {
    id: 'cluster', name: 'Cherry Trio', color: '#ff8b61', slot: 'lethal',
    description: 'Splits into three small grenades after 0.9 seconds. Spread-out bursts.',
    cooldown: 14, mechanic: 'grenade', fuse: 0.9, damage: 38, radius: 2.5,
    knockback: 6, clusterCount: 3,
  },
};

export const PERKS = {
  spring: {
    id: 'spring', name: 'Springs', color: '#c5f64a',
    description: '+8% speed, +18% jump impulse. Take 8% more knockback.',
    moveSpeed: 1.08, jump: 1.18, reload: 1, impulseResistance: 1.08,
  },
  heavy: {
    id: 'heavy', name: 'Anchor', color: '#ffb253',
    description: '45% less knockback. Slower movement, jumps and reloads.',
    moveSpeed: 0.91, jump: 0.95, reload: 1.08, impulseResistance: 0.55,
  },
  quick: {
    id: 'quick', name: 'Quick Hands', color: '#77e8ff',
    description: 'Reload 30% faster.',
    moveSpeed: 1, jump: 1, reload: 0.7, impulseResistance: 1,
  },
};

export const DEFAULT_LOADOUT = {
  primary: 'fizz', secondary: 'doorbell', tactical: 'springpad', lethal: 'cherry', perk: 'spring',
  classId: 'runner', impulseCore: 'repel',
};

export const PRESETS = {
  houseparty: {
    id: 'houseparty', name: 'Skirmisher', color: '#c5f64a', description: 'Fast movement and close-range pressure.',
    loadout: { ...DEFAULT_LOADOUT },
  },
  accounting: {
    id: 'accounting', name: 'Banker', color: '#ffe34a', description: 'Bounce shots around cover, then finish with precision.',
    loadout: { primary: 'bankshot', secondary: 'rail', tactical: 'vortex', lethal: 'whoopee', perk: 'quick', classId: 'engineer', impulseCore: 'pull' },
  },
  space: {
    id: 'space', name: 'Air Time', color: '#b99bff', description: 'Launch rivals and control their landing.',
    loadout: { primary: 'updraft', secondary: 'yoink', tactical: 'springpad', lethal: 'whoopee', perk: 'spring', classId: 'acrobat', impulseCore: 'lift' },
  },
  disaster: {
    id: 'disaster', name: 'Anchor', color: '#ff6ab7', description: 'Explosive pressure behind a bubble.',
    loadout: { primary: 'confetti', secondary: 'spool', tactical: 'bubble', lethal: 'cherry', perk: 'heavy', classId: 'bulwark', impulseCore: 'repel' },
  },
  support: {
    id: 'support', name: 'Support', color: '#70edc4', description: 'Keep allies moving and punish grouped rivals.',
    loadout: { primary: 'burst', secondary: 'arc', tactical: 'booster', lethal: 'cluster', perk: 'quick', classId: 'medic', impulseCore: 'repel' },
  },
  trickster: {
    id: 'trickster', name: 'Trickster', color: '#ff9bc8', description: 'Slow rivals, bend projectiles and return for another hit.',
    loadout: { primary: 'disc', secondary: 'tack', tactical: 'repulsor', lethal: 'cluster', perk: 'quick', classId: 'disruptor', impulseCore: 'pull' },
  },
};
