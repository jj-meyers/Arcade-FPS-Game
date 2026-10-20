import { WEAPONS, GADGETS, PERKS, DEFAULT_LOADOUT } from './catalog.js';

// Product name has one source; the static HTML title is also set at startup.
export const GAME_TITLE = 'Unfug';
export const CLASSES = {
  runner: { id:'runner', name:'Runner', color:'#c5f64a', description:'Fast flanks. More vulnerable to knockback.', moveSpeed:1.10, jump:1, reload:1, impulseResistance:1.12, ability:{name:'Dash',description:'Burst forward. Walls stop you.',cooldown:8} },
  bulwark: { id:'bulwark', name:'Bulwark', color:'#ffb253', description:'Steady under fire. Slower on foot.', moveSpeed:.90, jump:.95, reload:1, impulseResistance:.65, ability:{name:'Brace',description:'35% less damage for 3s. Move slower.',cooldown:15} },
  medic: { id:'medic', name:'Medic', color:'#70edc4', description:'Restore your team between fights.', moveSpeed:1, jump:1, reload:1, impulseResistance:1, ability:{name:'Mend',description:'Place a short-lived healing field.',cooldown:16} },
  engineer: { id:'engineer', name:'Engineer', color:'#ffe34a', description:'Faster reloads. Resupply teammates.', moveSpeed:.97, jump:1, reload:.9, impulseResistance:1, ability:{name:'Supply',description:'Place a field that replenishes reserves.',cooldown:17} },
  disruptor: { id:'disruptor', name:'Disruptor', color:'#b99bff', description:'Control an approach with slowing fields.', moveSpeed:1, jump:1, reload:1, impulseResistance:1, ability:{name:'Dampen',description:'Slow nearby enemies and their projectiles.',cooldown:16} },
  acrobat: { id:'acrobat', name:'Acrobat', color:'#77e8ff', description:'Higher jumps and stronger air control.', moveSpeed:1.04, jump:1.15, reload:1, impulseResistance:1.05, airControl:1.3, ability:{name:'Launch',description:'Jump vertically, even while airborne.',cooldown:11} },
};
export const IMPULSE_CORES = {
  repel:{id:'repel',name:'Repel',description:'Push enemies and projectiles away.',color:'#ffb253'},
  lift:{id:'lift',name:'Lift',description:'Launch enemies and projectiles upward.',color:'#77e8ff'},
  pull:{id:'pull',name:'Pull',description:'Draw enemies and projectiles toward you.',color:'#b99bff'},
};
export const TUNING_BUDGET = 5;
export const WEAPON_MODS = {
  barrel: {
    standard:{id:'standard',name:'Standard',cost:0,description:'Balanced barrel.',modifiers:{}},
    precision:{id:'precision',name:'Precision',cost:2,description:'35% tighter spread; 10% slower fire.',modifiers:{spread:.65,fireInterval:1.10}},
    long:{id:'long',name:'Long barrel',cost:2,description:'25% more range and projectile speed; 15% slower reload.',modifiers:{range:1.25,falloffStart:1.25,speed:1.25,reloadTime:1.15}},
    compact:{id:'compact',name:'Compact',cost:1,description:'12% faster fire; 12% less damage.',modifiers:{fireInterval:.88,damage:.88}},
    impact:{id:'impact',name:'Impact',cost:3,description:'35% more knockback; 12% slower fire.',modifiers:{knockback:1.35,lift:1.2,fireInterval:1.12}},
  },
  magazine: {
    standard:{id:'standard',name:'Standard',cost:0,description:'Balanced magazine.',modifiers:{}},
    extended:{id:'extended',name:'Extended',cost:2,description:'40% more rounds; 25% slower reload.',modifiers:{magazine:1.4,reloadTime:1.25}},
    quick:{id:'quick',name:'Quick-feed',cost:2,description:'25% faster reload; 25% fewer rounds.',modifiers:{reloadTime:.75,magazine:.75}},
    reserve:{id:'reserve',name:'Reserve',cost:1,description:'50% more reserve ammo; 10% slower reload.',modifiers:{reserve:1.5,reloadTime:1.1}},
  },
  handling: {
    standard:{id:'standard',name:'Standard',cost:0,description:'Balanced grip.',modifiers:{}},
    steady:{id:'steady',name:'Steady',cost:2,description:'20% tighter spread; 8% slower movement.',modifiers:{spread:.8,moveSpeed:.92}},
    light:{id:'light',name:'Lightweight',cost:2,description:'8% faster movement; 25% wider spread.',modifiers:{moveSpeed:1.08,spread:1.25}},
    rapid:{id:'rapid',name:'Rapid action',cost:3,description:'15% faster fire; 25% slower reload.',modifiers:{fireInterval:.85,reloadTime:1.25}},
  },
};
const colors = {
  lime:{id:'lime',name:'Lime',color:'#c5f64a'},coral:{id:'coral',name:'Coral',color:'#ff7387'},teal:{id:'teal',name:'Teal',color:'#70edc4'},violet:{id:'violet',name:'Violet',color:'#b99bff'},amber:{id:'amber',name:'Amber',color:'#ffb253'},blue:{id:'blue',name:'Blue',color:'#77e8ff'},
};
const choices = names => Object.fromEntries(names.map(([id,name])=>[id,{id,name}]));
export const COSMETICS = {
  bodyColor:colors,accentColor:colors,
  hat:choices([['none','None'],['cap','Cap'],['antenna','Antenna'],['crown','Crown'],['headphones','Headphones']]),
  face:choices([['none','None'],['visor','Visor'],['shades','Shades'],['mask','Mask']]),
  back:choices([['none','None'],['tank','Tank'],['fins','Fins'],['coil','Coil']]),
  pattern:choices([['plain','Plain'],['stripe','Stripe'],['dots','Dots'],['split','Split']]),
};
export const WEAPON_FINISHES = {factory:{id:'factory',name:'Factory',color:null},...colors,mono:{id:'mono',name:'Graphite',color:'#687485'}};
export const DEFAULT_CUSTOMIZATION = Object.freeze({bodyColor:'lime',accentColor:'teal',hat:'none',face:'none',back:'none',pattern:'plain'});
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const valid = (map,id,fallback) => typeof id==='string' && Object.hasOwn(map,id) ? id : fallback;
export function normalizeCosmetics(input) {
  const source=record(input), result={};
  for (const key of Object.keys(COSMETICS)) result[key]=valid(COSMETICS[key],source[key],DEFAULT_CUSTOMIZATION[key]);
  return result;
}
export function tuningCost(mods={}) {
  return Object.entries(WEAPON_MODS).reduce((total,[slot,map])=>total+(map[mods[slot]]?.cost||0),0);
}
export function normalizeLoadout(input) {
  const source=record(input), result={};
  result.primary=valid(WEAPONS,source.primary,DEFAULT_LOADOUT.primary);
  result.secondary=valid(WEAPONS,source.secondary,DEFAULT_LOADOUT.secondary);
  if (result.primary===result.secondary) result.secondary=Object.keys(WEAPONS).find(id=>id!==result.primary);
  for (const slot of ['tactical','lethal']) result[slot]=GADGETS[source[slot]]?.slot===slot ? source[slot] : DEFAULT_LOADOUT[slot];
  result.perk=valid(PERKS,source.perk,DEFAULT_LOADOUT.perk);
  result.classId=valid(CLASSES,source.classId,'runner');
  result.impulseCore=valid(IMPULSE_CORES,source.impulseCore,'repel');
  result.cosmetics=normalizeCosmetics(source.cosmetics);
  result.mods={}; result.finishes={};
  for (const gun of ['primary','secondary']) {
    const mods=record(record(source.mods)[gun]); result.mods[gun]={};
    for (const slot of Object.keys(WEAPON_MODS)) result.mods[gun][slot]=valid(WEAPON_MODS[slot],mods[slot],'standard');
    for (const slot of ['handling','magazine','barrel']) {
      if (tuningCost(result.mods[gun])<=TUNING_BUDGET) break;
      result.mods[gun][slot]='standard';
    }
    result.finishes[gun]=valid(WEAPON_FINISHES,record(source.finishes)[gun],'factory');
  }
  return result;
}
export function resolveWeapon(base,equipment={},slot=null) {
  const result={...base,moveSpeed:1};
  const weaponSlot=slot || (equipment.primary===base.id?'primary':'secondary');
  const mods=record(record(equipment.mods)[weaponSlot]);
  for (const key of Object.keys(WEAPON_MODS)) {
    const def=WEAPON_MODS[key][mods[key]];
    if (!def) continue;
    for (const [stat,multiplier] of Object.entries(def.modifiers)) if (typeof result[stat]==='number') result[stat]*=multiplier;
  }
  result.magazine=Math.max(1,Math.round(result.magazine)); result.reserve=Math.max(0,Math.round(result.reserve));
  return result;
}
export function movementModifiers(actor,time=0) {
  const equipment=actor.equipment||{}, cls=CLASSES[equipment.classId]||CLASSES.runner, perk=PERKS[equipment.perk]||{};
  const weapon=WEAPONS[equipment[actor.activeSlot===1?'secondary':'primary']];
  const handling=weapon?resolveWeapon(weapon,equipment,actor.activeSlot===1?'secondary':'primary').moveSpeed:1;
  const status=(actor.bracedUntil>time?.65:1)*(actor.slowedUntil>time?.65:1)*(actor.hasteUntil>time?1.2:1);
  return {moveSpeed:(cls.moveSpeed||1)*(perk.moveSpeed||1)*handling*status,jump:(cls.jump||1)*(perk.jump||1),airControl:cls.airControl||1};
}
