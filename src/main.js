import { Game } from './game/Game.js';
import { Renderer } from './render/Renderer.js';
import { UI } from './ui/UI.js';
import { Input } from './platform/Input.js';
import { GameAudio } from './platform/Audio.js';
import './ui/style.css';

const root = document.querySelector('#app'), canvas = document.querySelector('#game-canvas');
let game, ui, renderer, input, audio, accumulator = 0, lastTime = performance.now(), resultShown = false;
const active = () => game && ['playing', 'countdown'].includes(game.match.state);
function releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); }
function pause() {
  if (!active() || game.paused) return;
  game.setPaused(true); accumulator = 0; input.clear(); ui.showPause(); releasePointer();
}
function acquirePointer() {
  input.lock().catch(() => { pause(); ui.notify('Click Resume to capture the mouse. Your browser must allow pointer lock.'); });
}
function start(config, loadout) {
  game.start(config, loadout); input.clear(); input.sync(game.player); accumulator = 0; resultShown = false;
  audio.unlock(); renderer.applySettings(ui.settings); acquirePointer();
}
function resume() { if (!active()) return; audio.unlock(); input.clear(); ui.hidePause(); game.setPaused(false); accumulator = 0; acquirePointer(); }
function menu() { game.match.state = 'menu'; game.paused = false; input.clear(); resultShown = false; releasePointer(); ui.showMenu(); }
function dispatchEvents() {
  const events = game.events.splice(0);
  if (events.some(e => e.type === 'spawn' && e.actorId === 'player')) input.sync(game.player);
  renderer.handleEvents(events); audio.handleEvents(events, game); ui.handleEvents(events, game);
  if (game.match.state === 'ended' && !resultShown) { resultShown = true; input.clear(); ui.showResults(game); releasePointer(); }
}

try {
  ui = new UI(root, {
    onStart: start, onPause: pause, onResume: resume, onMenu: menu,
    onRestart: () => ui.startGame(),
    onSettings: settings => { if (input) input.settings = settings; renderer?.applySettings(settings); audio?.applySettings(settings); },
    onFullscreen: () => {
      const operation = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      operation?.catch(() => ui.notify('Fullscreen is unavailable in this browser context.'));
    },
  });
  game = new Game({ loadout: ui.loadout });
  renderer = new Renderer(canvas, game, ui.settings); audio = new GameAudio(ui.settings);
  input = new Input(canvas, ui.settings, (command, value) => {
    if (command === 'pause' || command === 'unlock') pause();
    if (command === 'lockerror') { pause(); ui.notify('Mouse capture was denied. Click Resume to try again.'); }
    if (command === 'scoreboard') ui.showScoreboard(value && active(), game);
    if (command === 'switch' && active() && !game.paused) input.edges.switchSlot = 1 - game.player.activeSlot;
  });
  document.addEventListener('click', e => { if (e.target.closest('button')) { audio.unlock(); audio.menu(); } });
  window.addEventListener('resize', () => renderer.resize());
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pause(); ui.notify('Graphics context lost. Reload the page to restore the renderer.'); });
  ui.showMenu();
  function frame(now) {
    const dt = Math.min(.25, Math.max(0, (now - lastTime) / 1000)); lastTime = now;
    if (active() && !game.paused) {
      accumulator += dt;
      while (accumulator >= 1 / 60) {
        const wasAlive = game.player.alive;
        game.step(1 / 60, input.read());
        // A respawn may occur within a batch. Adopt its new heading before the
        // following input frame can replace it with the old death-camera angle.
        if (!wasAlive && game.player.alive) input.sync(game.player);
        accumulator -= 1 / 60;
      }
    } else accumulator = 0;
    dispatchEvents(); renderer.render(dt, accumulator * 60); ui.update(game, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (new URLSearchParams(location.search).has('debug')) {
    window.__CHAOS__ = {
      game, ui, renderer, input,
      start: (config, loadout = ui.loadout) => { game.start(config, loadout); input.sync(game.player); resultShown = false; ui.isOverlayOpen = false; },
      advance: seconds => { for (let i = 0; i < Math.ceil(seconds * 60); i++) game.step(1 / 60, {}); dispatchEvents(); renderer.render(1/60); ui.update(game, 1/60); },
    };
  }
} catch (error) {
  console.error(error);
  root.replaceChildren();
  const panel = document.createElement('section'); panel.className = 'fatal-error';
  const title = document.createElement('h1'); title.textContent = 'THE CHAOS NEEDS A TUNE-UP.';
  const detail = document.createElement('p'); detail.textContent = 'The game could not start. Use a current desktop browser with WebGL enabled. ' + error.message;
  const button = document.createElement('button'); button.textContent = 'RETRY'; button.addEventListener('click', () => location.reload());
  panel.append(title, detail, button); root.append(panel);
}
