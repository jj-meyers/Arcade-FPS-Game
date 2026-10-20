import { Game } from './game/Game.js';
import { Renderer } from './render/Renderer.js';
import { UI } from './ui/UI.js';
import { Input } from './platform/Input.js';
import { GameAudio } from './platform/Audio.js';
import { GAME_TITLE, COSMETICS, normalizeLoadout } from './data/customization.js';
import { NetworkClient } from './net/NetworkClient.js';
import { applySnapshot } from './net/snapshot.js';
import './ui/style.css';

const root=document.querySelector('#app'),canvas=document.querySelector('#game-canvas');
document.title=GAME_TITLE;canvas.setAttribute('aria-label',`${GAME_TITLE} 3D game`);
let game,ui,renderer,input,audio,network,online=false,accumulator=0,lastTime=performance.now(),lastSnapshotAt=0,resultShown=false;
const active=()=>game&&['playing','countdown'].includes(game.match.state);
function releasePointer(){if(document.pointerLockElement)document.exitPointerLock();}
function pause(){
  if(!active()||game.paused)return;
  game.setPaused(true);accumulator=0;input.clear();ui.showPause();releasePointer();
  if(online)network.sendInput({yaw:input.yaw,pitch:input.pitch});
}
function acquirePointer(){input.lock().catch(()=>{pause();ui.notify('Click Resume to capture the mouse.');});}
function leaveNetwork(){
  network?.disconnect();online=false;game.networkTick=-1;game.networkSession=null;
  if(ui){ui.networkLobby=null;ui.networkState=null;ui.lobbyState=null;ui.isNetworked=false;}
}
function previewLoadout(value){
  if(!game||game.match.state!=='menu')return;
  const loadout=normalizeLoadout(value);game.menuLoadout=loadout;
  Object.assign(game.player,{equipment:loadout,classId:loadout.classId,cosmetics:{...loadout.cosmetics},color:COSMETICS.bodyColor[loadout.cosmetics.bodyColor].color});
  game.combat.equip(game.player);
}
function start(config,loadout){
  leaveNetwork();game.start(config,loadout);input.clear();input.sync(game.player);accumulator=0;resultShown=false;
  audio.unlock();renderer.applySettings(ui.settings);acquirePointer();
}
function resume(){if(!active())return;audio.unlock();input.clear();ui.hidePause();game.setPaused(false);accumulator=0;acquirePointer();}
function menu(){
  leaveNetwork();game.match.state='menu';game.paused=false;input.clear();resultShown=false;releasePointer();ui.showMenu();previewLoadout(ui.loadout);
}
async function connectNetwork(options){
  input.clear();releasePointer();game.match.state='menu';game.paused=false;resultShown=false;
  ui.setNetworkStatus?.('Connecting…');
  try {await network.connect(options);}
  catch(error){if(error.name==='AbortError')return;online=false;ui.setNetworkStatus?.(error.message,true);ui.notify(error.message);}
}
function startNetwork(){
  if(!network?.connected)return;
  if(!network.lobby?.isHost){ui.notify('The host starts the match.');return;}
  audio.unlock();input.clear();acquirePointer();network.startMatch();
}
function dispatchEvents(){
  const events=game.events.splice(0);
  if(events.some(e=>e.type==='spawn'&&e.actorId===game.player.id))input.sync(game.player);
  renderer.handleEvents(events);audio.handleEvents(events,game);ui.handleEvents(events,game);
  if(game.match.state==='ended'&&!resultShown){resultShown=true;input.clear();ui.showResults(game);releasePointer();}
}
try {
  ui=new UI(root,{
    onStart:start,onPause:pause,onResume:resume,onMenu:menu,
    onRestart:()=>online?startNetwork():ui.startGame(),onPreviewLoadout:previewLoadout,
    onNetwork:connectNetwork,onNetworkStart:startNetwork,onNetworkLeave:menu,onDisconnect:menu,
    onSettings:settings=>{if(input)input.settings=settings;renderer?.applySettings(settings);audio?.applySettings(settings);},
    onFullscreen:()=>{const operation=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();operation?.catch(()=>ui.notify('Fullscreen is unavailable here.'));},
  });
  game=new Game({loadout:ui.loadout});previewLoadout(ui.loadout);
  renderer=new Renderer(canvas,game,ui.settings);audio=new GameAudio(ui.settings);
  input=new Input(canvas,ui.settings,(command,value)=>{
    if(command==='pause'||command==='unlock')pause();
    if(command==='lockerror'){pause();ui.notify('Mouse capture was denied. Click Resume to try again.');}
    if(command==='scoreboard')ui.showScoreboard(value&&active(),game);
    if(command==='switch'&&active()&&!game.paused)input.edges.switchSlot=1-game.player.activeSlot;
  });
  network=new NetworkClient({
    onLobby:state=>{
      online=true;ui.networkLobby=state;ui.lobbyState=state;ui.isNetworked=true;
      if(state.status==='lobby'||game.match.state==='menu')ui.showLobby(state);
      else if(state.status==='ended'&&resultShown)ui.showResults(game);
    },
    onState:snapshot=>{
      const beginning=!active()&&snapshot.match.state!=='ended';
      const wasAlive=game.player.alive;
      if(!applySnapshot(game,snapshot))return;
      lastSnapshotAt=performance.now();
      if(beginning){
        resultShown=false;game.paused=false;input.clear();input.sync(game.player);accumulator=0;
        ui.beginNetworkMatch?.();renderer.applySettings(ui.settings);
        if(!input.locked)pause();
      }else if(!wasAlive&&game.player.alive)input.sync(game.player);
    },
    onError:message=>{ui.setNetworkStatus?.(message,true);ui.notify(message);},
    onClose:message=>{online=false;ui.networkLobby=null;ui.lobbyState=null;ui.isNetworked=false;game.match.state='menu';game.paused=false;input.clear();releasePointer();ui.showMenu();ui.notify(message);},
  });
  document.addEventListener('click',e=>{if(e.target.closest('button')){audio.unlock();audio.menu();}});
  window.addEventListener('resize',()=>renderer.resize());
  window.addEventListener('beforeunload',()=>network.disconnect());
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();ui.notify('Graphics context lost. Reload to restore the game.');});
  ui.showMenu();
  function frame(now){
    const dt=Math.min(.25,Math.max(0,(now-lastTime)/1000));lastTime=now;
    let alpha=1;
    if(online&&active()){
      const controls=!game.paused&&input.locked?input.read():{yaw:input.yaw,pitch:input.pitch};
      network.sendInput(controls);accumulator=0;
      if(game.player.alive){game.player.yaw=input.yaw;game.player.pitch=input.pitch;}
      alpha=Math.min(1,(now-lastSnapshotAt)/(1000/15));
    }else if(active()&&!game.paused){
      accumulator+=dt;
      while(accumulator>=1/60){
        const wasAlive=game.player.alive;game.step(1/60,input.read());
        if(!wasAlive&&game.player.alive)input.sync(game.player);
        accumulator-=1/60;
      }
      alpha=accumulator*60;
    }else accumulator=0;
    dispatchEvents();renderer.render(dt,alpha);ui.update(game,dt);audio.tick?.(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if(new URLSearchParams(location.search).has('debug')){
    window.__UNFUG__=window.__CHAOS__={
      game,ui,renderer,input,network,
      start:(config,loadout=ui.loadout)=>{leaveNetwork();game.start(config,loadout);input.sync(game.player);resultShown=false;ui.isOverlayOpen=false;},
      advance:seconds=>{if(online)throw new Error('Online simulation belongs to the server.');for(let i=0;i<Math.ceil(seconds*60);i++)game.step(1/60,{});dispatchEvents();renderer.render(1/60);ui.update(game,1/60);},
      connect:connectNetwork,startNetwork,disconnect:menu,
    };
  }
}catch(error){
  console.error(error);root.replaceChildren();
  const panel=document.createElement('section');panel.className='fatal-error';
  const title=document.createElement('h1');title.textContent=`${GAME_TITLE} could not start`;
  const detail=document.createElement('p');detail.textContent='Use a current desktop browser with WebGL enabled. '+error.message;
  const button=document.createElement('button');button.textContent='Retry';button.addEventListener('click',()=>location.reload());
  panel.append(title,detail,button);root.append(panel);
}
