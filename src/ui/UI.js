import { WEAPONS, GADGETS, PERKS, PRESETS, DEFAULT_LOADOUT } from '../data/catalog.js';

const STORAGE_KEY = 'chaos-fps:preferences:v1';
const DEFAULT_SETTINGS = Object.freeze({ sensitivity: 1, fov: 85, masterVolume: .7, sfxVolume: .8, quality: 'high', renderScale: 1, crosshair: 'cross', shake: .5 });
const DEFAULT_MATCH = Object.freeze({ botCount: 5, difficulty: 'normal', duration: 180, scoreLimit: 20 });
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const finite = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const member = (value, values, fallback) => values.includes(value) ? value : fallback;
const tint = value => typeof value === 'number' ? `#${value.toString(16).padStart(6, '0')}` : /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : '#d6ff38';
const time = seconds => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, '0')}`;
const arrow = '<span aria-hidden="true">↗</span>';
const controlRows = [ ['W A S D', 'Move around'], ['MOUSE', 'Look & aim'], ['LMB / RMB', 'Fire / aim or alternate fire'], ['SHIFT', 'Sprint'], ['SPACE', 'Jump'], ['C / CTRL', 'Crouch'], ['R', 'Reload'], ['1 / 2', 'Switch weapons'], ['Q / E', 'Tactical / lethal gadget'], ['TAB', 'Hold for scoreboard'], ['ESC', 'Pause / release mouse'] ];

function validateSettings(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return { sensitivity: finite(v.sensitivity, 1, .2, 3), fov: finite(v.fov, 85, 65, 110), masterVolume: finite(v.masterVolume, .7, 0, 1), sfxVolume: finite(v.sfxVolume, .8, 0, 1), quality: member(v.quality, ['low', 'medium', 'high'], 'high'), renderScale: finite(v.renderScale, 1, .5, 1.5), crosshair: member(v.crosshair, ['cross', 'dot', 'circle'], 'cross'), shake: finite(v.shake, .5, 0, 1) };
}

function validateLoadout(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  const result = { ...DEFAULT_LOADOUT };
  for (const slot of ['primary', 'secondary']) if (Object.hasOwn(WEAPONS, v[slot])) result[slot] = v[slot];
  for (const slot of ['tactical', 'lethal']) if (Object.hasOwn(GADGETS, v[slot]) && GADGETS[v[slot]].slot === slot) result[slot] = v[slot];
  if (Object.hasOwn(PERKS, v.perk)) result.perk = v.perk;
  return result;
}

function validateMatch(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return { botCount: Math.round(finite(v.botCount, 5, 1, 12)), difficulty: member(v.difficulty, ['easy', 'normal', 'hard'], 'normal'), duration: member(v.duration, [60, 180, 300, 600], 180), scoreLimit: member(v.scoreLimit, [10, 20, 30, 50], 20) };
}

function weaponArt(id, color) {
  const pieces = {
    fizz: '<path d="M34 35h67v17H34zM48 52h18l-4 19H48zM101 39h26v8h-26z"/><rect x="38" y="22" width="22" height="13" rx="5"/><path d="M71 30h18v5H71z"/>',
    doorbell: '<path d="M24 37h89v19H24zM47 56h20l-4 17H49zM91 28h36v9H91zM112 39h21v15h-21z"/><circle cx="78" cy="31" r="11"/>',
    bankshot: '<path d="M33 34h65v22H33zM41 56h18l6 18H47zM98 38h30v13H98z"/><circle cx="79" cy="45" r="17"/><circle cx="79" cy="45" r="8" fill="#24252a"/>',
    confetti: '<path d="M38 27h69v33H38zM45 60h18l-4 16H47zM107 33h19v21h-19z"/><path d="M27 33h11v21H27zM63 22h21v5H63z"/><circle cx="86" cy="44" r="8" fill="#24252a"/>',
    rail: '<path d="M25 41h82v14H25zM49 55h18l-5 19H48zM107 44h34v7h-34zM60 27h32v8H60zM72 35h8v6h-8z"/><path d="M24 36h11v24H24z"/>',
    updraft: '<path d="M31 34h64v23H31zM48 57h16l-3 18H49zM95 27h28v38H95z"/><circle cx="108" cy="46" r="12" fill="#24252a"/><path d="M103 49l5-9 5 9z"/>',
    yoink: '<path d="M34 37h65v20H34zM48 57h17l-5 17H49zM99 42h20v10H99z"/><path d="M109 27v9h15v22h-15v9h24V27z"/><circle cx="71" cy="46" r="10" fill="#24252a"/>'
  };
  return `<svg class="weapon-art" viewBox="0 0 160 95" fill="${tint(color)}" aria-hidden="true">${pieces[id] || pieces.fizz}</svg>`;
}

/** DOM presentation only. Callbacks own game state, audio, pointer lock, and renderer settings. */
export class UI {
  constructor(root, callbacks = {}) {
    this.root = root;
    this.callbacks = callbacks;
    let saved = {};
    try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed; } catch { /* Private browsing and malformed storage use safe defaults. */ }
    this.settings = validateSettings(saved.settings);
    this.loadout = validateLoadout(saved.loadout);
    this.matchConfig = validateMatch(saved.matchConfig);
    this.isOverlayOpen = true;
    this.view = 'main';
    this.context = 'menu';
    this.loadoutSlot = 'primary';
    this.feed = [];
    this.elapsed = 0;
    this.hitUntil = 0;
    this.damageUntil = 0;
    this.eliminationUntil = 0;
    this.toastUntil = 0;
    this.scoreboardVisible = false;
    this.root.classList.add('chaos-ui');
    this.root.innerHTML = `
      <div class="menu-shell" data-el="menu">
        <header class="topbar"><button class="brand" data-action="main" aria-label="Chaos FPS home"><span class="brand-mark" aria-hidden="true">✳</span><span>CHAOS<span class="brand-small">FPS</span></span></button>
          <nav aria-label="Main navigation"><button data-action="main" data-nav="main">THE LOBBY</button><button data-action="loadout" data-nav="loadout">THE ARSENAL <span>07</span></button><button data-action="settings" data-nav="settings">SETTINGS</button></nav>
          <span class="status-pill"><i></i> ALL SYSTEMS UNHINGED</span>
        </header>
        <main class="menu-content" data-el="content"></main>
        <footer class="menu-footer"><span>GOOD AIM. QUESTIONABLE DECISIONS.</span><button data-action="controls"><span class="keyboard-icon">⌨</span> CONTROLS <span>↗</span></button><span class="build-label">VOL. 001 <span> / </span> THE FIRST MESS</span></footer>
      </div>
      <div class="game-hud" data-el="hud" hidden>
        <div class="hud-top"><div class="hud-mode"><b>FREE FOR ALL</b><span>EVERY BEAN FOR THEMSELVES</span></div><div class="match-clock"><span data-el="timer">3:00</span><small>FIRST TO <b data-el="score-limit">20</b></small></div><div class="hud-score"><span>YOUR SCORE</span><b data-el="score">00</b><small data-el="rank">1ST PLACE</small></div></div>
        <div class="kill-feed" data-el="feed" aria-live="polite"></div>
        <div class="crosshair crosshair-cross" data-el="crosshair" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
        <div class="hit-marker" data-el="hitmarker" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="damage-vignette" data-el="damage" aria-hidden="true"></div>
        <div class="center-notice" data-el="center" hidden></div>
        <div class="elimination-notice" data-el="elimination" hidden></div>
        <div class="hud-bottom"><div class="health-block"><div class="health-number"><span class="health-plus">+</span><b data-el="health">100</b><small>HP</small></div><div class="health-track"><i data-el="health-bar"></i></div><span class="hud-hint">SHIFT SPRINT <i>·</i> SPACE JUMP</span></div>
          <div class="gadget-bar"><div class="gadget-slot" data-el="tactical-slot"><kbd>Q</kbd><span data-el="tactical-name">TACTICAL</span><b data-el="tactical-cooldown">READY</b></div><div class="gadget-slot" data-el="lethal-slot"><kbd>E</kbd><span data-el="lethal-name">LETHAL</span><b data-el="lethal-cooldown">READY</b></div></div>
          <div class="ammo-block"><span class="weapon-label" data-el="weapon-name">FIZZ</span><div class="ammo-number"><b data-el="ammo">30</b><span>/ <i data-el="reserve">120</i></span></div><div class="reload-line" data-el="reload">R RELOAD <i>·</i> 1 / 2 SWITCH</div></div>
        </div><span class="hud-pause-hint">TAB SCOREBOARD <i>·</i> ESC PAUSE</span>
      </div>
      <div class="modal-overlay" data-el="pause" hidden></div>
      <div class="modal-overlay results-overlay" data-el="results" hidden></div>
      <div class="scoreboard-overlay" data-el="scoreboard" hidden></div>
      <div class="toast" data-el="toast" role="status" hidden></div>`;
    this.el = Object.fromEntries([...root.querySelectorAll('[data-el]')].map(node => [node.dataset.el, node]));
    this._onClick = event => this.handleClick(event);
    this._onInput = event => this.handleInput(event);
    root.addEventListener('click', this._onClick);
    root.addEventListener('input', this._onInput);
    root.addEventListener('change', this._onInput);
    this.showMenu();
  }

  persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: this.settings, loadout: this.loadout, matchConfig: this.matchConfig })); } catch { /* Playing remains available when storage is full or disabled. */ }
  }

  handleClick(event) {
    const button = event.target.closest('button');
    if (!button || !this.root.contains(button) || button.disabled) return;
    if (button.dataset.action) {
      switch (button.dataset.action) {
        case 'start': this.startGame(); break;
        case 'setup': this.openView('setup'); break;
        case 'main': if (this.context === 'pause') this.returnToMenu(); else this.openView('main'); break;
        case 'loadout': this.openView('loadout'); break;
        case 'settings': this.openView('settings'); break;
        case 'controls': this.openView('controls'); break;
        case 'back': if (this.context === 'pause') this.showPause(); else this.openView('main'); break;
        case 'resume': this.hidePause(); this.callbacks.onResume?.(); break;
        case 'menu': this.returnToMenu(); break;
        case 'restart': this.feed = []; this.hideOverlays(); this.el.hud.hidden = false; this.callbacks.onRestart?.(); break;
        case 'fullscreen': this.callbacks.onFullscreen?.(); break;
        case 'reset-settings': this.settings = { ...DEFAULT_SETTINGS }; this.persist(); this.callbacks.onSettings?.({ ...this.settings }); this.renderSettings(); this.notify('Fresh settings. Same bad intentions.'); break;
      }
    }
    if (button.dataset.difficulty) { this.matchConfig.difficulty = button.dataset.difficulty; this.persist(); this.renderSetup(); }
    if (button.dataset.botStep) { this.matchConfig.botCount = Math.min(12, Math.max(1, this.matchConfig.botCount + Number(button.dataset.botStep))); this.persist(); this.renderSetup(); }
    if (button.dataset.slot) { this.loadoutSlot = button.dataset.slot; this.renderLoadout(); }
    if (button.dataset.equip) {
      const slot = this.loadoutSlot;
      const id = button.dataset.equip;
      if (slot === 'primary' || slot === 'secondary') {
        const other = slot === 'primary' ? 'secondary' : 'primary';
        if (this.loadout[other] === id) this.loadout[other] = this.loadout[slot];
      }
      this.loadout[slot] = id;
      this.persist(); this.renderLoadout();
    }
    if (button.dataset.preset && PRESETS[button.dataset.preset]) { this.loadout = validateLoadout(PRESETS[button.dataset.preset].loadout); this.persist(); this.renderLoadout(); this.notify(`${PRESETS[button.dataset.preset].name} equipped.`); }
    this.fixGlyphs();
  }

  handleInput(event) {
    const node = event.target;
    if (node.dataset.setting) {
      const key = node.dataset.setting;
      const value = ['quality', 'crosshair'].includes(key) ? node.value : Number(node.value);
      if (this.settings[key] === value) return;
      this.settings = validateSettings({ ...this.settings, [key]: value });
      this.persist();
      const output = this.root.querySelector(`[data-output="${key}"]`);
      if (output) output.textContent = this.settingDisplay(key, this.settings[key]);
      this.applyRangeFill(node);
      this.callbacks.onSettings?.({ ...this.settings });
    }
    if (node.dataset.match) {
      const key = node.dataset.match;
      this.matchConfig = validateMatch({ ...this.matchConfig, [key]: Number(node.value) });
      this.persist();
      if (key === 'botCount') {
        const count = this.root.querySelector('[data-bot-count]');
        if (count) count.textContent = String(this.matchConfig.botCount).padStart(2, '0');
        const players = this.root.querySelector('[data-player-count]');
        if (players) players.textContent = `${this.matchConfig.botCount + 1} TOTAL TROUBLEMAKERS`;
        const decrease = this.root.querySelector('[data-bot-step="-1"]');
        const increase = this.root.querySelector('[data-bot-step="1"]');
        if (decrease) decrease.disabled = this.matchConfig.botCount === 1;
        if (increase) increase.disabled = this.matchConfig.botCount === 12;
      }
      this.applyRangeFill(node);
    }
  }

  applyRangeFill(node) { if (node?.type === 'range') node.style.setProperty('--fill', `${100 * (Number(node.value) - Number(node.min)) / (Number(node.max) - Number(node.min))}%`); }
  fillRanges() { this.root.querySelectorAll('input[type="range"]').forEach(node => this.applyRangeFill(node)); }
  setText(key, text) { if (this.el[key] && this.el[key].textContent !== String(text)) this.el[key].textContent = String(text); }

  // Draw symbols locally so menus stay crisp even on machines without a symbol font.
  fixGlyphs() {
    const paths = {
      '↗': 'M5 19 19 5M5 5h14v14', '↘': 'M5 5l14 14M5 19h14V5', '↙': 'M19 5 5 19M5 5v14h14',
      '↻': 'M19 8a8 8 0 1 0 1 7M19 3v6h-6', '↺': 'M5 8a8 8 0 1 1-1 7M5 3v6h6',
      '✳': 'M12 2v20M2 12h20M5 5l14 14M5 19 19 5',
      '↟': 'M12 21V3M5 10l7-7 7 7M5 17l7-7 7 7',
      'ϟ': 'M14 2 5 14h7l-2 8 9-12h-7z', '↯': 'M14 2 7 12h8L8 22M8 16v6h6',
    };
    const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (/[↗↘↙↻↺✳↟ϟ↯]/u.test(walker.currentNode.data)) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const part of node.data.split(/([↗↘↙↻↺✳↟ϟ↯])/u)) {
        if (!paths[part]) { fragment.append(document.createTextNode(part)); continue; }
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ui-symbol'); svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = `<path d="${paths[part]}"/>`;
        fragment.append(svg);
      }
      node.replaceWith(fragment);
    }
  }

  hideOverlays() {
    this.isOverlayOpen = false;
    this.el.menu.hidden = true; this.el.pause.hidden = true; this.el.results.hidden = true;
    this.el.scoreboard.hidden = true; this.scoreboardVisible = false;
    this.root.classList.remove('overlay-open');
  }

  showMenu() {
    this.context = 'menu'; this.feed = []; this.el.feed.innerHTML = '';
    this.el.hud.hidden = true; this.el.pause.hidden = true; this.el.results.hidden = true;
    this.el.scoreboard.hidden = true; this.scoreboardVisible = false;
    this.openView('main');
  }

  returnToMenu() { this.showMenu(); this.callbacks.onMenu?.(); }

  openView(view) {
    this.view = view;
    this.isOverlayOpen = true;
    this.root.classList.add('overlay-open');
    this.el.menu.hidden = false; this.el.pause.hidden = true; this.el.results.hidden = true;
    this.el.menu.classList.toggle('is-home', view === 'main');
    this.el.menu.classList.toggle('from-pause', this.context === 'pause');
    this.el.content.className = `menu-content view-${view}`;
    this.root.querySelectorAll('[data-nav]').forEach(button => { const active = button.dataset.nav === view; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    if (view === 'main') this.renderMain();
    if (view === 'setup') this.renderSetup();
    if (view === 'loadout') this.renderLoadout();
    if (view === 'settings') this.renderSettings();
    if (view === 'controls') this.renderControls();
    this.fixGlyphs();
    this.el.content.scrollTop = 0;
  }

  renderMain() {
    const weapon = WEAPONS[this.loadout.primary];
    this.el.content.innerHTML = `<section class="hero"><div class="eyebrow"><span class="tiny-star">✦</span> A VERY UNSERIOUS SHOOTER</div>
      <h1><span>CHAOS</span><span class="title-line"><span class="outline-title">FPS</span><span class="title-sticker">ZERO CHILL.<br>ALL SKILL.<span aria-hidden="true">↘</span></span></span></h1>
      <p class="hero-description">Big weapons. Small brain energy.<br>Jump in, get weird, make a beautiful mess.</p>
      <div class="hero-actions"><button class="button button-acid play-button" data-action="setup"><span><small>YOU + A BUNCH OF BOTS</small>LET'S MAKE CHAOS</span><b aria-hidden="true">↗</b></button><button class="arsenal-link" data-action="loadout">BUILD YOUR LOADOUT <span aria-hidden="true">→</span></button></div>
      <div class="hero-meta"><span><i></i> FREE-FOR-ALL</span><span>1–12 BOTS</span><span>100% BAD IDEAS</span></div>
    </section><aside class="hero-right" aria-label="Arena preview"><div class="arena-tag"><span class="tag-cross">+</span><span>THE TEST PIT<br><small>NO RULES. SOME WALLS.</small></span><span class="tag-number">01</span></div><div class="mascot-callout"><span>MEET YOUR<br>NEXT PROBLEM.</span><b aria-hidden="true">↙</b></div><div class="loadout-teaser"><div class="teaser-heading"><span>TODAY'S BAD IDEA</span><span>↗</span></div><div class="teaser-body">${weaponArt(weapon.id, '#25262a')}<div><h2>${escape(weapon.name)}</h2><p>${escape(weapon.category || 'Questionable equipment')}</p></div></div><button data-action="loadout">MAKE IT YOUR PROBLEM <span>→</span></button><span class="paper-tape" aria-hidden="true"></span></div></aside>`;
  }

  pageHeading(kicker, title, detail) {
    return `<div class="page-heading"><div><button class="back-link" data-action="back">← ${this.context === 'pause' ? 'BACK TO PAUSE' : 'BACK TO LOBBY'}</button><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${detail}</p></div></div>`;
  }

  renderSetup() {
    const c = this.matchConfig;
    this.el.content.innerHTML = `<section class="inner-page setup-page">${this.pageHeading('01 / SET THE VIBE', 'PICK YOUR POISON.', 'A free-for-all. A simple arena. An unreasonable amount of trouble.')}
      <div class="setup-grid"><section class="settings-card bot-card"><div class="card-kicker">THE GUEST LIST <span>01</span></div><h2>How many frenemies?</h2><div class="bot-stepper"><button data-bot-step="-1" aria-label="Remove one bot" ${c.botCount === 1 ? 'disabled' : ''}>−</button><strong data-bot-count>${String(c.botCount).padStart(2, '0')}</strong><button data-bot-step="1" aria-label="Add one bot" ${c.botCount === 12 ? 'disabled' : ''}>+</button></div><label class="sr-only" for="bot-count">Number of bots</label><input id="bot-count" type="range" min="1" max="12" step="1" value="${c.botCount}" data-match="botCount"><div class="range-extents"><span>A LITTLE COMPANY</span><span>A BAD IDEA</span></div><div class="guest-total" data-player-count>${c.botCount + 1} TOTAL TROUBLEMAKERS</div></section>
      <section class="settings-card difficulty-card"><div class="card-kicker">THE ATTITUDE <span>02</span></div><h2>How rude should they be?</h2><div class="difficulty-options">${[['easy', 'EASY DOES IT', 'Room to breathe. Time to experiment.', '☺'], ['normal', 'A LITTLE SPICY', 'Quick feet. Fair fights. Friendly chaos.', '✳'], ['hard', 'ABSOLUTELY RUDE', 'Fast reactions. Better aim. No apologies.', '✹']].map(([id, title, description, symbol]) => `<button class="difficulty-option ${c.difficulty === id ? 'selected' : ''}" data-difficulty="${id}" aria-pressed="${c.difficulty === id}"><span class="difficulty-symbol">${symbol}</span><span><b>${title}</b><small>${description}</small></span><span class="selection-dot">${c.difficulty === id ? '✓' : ''}</span></button>`).join('')}</div></section>
      <section class="settings-card rules-card"><div class="card-kicker">THE FINE PRINT <span>03</span></div><h2>Know when to call it.</h2><label class="select-field">MATCH LENGTH<select data-match="duration">${[[60, '1 minute · quick mess'], [180, '3 minutes · just right'], [300, '5 minutes · extra spicy'], [600, '10 minutes · commitment']].map(([v, label]) => `<option value="${v}" ${c.duration === v ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="select-field">SCORE LIMIT<select data-match="scoreLimit">${[10, 20, 30, 50].map(v => `<option value="${v}" ${c.scoreLimit === v ? 'selected' : ''}>${v} eliminations</option>`).join('')}</select></label><p class="rules-note"><span>✦</span> Most eliminations wins. Respawns are on the house.</p></section></div>
      <div class="setup-footer"><button class="selected-loadout" data-action="loadout"><span>PACKING HEAT</span><b>${escape(WEAPONS[this.loadout.primary].name)} <i>+</i> ${escape(WEAPONS[this.loadout.secondary].name)}</b><small>EDIT LOADOUT ↗</small></button><button class="button button-acid start-button" data-action="start">START THE MESS ${arrow}</button></div><p class="pointer-note">Click to play captures your mouse. Press Esc anytime to pause.</p></section>`;
    this.fillRanges();
  }

  renderLoadout() {
    const slot = this.loadoutSlot;
    const definitions = ['primary', 'secondary'].includes(slot) ? Object.values(WEAPONS) : slot === 'perk' ? Object.values(PERKS) : Object.values(GADGETS).filter(item => item.slot === slot);
    const slots = [['primary', '01', 'PRIMARY', WEAPONS], ['secondary', '02', 'SECONDARY', WEAPONS], ['tactical', 'Q', 'TACTICAL', GADGETS], ['lethal', 'E', 'LETHAL', GADGETS], ['perk', '✦', 'PERK', PERKS]];
    this.el.content.innerHTML = `<section class="inner-page loadout-page">${this.pageHeading('02 / QUESTIONABLE EQUIPMENT', 'DRESS FOR THE MESS.', 'Seven very bad ideas. Five useful distractions. Your own kind of trouble.')}
      <div class="preset-strip"><span>QUICK PICKS</span>${Object.values(PRESETS).map(preset => `<button data-preset="${escape(preset.id)}" title="${escape(preset.description)}">${escape(preset.name)} <span>↗</span></button>`).join('')}</div>
      <div class="loadout-slots" role="group" aria-label="Equipment slot">${slots.map(([id, key, label, collection]) => `<button class="loadout-slot ${slot === id ? 'selected' : ''}" data-slot="${id}" aria-pressed="${slot === id}"><span><kbd>${key}</kbd>${label}</span><b>${escape(collection[this.loadout[id]]?.name || this.loadout[id])}</b></button>`).join('')}</div>
      <div class="arsenal-heading"><h2>${slot === 'perk' ? 'A little unfair advantage.' : slot === 'tactical' ? 'Start something strange.' : slot === 'lethal' ? 'Send a strong message.' : 'Choose your conversation starter.'}</h2><span>${definitions.length} OPTIONS <i>/</i> ${slot.toUpperCase()} SLOT</span></div>
      <div class="equipment-grid ${['primary', 'secondary'].includes(slot) ? 'weapon-grid' : ''}">${definitions.map((item, index) => { const selected = this.loadout[slot] === item.id; const weapon = Object.hasOwn(WEAPONS, item.id); return `<button class="equipment-card ${selected ? 'equipped' : ''}" data-equip="${escape(item.id)}" aria-pressed="${selected}" style="--item-color:${tint(item.color)}"><div class="equipment-card-top"><span>${weapon ? escape(item.category || 'WEAPON') : slot.toUpperCase()}</span><span>${selected ? '✓ EQUIPPED' : String(index + 1).padStart(2, '0')}</span></div>${weapon ? weaponArt(item.id, item.color) : `<div class="gadget-art" aria-hidden="true">${({ springpad: '↟', bubble: '◉', vortex: '◎', cherry: '✹', whoopee: '↯', spring: '↟', heavy: '▰', quick: 'ϟ' })[item.id] || '✦'}</div>`}<h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="equipment-stats">${weapon ? `<span>DMG <b>${escape(item.damage)}</b></span><span>MAG <b>${escape(item.magazine)}</b></span><span>${item.kind === 'projectile' ? 'PROJECTILE' : 'HITSCAN'}</span>` : `<span>${slot === 'perk' ? 'ALWAYS ON' : `COOLDOWN <b>${escape(item.cooldown)}s</b>`}</span><span>${selected ? 'YOUR PICK' : 'CLICK TO EQUIP'} ↗</span>`}</div></button>`; }).join('')}</div>
      <div class="arsenal-footer"><p><span>✦</span> Try a spring pad + a heavy hitter. Gravity is a suggestion.</p><button class="button button-acid compact" data-action="${this.context === 'pause' ? 'back' : 'setup'}">${this.context === 'pause' ? 'BACK TO MATCH' : 'READY TO RUMBLE'} ${arrow}</button></div>${this.context === 'pause' ? '<p class="pointer-note">Loadout changes take effect next match.</p>' : ''}</section>`;
  }

  settingDisplay(key, value) { if (key === 'fov') return `${Math.round(value)}°`; if (key === 'sensitivity') return `${Number(value).toFixed(1)}×`; return `${Math.round(value * 100)}%`; }
  slider(key, label, description, min, max, step) {
    return `<label class="slider-field"><span><b>${label}</b><output data-output="${key}">${this.settingDisplay(key, this.settings[key])}</output></span><small>${description}</small><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${this.settings[key]}" aria-label="${label}"></label>`;
  }
  selectSetting(key, label, values) { return `<label class="select-field">${label}<select data-setting="${key}">${values.map(([value, label]) => `<option value="${value}" ${this.settings[key] === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`; }
  renderSettings() {
    this.el.content.innerHTML = `<section class="inner-page settings-page">${this.pageHeading('03 / YOUR KIND OF CHAOS', 'FINE-TUNE THE FUN.', 'Your preferences save automatically. Make yourself uncomfortable, comfortably.')}
      <div class="preferences-grid"><section class="settings-card"><div class="card-kicker">FEEL <span>01</span></div>${this.slider('sensitivity', 'Mouse sensitivity', 'Find your sweet spot.', .2, 3, .1)}${this.slider('fov', 'Field of view', 'More view. More questionable decisions.', 65, 110, 1)}${this.slider('shake', 'Camera shake', 'A little impact, or a lot of impact.', 0, 1, .05)}${this.selectSetting('crosshair', 'CROSSHAIR', [['cross', '+ Classic cross'], ['dot', '• Clean dot'], ['circle', '○ Open circle']])}</section>
      <section class="settings-card"><div class="card-kicker">LOOK <span>02</span></div>${this.selectSetting('quality', 'GRAPHICS QUALITY', [['low', 'Low · keep it quick'], ['medium', 'Medium · happy medium'], ['high', 'High · lookin’ good']])}${this.slider('renderScale', 'Render scale', 'Lower for speed. Higher for extra crisp.', .5, 1.5, .1)}<button class="button button-outline fullscreen-button" data-action="fullscreen">GO FULLSCREEN <span>⛶</span></button><p class="settings-aside">A bigger window for your bad ideas.<br>Esc exits fullscreen.</p></section>
      <section class="settings-card"><div class="card-kicker">NOISE <span>03</span></div>${this.slider('masterVolume', 'Master volume', 'All the noise, all at once.', 0, 1, .05)}${this.slider('sfxVolume', 'Sound effects', 'Pops, pings, bonks, and other essentials.', 0, 1, .05)}<div class="audio-note"><span>♫</span><p>Handmade bleeps.<br>Big arcade energy.</p></div><button class="reset-settings" data-action="reset-settings">↺ RESET TO DEFAULTS</button></section></div></section>`;
    this.fillRanges();
  }

  renderControls() {
    this.el.content.innerHTML = `<section class="inner-page controls-page">${this.pageHeading('THE VERY SHORT MANUAL', 'MAKE YOURSELF A MENACE.', 'Move. Shoot. Experiment. The bots have not read this either.')}<div class="controls-layout"><div class="controls-grid">${controlRows.map(([key, label]) => `<div class="control-row"><kbd>${key}</kbd><span>${label}</span></div>`).join('')}</div><aside class="tips-card"><span class="tiny-star">✦</span><h2>A FEW<br>BAD IDEAS.</h2><p>Gadgets recharge. Use them.</p><p>Spring pads launch everyone. Yes, everyone.</p><p>Personal Space Invader pulls enemies closer. Hold RMB + LMB to shove them away.</p><p>Keep moving. A stationary bean is an easy bean.</p><button class="button button-acid compact" data-action="${this.context === 'pause' ? 'resume' : 'setup'}">GOT IT. LET'S GO. ${arrow}</button></aside></div></section>`;
  }

  startGame() {
    this.matchConfig = validateMatch(this.matchConfig);
    this.loadout = validateLoadout(this.loadout);
    this.persist();
    this.context = 'menu'; this.feed = []; this.el.feed.innerHTML = '';
    this.hideOverlays(); this.el.hud.hidden = false;
    this.callbacks.onStart?.({ ...this.matchConfig }, { ...this.loadout });
  }

  showPause() {
    this.context = 'pause'; this.view = 'pause'; this.isOverlayOpen = true;
    this.root.classList.add('overlay-open'); this.el.menu.hidden = true; this.el.results.hidden = true;
    this.el.scoreboard.hidden = true; this.scoreboardVisible = false; this.el.pause.hidden = false;
    this.el.pause.innerHTML = `<section class="pause-card"><div class="eyebrow"><span class="tiny-star">Ⅱ</span> TAKE A BREATHER</div><h1>CHAOS<br>ON HOLD.</h1><p>Your mouse is free. Your frenemies can wait.</p><button class="button button-acid" data-action="resume">BACK TO THE MESS ${arrow}</button><div class="pause-links"><button data-action="settings">SETTINGS <span>↗</span></button><button data-action="controls">CONTROLS <span>↗</span></button><button data-action="restart">RESTART MATCH <span>↻</span></button><button data-action="menu">RETURN TO LOBBY <span>←</span></button></div><small>Click resume to capture your mouse again.</small></section>`;
    this.fixGlyphs();
  }

  hidePause() { this.hideOverlays(); this.context = 'menu'; this.el.hud.hidden = false; }

  ranking(game) { return typeof game.rankings === 'function' ? game.rankings() : [...game.actors].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || String(a.name).localeCompare(String(b.name))); }
  scoreTable(game, ranked = this.ranking(game)) {
    return `<div class="score-table-wrap"><table class="score-table"><thead><tr><th scope="col">#</th><th scope="col">TROUBLEMAKER</th><th scope="col">KILLS</th><th scope="col">DEATHS</th><th scope="col">K / D</th></tr></thead><tbody>${ranked.map((actor, index) => `<tr class="${actor.isPlayer ? 'player-row' : ''}"><td>${String(index + 1).padStart(2, '0')}</td><td><span class="player-dot" style="--actor-color:${tint(actor.color)}"></span>${escape(actor.name)} ${actor.isPlayer ? '<small>YOU</small>' : ''}</td><td>${actor.kills}</td><td>${actor.deaths}</td><td>${(actor.kills / Math.max(1, actor.deaths)).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  showScoreboard(show, game) {
    this.scoreboardVisible = Boolean(show && !this.isOverlayOpen && game);
    this.el.scoreboard.hidden = !this.scoreboardVisible;
    if (this.scoreboardVisible) this.el.scoreboard.innerHTML = `<section class="scoreboard-card"><div class="scoreboard-heading"><div><span class="eyebrow">LIVE FROM THE TEST PIT</span><h2>THE DAMAGE REPORT.</h2></div><span>${time(game.match.remaining)}</span></div>${this.scoreTable(game)}<div class="scoreboard-foot">FREE-FOR-ALL <span>RELEASE TAB TO GET BACK TO IT</span></div></section>`;
  }

  showResults(game) {
    this.context = 'menu'; this.view = 'results'; this.isOverlayOpen = true;
    this.root.classList.add('overlay-open'); this.el.menu.hidden = true; this.el.pause.hidden = true;
    this.el.hud.hidden = true; this.el.scoreboard.hidden = true; this.scoreboardVisible = false;
    const ranked = this.ranking(game);
    const winner = game.actors.find(actor => actor.id === game.match.winnerId) || ranked[0];
    const win = winner?.isPlayer;
    this.el.results.hidden = false;
    this.el.results.innerHTML = `<section class="results-card"><div class="results-header"><span class="eyebrow">THAT WAS BEAUTIFULLY UNNECESSARY.</span><span class="result-stamp">${win ? 'NICE MESS!' : 'GO AGAIN?'}</span><h1>${win ? 'TOP OF THE<br>FOOD FIGHT.' : 'WELL, THAT<br>HAPPENED.'}</h1><p><b>${escape(winner?.name || 'Nobody')}</b> takes the crown. ${win ? 'A questionable victory. A very real flex.' : 'Revenge is only one click away.'}</p></div><div class="results-stats"><span>YOUR ELIMINATIONS <b>${game.player.kills}</b></span><span>YOUR DEATHS <b>${game.player.deaths}</b></span><span>YOUR PLACE <b>${ranked.findIndex(actor => actor.isPlayer) + 1}<small> / ${ranked.length}</small></b></span></div>${this.scoreTable(game, ranked)}<div class="results-actions"><button class="button button-outline" data-action="menu">BACK TO LOBBY <span>←</span></button><button class="button button-acid" data-action="restart">ONE MORE MESS ${arrow}</button></div></section>`;
    this.fixGlyphs();
  }

  notify(message) { this.el.toast.textContent = message; this.el.toast.hidden = false; this.toastUntil = this.elapsed + 3; }

  handleEvents(events, game) {
    for (const event of events) {
      if (event.type === 'damage') {
        if (event.attackerId === game.player.id && event.actorId !== game.player.id) { this.hitUntil = this.elapsed + .14; this.el.hitmarker.classList.toggle('headshot', Boolean(event.headshot)); }
        if (event.actorId === game.player.id) this.damageUntil = this.elapsed + .3;
      }
      if (event.type === 'eliminate') {
        const target = game.actors.find(actor => actor.id === event.actorId);
        const source = game.actors.find(actor => actor.id === event.attackerId);
        const weapon = WEAPONS[event.weaponId] || GADGETS[event.weaponId];
        this.feed.unshift({ target: target?.name || 'Unknown bean', source: source?.name || 'The universe', self: event.attackerId === game.player.id, victim: event.actorId === game.player.id, weapon: weapon?.name || 'CHAOS', until: this.elapsed + 6 });
        this.feed = this.feed.slice(0, 5);
        if (event.attackerId === game.player.id && event.actorId !== game.player.id) {
          this.el.elimination.innerHTML = `<span>+1 BEAUTIFUL MESS</span><b>ELIMINATED ${escape(target?.name || 'A FRENEMY')}</b>`;
          this.eliminationUntil = this.elapsed + 2;
        }
        this.renderFeed();
      }
      if (event.type === 'matchStart') { this.feed = []; this.renderFeed(); this.damageUntil = this.hitUntil = this.eliminationUntil = 0; }
    }
  }

  renderFeed() { this.el.feed.innerHTML = this.feed.map(item => `<div class="feed-item ${item.self ? 'your-elimination' : ''} ${item.victim ? 'your-death' : ''}"><b>${escape(item.source)}</b><span title="${escape(item.weapon)}">${escape(item.weapon)} <i>→</i></span><b>${escape(item.target)}</b></div>`).join(''); }

  update(game, dt) {
    this.elapsed += Math.max(0, dt || 0);
    if (!this.el.toast.hidden && this.elapsed > this.toastUntil) this.el.toast.hidden = true;
    if (this.feed.some(item => item.until <= this.elapsed)) { this.feed = this.feed.filter(item => item.until > this.elapsed); this.renderFeed(); }
    if (this.el.hud.hidden) return;
    const player = game.player;
    if (!player) return;
    const weapon = game.combat?.getWeapon(player) || WEAPONS[player.equipment?.[player.activeSlot === 1 ? 'secondary' : 'primary']];
    const state = game.combat?.getWeaponState(player) || {};
    const health = Math.max(0, Math.ceil(player.health));
    this.setText('timer', time(Math.ceil(game.match.remaining)));
    this.setText('score-limit', game.match.scoreLimit);
    this.setText('score', String(player.kills).padStart(2, '0'));
    const rank = this.ranking(game).findIndex(actor => actor.isPlayer) + 1;
    this.setText('rank', `${rank}${rank === 1 ? 'ST' : rank === 2 ? 'ND' : rank === 3 ? 'RD' : 'TH'} PLACE`);
    this.setText('health', health);
    this.el['health-bar'].style.width = `${100 * health / Math.max(1, player.maxHealth)}%`;
    this.el['health-bar'].classList.toggle('low', health < 30);
    this.setText('weapon-name', weapon?.name || 'READY');
    this.setText('ammo', state.ammo ?? '—'); this.setText('reserve', state.reserve ?? '—');
    const reloading = (state.reloadEnd || 0) > game.time;
    this.setText('reload', reloading ? `RELOADING… ${Math.max(0, state.reloadEnd - game.time).toFixed(1)}s` : state.ammo === 0 ? 'EMPTY · PRESS R TO RELOAD' : 'R RELOAD · 1 / 2 SWITCH');
    this.el.reload.classList.toggle('is-reloading', reloading || state.ammo === 0);
    for (const slot of ['tactical', 'lethal']) {
      const id = player.equipment?.[slot];
      this.setText(`${slot}-name`, GADGETS[id]?.name || slot);
      const remaining = Math.max(0, (player.gadgetReady?.[slot] ?? player.gadgetReady?.[id] ?? 0) - game.time);
      this.setText(`${slot}-cooldown`, remaining > 0 ? `${Math.ceil(remaining)}s` : 'READY');
      this.el[`${slot}-slot`].classList.toggle('cooling-down', remaining > 0);
    }
    this.el.crosshair.className = `crosshair crosshair-${this.settings.crosshair}`;
    this.el.crosshair.hidden = !player.alive || game.match.state !== 'playing';
    this.el.hitmarker.classList.toggle('visible', this.elapsed < this.hitUntil);
    this.el.damage.classList.toggle('visible', this.elapsed < this.damageUntil);
    this.el.elimination.hidden = this.elapsed > this.eliminationUntil;
    if (game.match.state === 'countdown') {
      this.el.center.hidden = false;
      const count = Math.max(1, Math.ceil(game.match.countdown));
      const key = `countdown-${count}`;
      if (this.centerKey !== key) { this.el.center.innerHTML = `<span>GET WEIRD IN</span><b class="countdown-number">${count}</b><small>WASD MOVE <i>·</i> LMB FIRE <i>·</i> Q / E GADGETS</small>`; this.centerKey = key; }
    } else if (!player.alive && game.match.state === 'playing') {
      this.el.center.hidden = false;
      const seconds = Math.max(1, Math.ceil(player.respawnAt - game.time));
      const key = `respawn-${seconds}`;
      if (this.centerKey !== key) { this.el.center.innerHTML = `<span>A MINOR INCONVENIENCE.</span><b class="respawn-title">YOU GOT<br>ABSOLUTELY BEANED.</b><small>BACK FOR MORE IN ${seconds}</small>`; this.centerKey = key; }
    } else { this.el.center.hidden = true; this.centerKey = ''; }
    if (this.scoreboardVisible) {
      this.scoreboardElapsed = (this.scoreboardElapsed || 0) + dt;
      if (this.scoreboardElapsed > .25) { this.showScoreboard(true, game); this.scoreboardElapsed = 0; }
    }
  }

  dispose() { this.root.removeEventListener('click', this._onClick); this.root.removeEventListener('input', this._onInput); this.root.removeEventListener('change', this._onInput); }
}

export default UI;
