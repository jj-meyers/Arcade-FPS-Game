import { ARENA } from '../data/arena.js';
import { DEFAULT_LOADOUT, PRESETS, PERKS } from '../data/catalog.js';
import { CLASSES, COSMETICS, normalizeLoadout, movementModifiers } from '../data/customization.js';
import { Combat } from './Combat.js';
import { AI } from './AI.js';
import { moveActor, worldRaycast, groundHeight } from './physics.js';
import { clamp, direction, seededRandom, distance, normalize, sub, rayBox, raySphere } from './math.js';

const BOT_NAMES = ['Wobbles', 'Tack', 'Soup', 'Crouton', 'Moth', 'Microwave', 'Bonk', 'Fidget', 'Crunch', 'Kevin', 'Goose', 'Loop'];
const COLORS = Object.values(COSMETICS.bodyColor);
const PERSONALITIES = ['aggressive', 'cautious', 'chaotic', 'precision'];
const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? clamp(Number(value),min,max) : fallback;
const safeName = value => typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,16)||'Player' : 'Player';

export class Game {
  constructor({ seed = Date.now(), loadout = DEFAULT_LOADOUT } = {}) {
    this.rng = seededRandom(seed); this.map = ARENA; this.time = 0; this.events = []; this.actors = []; this.paused = false;
    this.humanInputs = new Map();
    this.match = { state:'menu',countdown:0,remaining:180,scoreLimit:20,difficulty:'normal',botCount:5,duration:180,winnerId:null,mode:'ffa',teamScores:{a:0,b:0},winnerTeam:null,playerTeam:'a' };
    this.combat = new Combat(this); this.ai = new AI(this);
    this.player = this.createActor(0,true,loadout);
    for (let i=1;i<=5;i++) this.createActor(i,false,this.botLoadout(i));
  }
  botLoadout(index) {
    const presets=Object.values(PRESETS), classes=this.match.botClasses?.length?this.match.botClasses:Object.keys(CLASSES);
    const loadout=normalizeLoadout(presets[index%Math.max(1,presets.length)]?.loadout||DEFAULT_LOADOUT);
    loadout.classId=classes[index%classes.length];
    loadout.impulseCore=['repel','lift','pull'][index%3];
    loadout.cosmetics={bodyColor:COLORS[index%COLORS.length].id,accentColor:COLORS[(index+2)%COLORS.length].id,hat:['cap','antenna','headphones','crown'][index%4],face:['none','visor','shades','mask'][index%4],back:['none','tank','fins','coil'][index%4],pattern:['plain','stripe','dots','split'][index%4]};
    return loadout;
  }
  createActor(index,isPlayer,equipment) {
    const loadout=normalizeLoadout(equipment), team=this.match.mode==='tdm' ? (index%2===0?this.match.playerTeam:(this.match.playerTeam==='a'?'b':'a')) : null;
    const actor={
      id:isPlayer?'player':`bot-${index}`,name:isPlayer?'YOU':BOT_NAMES[(index-1)%BOT_NAMES.length],isPlayer,isHuman:isPlayer,
      color:COSMETICS.bodyColor[loadout.cosmetics.bodyColor].color,classId:loadout.classId,cosmetics:{...loadout.cosmetics},team,
      personality:PERSONALITIES[(index-1+PERSONALITIES.length)%PERSONALITIES.length],
      pos:{...this.map.spawns[index%this.map.spawns.length]},vel:{x:0,y:0,z:0},yaw:isPlayer?0:this.rng()*Math.PI*2,pitch:0,radius:.45,height:1.8,
      health:100,maxHealth:100,alive:true,grounded:true,kills:0,deaths:0,assists:0,damageDealt:0,shotsFired:0,streak:0,bestStreak:0,
      respawnAt:0,invulnerableUntil:0,equipment:loadout,activeSlot:0,inventory:{},gadgetReady:{},abilityReady:0,impulseCharge:35,
      ai:{},intent:{},lastDamageAt:-999,lastDamagedBy:null,damageContributors:{},aiming:false,
      bracedUntil:0,hasteUntil:0,slowedUntil:0,slideRemaining:0,slideCooldown:0,
    };
    actor.prevPos={...actor.pos}; this.actors.push(actor); this.combat.equip(actor); return actor;
  }
  start(config={},loadout=DEFAULT_LOADOUT) {
    this.time=0; this.events.length=0; this.paused=false; this.actors=[]; this.humanInputs=new Map();
    const duration=number(config.duration,180,30,900);
    this.match={state:'countdown',countdown:3,remaining:duration,duration,scoreLimit:Math.round(number(config.scoreLimit,20,1,100)),botCount:Math.round(number(config.botCount,5,0,12)),difficulty:['easy','normal','hard','veteran'].includes(config.difficulty)?config.difficulty:'normal',mode:config.mode==='tdm'?'tdm':'ffa',teamScores:{a:0,b:0},winnerTeam:null,playerTeam:config.playerTeam==='b'?'b':'a',botClasses:Array.isArray(config.botClasses)?config.botClasses.filter(id=>Object.hasOwn(CLASSES,id)).slice(0,12):[],winnerId:null,endReason:null};
    this.combat=new Combat(this); this.ai=new AI(this);
    this.player=this.createActor(0,true,loadout); this.player.name=safeName(config.name||'YOU');
    const botClasses=this.match.botClasses.length?this.match.botClasses:Object.keys(CLASSES);
    for(let i=1;i<=this.match.botCount;i++){
      const botLoadout=this.botLoadout(i+Math.floor(this.rng()*12));
      const classIndex=this.match.mode==='tdm'?Math.floor((i-1)/2):i-1;
      botLoadout.classId=botClasses[classIndex%botClasses.length];
      this.createActor(i,false,botLoadout);
    }
    if(this.match.mode==='tdm') {
      const available=[...this.map.spawns];
      for(const actor of this.actors) {
        const sideIndex=available.findIndex(p=>actor.team==='a'?p.x<0:p.x>0);
        const point=available.splice(sideIndex<0?0:sideIndex,1)[0]||this.map.spawns[0];
        actor.pos={...point};actor.prevPos={...point};actor.yaw=Math.atan2(point.x,point.z);
      }
    }
    this.emit({type:'matchStart'});
  }
  emit(event) {
    if(event.type==='shot' && (event.pellet===undefined||event.pellet===0)) { const actor=this.getActor(event.actorId);if(actor)actor.shotsFired++; }
    this.events.push({time:this.time,...event}); if(this.events.length>2000)this.events.splice(0,this.events.length-2000);
  }
  getActor(id) { return this.actors.find(a=>a.id===id); }
  areEnemies(a,b) { return !!a && !!b && a.id!==b.id && !(this.match.mode==='tdm'&&a.team&&a.team===b.team); }
  eye(actor) { return {x:actor.pos.x,y:actor.pos.y+actor.height*.9,z:actor.pos.z}; }
  groundHeight(x,z) { return groundHeight(this.map,x,z); }
  worldRaycast(origin,dir,range) { return worldRaycast(this.map,origin,dir,range); }
  raycast(origin,dir,range,ignoreId=null) {
    let hit=this.worldRaycast(origin,dir,range);
    for(const actor of this.actors) {
      if(!actor.alive||actor.id===ignoreId)continue;
      const p=actor.pos,h=actor.height,r=actor.radius;
      const body=rayBox(origin,dir,{x:p.x-r,y:p.y+.1,z:p.z-r},{x:p.x+r,y:p.y+h*.71,z:p.z+r},range);
      const head=raySphere(origin,dir,{x:p.x,y:p.y+h*.82,z:p.z},r*.87,range);
      for(const [test,headshot] of [[body,false],[head,true]]) if(test&&(!hit||test.distance<hit.distance))hit={...test,actor,headshot,obstacle:null};
    }
    return hit;
  }
  canSee(a,b) {
    if(!a.alive||!b.alive)return false;
    const from=this.eye(a),to={...b.pos,y:b.pos.y+b.height*.65},d=distance(from,to);
    const hit=this.worldRaycast(from,normalize(sub(to,from)),d);
    return !hit||hit.distance>=d-.05;
  }
  addImpulse(actor,impulse,attackerId=null) {
    if(!actor.alive||!impulse)return;
    const resistance=(PERKS[actor.equipment.perk]?.impulseResistance||1)*(CLASSES[actor.equipment.classId]?.impulseResistance||1)*(actor.bracedUntil>this.time?.3:1);
    for(const key of ['x','y','z'])actor.vel[key]=clamp(actor.vel[key]+(Number(impulse[key])||0)*resistance,-32,32);
    if(impulse.y>1)actor.grounded=false;
    if(attackerId&&this.areEnemies(this.getActor(attackerId),actor)&&this.time>=(actor.nextImpactCharge||0)){
      actor.impulseCharge=clamp((actor.impulseCharge||0)+8,0,100);actor.nextImpactCharge=this.time+1;
    }
  }
  damage(target,amount,{attackerId=null,weaponId='',headshot=false,impulse=null}={}) {
    if(this.match.state!=='playing'||!target?.alive||this.time<target.invulnerableUntil||!Number.isFinite(amount)||amount<=0)return false;
    const attacker=this.getActor(attackerId);
    if(attacker&&attacker!==target&&!this.areEnemies(attacker,target))return false;
    this.addImpulse(target,impulse,attackerId);
    const damage=amount*(target.bracedUntil>this.time?.65:1),dealt=Math.min(target.health,damage);
    target.health=Math.max(0,target.health-damage);target.lastDamageAt=this.time;target.lastDamagedBy=attackerId;
    if(attacker&&this.areEnemies(attacker,target)) {
      attacker.damageDealt+=dealt;
      const hits=(target.damageContributors[attacker.id]?.hits||[]).filter(hit=>this.time-hit.time<=6);
      hits.push({time:this.time,damage:dealt});
      target.damageContributors[attacker.id]={hits};
    }
    this.emit({type:'damage',actorId:target.id,attackerId,amount:dealt,headshot,point:{...target.pos,y:target.pos.y+1}});
    if(target.health===0) {
      target.alive=false;target.deaths++;target.streak=0;target.respawnAt=this.time+2.8;target.intent={};
      if(attacker&&this.areEnemies(attacker,target)) {
        attacker.kills++;attacker.streak++;attacker.bestStreak=Math.max(attacker.bestStreak,attacker.streak);
        if(this.match.mode==='tdm'&&attacker.team)this.match.teamScores[attacker.team]++;
      }
      for(const [id,entry] of Object.entries(target.damageContributors)) {
        const helper=this.getActor(id);
        const recentDamage=entry.hits.reduce((sum,hit)=>sum+(this.time-hit.time<=6?hit.damage:0),0);
        if(id!==attackerId&&helper&&this.areEnemies(helper,target)&&recentDamage>=20) {helper.assists++;this.emit({type:'assist',actorId:helper.id,targetId:target.id});}
      }
      this.emit({type:'eliminate',actorId:target.id,attackerId,weaponId,headshot,point:{...target.pos,y:target.pos.y+.8},color:target.color});
      if(this.match.mode==='tdm') {if(Object.values(this.match.teamScores).some(score=>score>=this.match.scoreLimit))this.end('score');}
      else if(attacker&&attacker.kills>=this.match.scoreLimit)this.end('score');
    }
    return true;
  }
  rankings() { return [...this.actors].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths||b.assists-a.assists||a.name.localeCompare(b.name)); }
  end(reason) {
    if(this.match.state==='ended')return;
    this.match.state='ended';this.match.endReason=reason;
    const leaders=this.rankings();
    this.match.winnerId=leaders[0]?.id||null;
    if(this.match.mode==='tdm') {
      const {a,b}=this.match.teamScores;this.match.winnerTeam=a===b?null:a>b?'a':'b';
      this.match.winnerId=this.match.winnerTeam?leaders.find(actor=>actor.team===this.match.winnerTeam)?.id||null:null;
    }
    this.emit({type:'matchEnd',winnerId:this.match.winnerId,winnerTeam:this.match.winnerTeam,reason});
  }
  respawn(actor) {
    let best=this.map.spawns[0],score=-Infinity;
    const enemies=this.actors.filter(a=>a.alive&&this.areEnemies(actor,a));
    const others=this.actors.filter(a=>a!==actor&&a.alive);
    let points=this.map.spawns;
    if(points.every(point=>others.some(other=>distance(point,other.pos)<1.2))) {
      points=[...points];
      for(const origin of this.map.spawns)for(const [x,z] of [[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]]){
        const point={x:origin.x+x,y:origin.y,z:origin.z+z};
        if(Math.max(Math.abs(point.x),Math.abs(point.z))>this.map.size/2-actor.radius)continue;
        point.y=groundHeight(this.map,point.x,point.z,origin.y+.3);
        if(this.map.obstacles.some(b=>Math.abs(point.x-b.x)<b.w/2+actor.radius&&Math.abs(point.z-b.z)<b.d/2+actor.radius&&point.y<b.y+b.h&&point.y+actor.height>b.y))continue;
        points.push(point);
      }
    }
    for(const point of points) {
      let value=(enemies.length?Math.min(...enemies.map(a=>distance(a.pos,point))):30)+this.rng()*2;
      if(others.some(other=>distance(point,other.pos)<1.2))value-=100;
      // Team side is a preference, not a trap: enemy proximity can outweigh it.
      if(this.match.mode==='tdm'&&(actor.team==='a'?point.x<0:point.x>0))value+=5;
      for(const enemy of enemies) {
        const from=this.eye(enemy),to={...point,y:point.y+1.2},d=distance(from,to);
        if(d<18&&!this.worldRaycast(from,normalize(sub(to,from)),d))value-=5;
      }
      if(value>score){score=value;best=point;}
    }
    actor.pos={...best};actor.prevPos={...best};actor.vel={x:0,y:0,z:0};actor.alive=true;actor.health=actor.maxHealth;
    actor.height=1.8;actor.grounded=true;actor.invulnerableUntil=this.time+1.3;actor.ai={};actor.intent={};actor.pitch=0;
    actor.yaw=Math.atan2(actor.pos.x,actor.pos.z);actor.lastDamageAt=-999;actor.lastDamagedBy=null;actor.damageContributors={};actor.activeSlot=0;
    actor.bracedUntil=0;actor.slowedUntil=0;actor.hasteUntil=0;actor.slideRemaining=0;actor.slideCooldown=0;actor.wasCrouching=false;actor.nextImpactCharge=0;
    this.combat.equip(actor);this.emit({type:'spawn',actorId:actor.id,point:{...actor.pos}});
  }
  setPaused(value) {this.paused=!!value;}
  applyInput(actor,input={}) {
    if(Number.isFinite(input.yaw))actor.yaw=input.yaw;
    if(Number.isFinite(input.pitch))actor.pitch=clamp(input.pitch,-1.48,1.48);
    if(!actor.alive||this.match.state!=='playing')return;
    const yaw=actor.yaw,mx=number(input.moveX,0,-1,1),mz=number(input.moveZ,0,-1,1);
    actor.intent={moveX:Math.cos(yaw)*mx-Math.sin(yaw)*mz,moveZ:-Math.sin(yaw)*mx-Math.cos(yaw)*mz,sprint:!!input.sprint&&!input.alt,crouch:!!input.crouch,jump:!!input.jump};actor.aiming=!!input.alt;
    if(input.switchSlot===0||input.switchSlot===1)this.combat.switchWeapon(actor,input.switchSlot);
    if(input.reload)this.combat.reload(actor);
    const dir=direction(actor.yaw,actor.pitch);
    if(input.ability)this.combat.useAbility?.(actor,dir);
    if(input.impulse)this.combat.useImpulse?.(actor,dir);
    if(input.tactical)this.combat.useGadget(actor,'tactical',dir);
    if(input.lethal)this.combat.useGadget(actor,'lethal',dir);
    if(input.fire)this.combat.fire(actor,dir,!!input.alt);
  }
  step(dt,input=null) {
    if(this.paused||!['countdown','playing'].includes(this.match.state)||!(dt>0)||dt>.1)return;
    this.time+=dt;
    const playerInput=input||this.humanInputs.get(this.player.id)||{};
    if(this.match.state==='countdown') {
      if(Number.isFinite(playerInput.yaw))this.player.yaw=playerInput.yaw;
      if(Number.isFinite(playerInput.pitch))this.player.pitch=clamp(playerInput.pitch,-1.48,1.48);
      this.match.countdown=Math.max(0,this.match.countdown-dt);
      if(this.match.countdown<=1e-6){this.match.state='playing';this.match.countdown=0;this.emit({type:'go'});}return;
    }
    this.match.remaining=Math.max(0,this.match.remaining-dt);
    if(this.match.remaining<=1e-6){this.end('time');return;}
    const respawned=new Set();
    for(const actor of this.actors)if(!actor.alive&&this.time>=actor.respawnAt){this.respawn(actor);respawned.add(actor.id);}
    const freshInput=(actor,controls)=>respawned.has(actor.id)?{...controls,yaw:actor.yaw,pitch:actor.pitch}:controls;
    this.applyInput(this.player,freshInput(this.player,playerInput));
    for(const actor of this.actors)if(actor.isHuman&&actor!==this.player)this.applyInput(actor,freshInput(actor,this.humanInputs.get(actor.id)||{}));
    if(this.match.state!=='playing')return;
    this.ai.update(dt);
    if(this.match.state!=='playing')return;
    for(const actor of this.actors)if(actor.alive) {
      actor.prevPos={...actor.pos};
      moveActor(actor,dt,this.map,movementModifiers(actor,this.time),event=>this.emit(event));
      const moved=Math.hypot(actor.pos.x-actor.prevPos.x,actor.pos.z-actor.prevPos.z);
      actor.impulseCharge=clamp((actor.impulseCharge||0)+Math.min(moved*1.5,dt*10),0,100);
    }
    this.combat.update(dt);
  }
}
