export class Input {
  constructor(canvas, settings, command) {
    this.canvas = canvas; this.settings = settings; this.command = command; this.keys = new Set(); this.buttons = new Set();
    this.yaw = 0; this.pitch = 0; this.edges = {}; this.locked = false;
    document.addEventListener('keydown', e => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === 'Tab') { if (this.locked) { e.preventDefault(); command('scoreboard', true); } return; }
      if (e.code === 'Escape') { command('pause'); return; }
      if (!this.locked) return;
      if (['Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ControlLeft','ControlRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) {
        const actions = { Space: 'jump', KeyR: 'reload', KeyQ: 'tactical', KeyE: 'lethal' };
        if (actions[e.code]) this.edges[actions[e.code]] = true;
        if (e.code === 'Digit1') this.edges.switchSlot = 0;
        if (e.code === 'Digit2') this.edges.switchSlot = 1;
      }
    });
    document.addEventListener('keyup', e => { this.keys.delete(e.code); if (e.code === 'Tab' && this.locked) { e.preventDefault(); command('scoreboard', false); } });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      const factor = .0021 * (Number(this.settings.sensitivity) || 1) * (this.buttons.has(2) ? .66 : 1);
      this.yaw -= e.movementX * factor; this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch - e.movementY * factor));
    });
    document.addEventListener('mousedown', e => { if (this.locked) this.buttons.add(e.button); });
    document.addEventListener('mouseup', e => this.buttons.delete(e.button));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => { if (this.locked) { e.preventDefault(); command('switch'); } }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (!this.locked) { this.clear(); command('unlock'); } });
    document.addEventListener('pointerlockerror', () => { this.clear(); command('lockerror'); });
    window.addEventListener('blur', () => { this.clear(); command('pause'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); command('pause'); } });
  }
  read() {
    const has = key => this.keys.has(key);
    const result = { moveX: Number(has('KeyD')) - Number(has('KeyA')), moveZ: Number(has('KeyW')) - Number(has('KeyS')), yaw: this.yaw, pitch: this.pitch,
      sprint: has('ShiftLeft') || has('ShiftRight'), crouch: has('ControlLeft') || has('ControlRight') || has('KeyC'), fire: this.buttons.has(0), alt: this.buttons.has(2), switchSlot: null, ...this.edges };
    this.edges = {}; return result;
  }
  clear() { this.keys.clear(); this.buttons.clear(); this.edges = {}; }
  sync(actor) { this.yaw = actor.yaw; this.pitch = actor.pitch; }
  async lock() { if (document.pointerLockElement !== this.canvas) await this.canvas.requestPointerLock(); }
}
