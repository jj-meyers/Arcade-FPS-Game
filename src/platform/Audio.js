// Entirely original Web Audio synthesis. No files, licenses, downloads or autoplay.
export class GameAudio {
  constructor(settings) { this.settings = settings; this.context = null; this.voices = 0; this.lastBotShot = -1; }
  unlock() {
    try {
      if (!this.context) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.context = new Ctx(); this.master = this.context.createGain(); this.master.connect(this.context.destination);
        const length = this.context.sampleRate * .5;
        this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = this.noise.getChannelData(0); for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        this.applySettings(this.settings);
      }
      this.context.resume().catch(() => {});
    } catch { /* Sound is optional if a browser denies an audio device. */ }
  }
  applySettings(settings) { this.settings = settings; if (this.master) this.master.gain.setTargetAtTime(settings.masterVolume * settings.sfxVolume * .32, this.context.currentTime, .02); }
  tone(freq, end, duration, volume = .4, type = 'triangle', delay = 0) {
    if (!this.context || this.context.state !== 'running' || this.voices > 32) return;
    const ctx = this.context, now = ctx.currentTime + delay, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume, now + .006); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(now); osc.stop(now + duration + .02); this.voices++;
    osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices--; };
  }
  burst(duration, volume = .4, frequency = 1600) {
    if (!this.context || this.context.state !== 'running' || this.voices > 32) return;
    const ctx = this.context, now = ctx.currentTime, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(now); source.stop(now + duration); this.voices++;
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.voices--; };
  }
  menu() { this.tone(420, 620, .05, .16, 'sine'); }
  handleEvents(events, game) {
    if (!this.context) return;
    for (const e of events) {
      const actor = game.getActor(e.actorId), isPlayer = e.actorId === 'player';
      const point = e.point || actor?.pos, d = point ? Math.hypot(point.x - game.player.pos.x, point.z - game.player.pos.z) : 0;
      const volume = isPlayer ? 1 : Math.max(0, 1 - d / 46) * .45;
      if (e.type === 'shot') {
        if (e.pellet > 0) continue;
        if (!isPlayer && this.context.currentTime - this.lastBotShot < .055) continue;
        if (!isPlayer) this.lastBotShot = this.context.currentTime;
        const sounds = { fizz:[260,90,.08], doorbell:[120,35,.21], bankshot:[580,170,.15], confetti:[85,28,.3], rail:[1100,70,.23], updraft:[180,600,.18], yoink:[470,130,.17] };
        const [a,b,t] = sounds[e.weaponId] || sounds.fizz;
        this.tone(a,b,t,volume*.55,'sawtooth'); this.burst(t*.7,volume*.3,e.weaponId==='rail'?6500:1800);
      } else if (e.type === 'reload' && isPlayer) { this.tone(290,120,.08,.3,'square'); this.tone(400,850,.08,.2,'triangle',.2); }
      else if (e.type === 'switch' && isPlayer) this.tone(160,320,.09,.22);
      else if (e.type === 'damage' && e.attackerId === 'player' && !isPlayer) this.tone(e.headshot?1500:900,500,.05,.3,'sine');
      else if (e.type === 'damage' && isPlayer) { this.burst(.12,.18,400); this.tone(90,40,.1,.25); }
      else if (e.type === 'eliminate' && e.attackerId === 'player' && !isPlayer) { [480,640,960].forEach((f,i)=>this.tone(f,f*1.02,.14,.32,'triangle',i*.065)); }
      else if (e.type === 'explosion' && volume > 0) { this.burst(.32,volume,500); this.tone(100,25,.32,volume*.8,'sine'); }
      else if (e.type === 'gadget' && isPlayer) this.tone(180,900,.2,.35,'triangle');
      else if (e.type === 'jump' && isPlayer) this.tone(130,280,.12,.18,'sine');
      else if (e.type === 'land' && isPlayer) this.burst(.07,.17,300);
      else if (e.type === 'go') this.tone(600,900,.25,.5);
      else if (e.type === 'matchEnd') { const win = e.winnerId === 'player'; (win?[440,550,660,880]:[440,370,290]).forEach((f,i)=>this.tone(f,f,.3,.4,'triangle',i*.16)); }
    }
  }
}
