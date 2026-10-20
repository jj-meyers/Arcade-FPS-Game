import * as THREE from 'three';
import { Procedural, PALETTE, visualSignature, weaponAppearance } from './Procedural.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const damp = (current, target, speed, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * dt));
const COLORS = ['#c9f35a', '#f778b5', '#b99bf4', '#ffb65c', '#70dce0'];

/** Rendering is deliberately a consumer of simulation state, never its owner. */
export class Renderer {
  constructor(canvas, game, settings = {}) {
    this.canvas = canvas;
    this.game = game;
    this.assets = new Procedural();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor('#cbd0e0');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.autoClear = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#cbd0e0');
    this.scene.fog = new THREE.Fog('#cbd0e0', 32, 82);
    this.camera = new THREE.PerspectiveCamera(85, 1, 0.055, 140);
    this.camera.rotation.order = 'YXZ';
    this.actorMeshes = new Map();
    this.projectileMeshes = new Map();
    this.fieldMeshes = new Map();
    this.effects = [];
    this.effectPool = new Map();
    this.pooledEffects = 0;
    this.time = 0;
    this.recoil = 0;
    this.shake = 0;
    this.land = 0;
    this.swap = 0;
    this.bob = 0;
    this.gadgetMotion = 0;
    this.weaponId = null;
    this.muzzleTime = 0;
    this.settings = {};
    this.temp = new THREE.Vector3();
    this.buildLighting();
    this.buildArena();
    this.buildViewmodel();
    this.buildPresentation();
    this.applySettings(settings);
    this.resize();
  }

  buildLighting() {
    this.scene.add(new THREE.HemisphereLight('#f7f3ff', '#8f8696', 2.5));
    this.sun = new THREE.DirectionalLight('#fff0d4', 3.1);
    this.sun.position.set(-14, 26, 12);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -32;
    this.sun.shadow.camera.right = 32;
    this.sun.shadow.camera.top = 32;
    this.sun.shadow.camera.bottom = -32;
    this.sun.shadow.camera.far = 85;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.bias = -0.0001;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.sun);
    const fill = new THREE.DirectionalLight('#bdcaff', 0.65);
    fill.position.set(10, 12, -15);
    this.scene.add(fill);
  }

  buildArena() {
    const map = this.game.map;
    const size = map.size || 56;
    const arena = new THREE.Group();
    arena.name = 'graybox-arena';
    this.scene.add(arena);
    this.assets.box(arena, [size, 0.4, size], '#c6c8d1', [0, -0.2, 0]);
    const grid = new THREE.GridHelper(size, size / 4, '#a8aab8', '#b4b7c3');
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.46;
    this.extraDisposables = [grid.geometry, grid.material];
    arena.add(grid);
    const wallHeight = map.wallHeight || 4;
    for (const sign of [-1, 1]) {
      this.assets.box(arena, [size + 0.4, wallHeight, 0.4], '#b4b5c3', [0, wallHeight / 2, sign * (size / 2 + 0.2)]);
      this.assets.box(arena, [0.4, wallHeight, size], '#b4b5c3', [sign * (size / 2 + 0.2), wallHeight / 2, 0]);
      this.assets.box(arena, [size + 0.4, 0.08, 0.43], '#e1dcf1', [0, wallHeight, sign * (size / 2 + 0.2)]);
      this.assets.box(arena, [0.43, 0.08, size], '#e1dcf1', [sign * (size / 2 + 0.2), wallHeight, 0]);
    }
    for (const obstacle of map.obstacles || []) {
      const { x, y = 0, z, w, h, d, color } = obstacle;
      this.assets.box(arena, [w, h, d], '#d6d5db', [x, y + h / 2, z]);
      // Thin caps communicate cover heights without turning the testing arena into a decorated map.
      this.assets.box(arena, [w + 0.025, 0.055, d + 0.025], color || '#ada1cc', [x, y + h + 0.012, z]);
    }
    for (const ramp of map.ramps || []) {
      const { x, z, w, d, h, color } = ramp;
      const shape = new THREE.Shape();
      shape.moveTo(-d / 2, 0);
      shape.lineTo(d / 2, 0);
      shape.lineTo(d / 2, h);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: w, bevelEnabled: false });
      // Shape X becomes world Z, extrusion Z becomes world -X.
      geometry.rotateY(-Math.PI / 2);
      geometry.translate(w / 2, 0, 0);
      this.extraDisposables.push(geometry);
      const mesh = new THREE.Mesh(geometry, this.assets.material(color || '#b9aecb'));
      mesh.position.set(x, 0, z);
      mesh.castShadow = mesh.receiveShadow = true;
      arena.add(mesh);
    }
    for (const pad of map.pads || []) {
      const x = pad.x ?? pad.pos?.x ?? 0;
      const z = pad.z ?? pad.pos?.z ?? 0;
      this.assets.tube(arena, [0.65, 0.72], 0.07, '#c8f063', [x, 0.04, z], [0, 0, 0]);
    }
  }

  buildViewmodel() {
    this.weaponScene = new THREE.Scene();
    this.weaponCamera = new THREE.PerspectiveCamera(66, 1, 0.01, 10);
    this.weaponScene.add(new THREE.HemisphereLight('#fffaf2', '#a59ec3', 2.3));
    const key = new THREE.DirectionalLight('#fff2dc', 3.4);
    key.position.set(-2, 3, 2);
    this.weaponScene.add(key);
    this.weaponRoot = new THREE.Group();
    this.weaponRoot.scale.setScalar(0.64);
    this.weaponScene.add(this.weaponRoot);
    this.weaponGroup = new THREE.Group();
    this.weaponRoot.add(this.weaponGroup);
    this.sleeves = [this.assets.mesh(this.weaponRoot, 'CapsuleGeometry', [0.075, 0.25, 4, 10], '#c9ef64', [0.075, -0.33, 0.16], [-0.65, 0, -0.22])];
    this.assets.ball(this.weaponRoot, 0.1, '#fff5de', [0.025, -0.19, 0.04], [0.8, 1.15, 0.9]);
    this.sleeves.push(this.assets.mesh(this.weaponRoot, 'CapsuleGeometry', [0.07, 0.3, 4, 10], '#c9ef64', [-0.2, -0.32, -0.16], [-1.05, 0, -0.45]));
    this.assets.ball(this.weaponRoot, 0.092, '#fff5de', [-0.12, -0.13, -0.31]);
    this.muzzleFlash = new THREE.Mesh(this.assets.geometry('OctahedronGeometry', [0.11, 0]), new THREE.MeshBasicMaterial({ color: '#fff2a9', transparent: true, opacity: 1, depthTest: false }));
    this.extraDisposables.push(this.muzzleFlash.material);
    this.muzzleFlash.visible = false;
    this.weaponGroup.add(this.muzzleFlash);
    this.muzzleLight = new THREE.PointLight('#ffd791', 0, 2);
    this.weaponScene.add(this.muzzleLight);
  }

  buildPresentation() {
    this.presentationScene = new THREE.Scene();
    this.presentationCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    this.presentationCamera.position.set(0, 1.18, 5);
    this.presentationScene.add(new THREE.HemisphereLight('#fff9eb', '#777398', 2.6));
    const light = new THREE.DirectionalLight('#fff2cd', 4.5);
    light.position.set(-3, 5, 4);
    this.presentationScene.add(light);
    const rim = new THREE.DirectionalLight('#cebeff', 2.4);
    rim.position.set(4, 3, -4);
    this.presentationScene.add(rim);
    this.syncPresentation();
  }

  syncPresentation() {
    const equipment = this.game.menuLoadout || this.game.player?.equipment || {};
    const signature = JSON.stringify([equipment.classId, equipment.cosmetics, equipment.primary, equipment.mods?.primary, equipment.finishes?.primary]);
    if (signature === this.heroSignature) return;
    if (this.hero) { this.presentationScene.remove(this.hero); this.assets.releaseMascot(this.hero); }
    this.heroSignature = signature;
    this.hero = this.assets.mascot('#c6f34f', 0, equipment.primary || 'fizz', {
      classId: equipment.classId || 'runner', cosmetics: equipment.cosmetics || {}, appearance: weaponAppearance(equipment),
    });
    this.hero.scale.setScalar(1.32);
    this.hero.rotation.y = Math.PI - 0.25;
    this.hero.rotation.z = -0.07;
    this.hero.userData.weaponPivot.rotation.set(-0.14, -0.18, 0.14);
    this.hero.userData.weaponPivot.scale.setScalar(0.88);
    this.hero.userData.weaponPivot.position.set(0.38, 0.89, -0.36);
    this.presentationScene.add(this.hero);
    this.hero.position.x = this.presentationCamera.aspect * 0.8;
  }

  applySettings(settings) {
    this.settings = { fov: 85, quality: 'high', renderScale: 1, shake: 0.5, shadows: true, effects: 'high', reducedMotion: false, ...this.settings, ...settings };
    const high = this.settings.quality === 'high';
    this.renderer.shadowMap.enabled = this.settings.shadows !== false && this.settings.quality !== 'low';
    this.renderer.shadowMap.type = high ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.maxEffects = this.settings.effects === 'low' ? 55 : this.settings.effects === 'medium' ? 100 : 180;
    this.effectDensity = this.settings.effects === 'low' ? 0.3 : this.settings.effects === 'medium' ? 0.6 : 1;
    while (this.effects.length > this.maxEffects) this.removeEffect(0);
    for (const pool of this.effectPool.values()) {
      while (pool.length && this.pooledEffects > this.maxEffects) { pool.pop().material.dispose(); this.pooledEffects--; }
    }
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const qualityCap = this.settings.quality === 'low' ? 1 : this.settings.quality === 'medium' ? 1.3 : 1.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityCap) * clamp(Number(this.settings.renderScale) || 1, 0.5, 1.5));
    this.renderer.setSize(width, height, false);
    for (const camera of [this.camera, this.weaponCamera, this.presentationCamera]) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    if (this.hero) this.hero.position.x = (width / height) * 0.8;
  }

  syncActors(dt, menu) {
    const ids = new Set();
    for (let i = 0; i < this.game.actors.length; i++) {
      const actor = this.game.actors[i];
      ids.add(actor.id);
      let mesh = this.actorMeshes.get(actor.id);
      const slot = actor.activeSlot === 1 ? 'secondary' : 'primary';
      const weaponId = actor.equipment?.[slot] || 'fizz';
      const appearance = weaponAppearance(actor.equipment, slot);
      const signature = visualSignature(actor.equipment, actor);
      if (mesh && mesh.userData.visualSignature !== signature) {
        this.scene.remove(mesh); this.assets.releaseMascot(mesh); mesh = null;
      }
      if (!mesh) {
        mesh = this.assets.mascot(actor.color || COLORS[i % COLORS.length], i, weaponId, { classId: actor.classId || actor.equipment?.classId, cosmetics: actor.cosmetics || actor.equipment?.cosmetics, team: actor.team, appearance });
        mesh.userData.visualSignature = signature;
        mesh.userData.weaponSignature = JSON.stringify([weaponId, appearance]);
        const marker = new THREE.Group(); marker.name = 'ally-marker'; marker.position.y = 2.25;
        this.assets.mesh(marker, 'OctahedronGeometry', [0.13, 0], '#f5fbff', undefined, undefined, [1, 0.8, 1]);
        this.assets.ring(marker, 0.16, 0.025, '#304953', [0, 0, 0], [Math.PI / 2, 0, 0]);
        mesh.add(marker); mesh.userData.marker = marker;
        this.actorMeshes.set(actor.id, mesh);
        this.scene.add(mesh);
      }
      mesh.visible = actor.alive && (!actor.isPlayer || menu);
      mesh.userData.marker.visible = !menu && actor.alive && !actor.isPlayer && !!actor.team && actor.team === this.game.player?.team;
      if (!mesh.visible) continue;
      const data = mesh.userData;
      const weaponSignature = JSON.stringify([weaponId, appearance]);
      if (data.weaponSignature !== weaponSignature) {
        this.assets.releaseVisual(data.weapon);
        data.weaponPivot.remove(data.weapon);
        data.weapon = this.assets.weapon(weaponId, appearance);
        data.weaponPivot.add(data.weapon);
        data.weaponId = weaponId;
        data.weaponSignature = weaponSignature;
      }
      const speed = Math.hypot(actor.vel.x, actor.vel.z);
      const phase = data.stridePhase = (data.stridePhase ?? i * 2) + (menu || this.game.paused ? 0 : dt) * speed * 1.9;
      const stride = actor.grounded && !menu ? Math.min(speed * 0.055, 0.45) : 0;
      const previous = actor.prevPos || actor.pos;
      mesh.position.set(
        THREE.MathUtils.lerp(previous.x, actor.pos.x, this.alpha),
        THREE.MathUtils.lerp(previous.y, actor.pos.y, this.alpha),
        THREE.MathUtils.lerp(previous.z, actor.pos.z, this.alpha),
      );
      mesh.rotation.y = actor.yaw;
      mesh.scale.y = actor.height / 1.8;
      data.hit = Math.max(0, data.hit - dt * 4);
      data.recoil = damp(data.recoil, 0, 15, dt);
      data.land = damp(data.land, 0, 12, dt);
      data.gadget = damp(data.gadget, 0, 7, dt);
      data.body.material.emissive.set(data.hit > 0 ? '#ff634c' : '#000000');
      data.body.material.emissiveIntensity = data.hit * 0.9;
      if ((actor.invulnerableUntil || 0) > this.game.time) {
        data.body.material.emissive.set('#d3f1ff');
        data.body.material.emissiveIntensity = 0.18 + Math.sin(this.time * 18) * 0.12;
      }
      if (actor.bracedUntil > this.game.time) { data.body.material.emissive.set('#afd7e4'); data.body.material.emissiveIntensity = 0.22; }
      data.torso.position.y = Math.abs(Math.sin(phase)) * stride * 0.12;
      data.torso.rotation.z = Math.sin(phase * 0.5) * stride * 0.07 + data.hit * 0.08;
      data.torso.rotation.x = actor.grounded ? Math.min(speed * 0.006, 0.06) : clamp(-actor.vel.y * 0.015, -0.12, 0.14);
      const stretch = actor.grounded ? 0 : clamp(actor.vel.y * 0.004, -0.025, 0.045);
      data.torso.scale.set(1 + data.land * 0.12 - stretch * 0.4, 1 - data.land * 0.15 + stretch, 1 + data.land * 0.1);
      data.feet[0].position.z = Math.sin(phase) * stride;
      data.feet[1].position.z = -Math.sin(phase) * stride;
      data.feet[0].position.y = 0.13 + Math.max(0, Math.cos(phase)) * stride * 0.5;
      data.feet[1].position.y = 0.13 + Math.max(0, -Math.cos(phase)) * stride * 0.5;
      data.feet[0].rotation.x = actor.grounded ? Math.cos(phase) * stride * 0.3 : 0.22;
      data.feet[1].rotation.x = actor.grounded ? -Math.cos(phase) * stride * 0.3 : -0.18;
      data.arms[0].rotation.x = Math.sin(phase) * stride * 0.45 - data.gadget * 1.3;
      data.arms[1].rotation.x = -0.4 - data.recoil;
      data.weaponPivot.rotation.x = actor.pitch - data.recoil * 0.6;
      const state = this.game.combat?.getWeaponState(actor);
      if (state?.reloadEnd > this.game.time) data.weaponPivot.rotation.z = 0.65 + Math.sin(this.time * 8) * 0.1;
      else data.weaponPivot.rotation.z = damp(data.weaponPivot.rotation.z, 0, 12, dt);
      const propeller = mesh.getObjectByName('propeller');
      if (propeller && !this.settings.reducedMotion) propeller.rotation.y += dt * (5 + speed);
    }
    for (const [id, mesh] of this.actorMeshes) {
      if (!ids.has(id)) {
        this.scene.remove(mesh);
        this.assets.releaseMascot(mesh);
        this.actorMeshes.delete(id);
      }
    }
  }

  syncCombat(dt) {
    const combat = this.game.combat;
    this.syncEntities(combat?.projectiles || [], this.projectileMeshes, (projectile) => {
      const group = new THREE.Group();
      const color = projectile.color || '#ffbc66';
      if (projectile.kind === 'disc') {
        this.assets.tube(group, [0.24, 0.24], 0.045, color, undefined, [0, 0, 0]);
        this.assets.ring(group, 0.17, 0.025, '#fff5df', [0, 0.03, 0], [Math.PI / 2, 0, 0]);
      } else if (projectile.kind === 'tack') {
        this.assets.ball(group, projectile.radius || 0.15, color, undefined, [1.1, 0.85, 1.1]);
        this.assets.ball(group, 0.07, '#fff5df', [0.1, 0.07, -0.07]);
      } else {
        this.assets.ball(group, projectile.radius || 0.15, color);
        this.assets.ring(group, (projectile.radius || 0.15) * 1.2, 0.025, '#fff5df');
      }
      return group;
    }, (mesh, projectile) => {
      mesh.position.set(projectile.pos.x, projectile.pos.y, projectile.pos.z);
      mesh.rotation.y += dt * 8;
      if (projectile.kind !== 'disc') { mesh.rotation.x += dt * 7; mesh.rotation.z += dt * 4; }
    });
    this.syncEntities(combat?.fields || [], this.fieldMeshes, (field) => {
      const group = new THREE.Group();
      const color = field.color || '#c1a0fa';
      if (field.kind === 'bubble' || field.kind === 'shield') {
        const sphere = this.assets.mesh(group, 'SphereGeometry', [1, 24, 16], color, undefined, undefined, undefined, { transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, roughness: 0.2 });
        sphere.name = 'dome';
        this.assets.ring(group, 1, 0.025, color, [0, 0, 0], [-Math.PI / 2, 0, 0]);
      } else {
        this.assets.ring(group, 1, 0.035, color, [0, 0.05, 0], [-Math.PI / 2, 0, 0]);
        this.assets.ring(group, 0.72, 0.018, color, [0, 0.1, 0], [-Math.PI / 2, 0, 0]);
        if (field.kind === 'vortex') {
          for (let i = 0; i < 5; i++) {
            const ball = this.assets.ball(group, 0.08, color, [Math.cos(i * 1.26) * 0.65, 0.3 + i * 0.15, Math.sin(i * 1.26) * 0.65]);
            ball.name = 'vortex-spark';
          }
        } else if (field.kind === 'heal') {
          this.assets.box(group, [0.12, 0.035, 0.52], '#f3ffeb', [0, 0.11, 0]);
          this.assets.box(group, [0.52, 0.035, 0.12], '#f3ffeb', [0, 0.11, 0]);
          this.assets.tube(group, [0.35, 0.35], 0.06, color, [0, 0.06, 0], [0, 0, 0]);
        } else if (field.kind === 'supply') {
          this.assets.box(group, [0.3, 0.16, 0.27], color, [0, 0.13, 0]);
          this.assets.box(group, [0.32, 0.025, 0.29], '#f3ffeb', [0, 0.22, 0]);
          for (let i = -1; i <= 1; i++) this.assets.box(group, [0.035, 0.08, 0.025], '#f3ffeb', [i * 0.07, 0.14, -0.15]);
        } else if (field.kind === 'dampen') {
          this.assets.ring(group, 0.32, 0.035, color, [0, 0.12, 0], [-Math.PI / 2, 0, 0]);
          this.assets.box(group, [0.7, 0.04, 0.075], '#f3ffeb', [0, 0.14, 0], [0, Math.PI / 4, 0]);
          for (let i = 0; i < 4; i++) this.assets.box(group, [0.17, 0.08, 0.06], color, [Math.sin(i * Math.PI / 2) * 0.82, 0.09, Math.cos(i * Math.PI / 2) * 0.82], [0, i * Math.PI / 2, 0]);
        } else if (field.kind === 'booster') {
          for (let i = 0; i < 2; i++) for (const sign of [-1, 1]) this.assets.box(group, [0.27, 0.04, 0.065], '#f3ffeb', [sign * 0.1, 0.1, i * 0.25 - 0.13], [0, sign * 0.6, 0]);
        } else if (field.kind === 'repulsor') {
          for (let i = 0; i < 4; i++) this.assets.mesh(group, 'ConeGeometry', [0.1, 0.24, 3], '#f3ffeb', [Math.sin(i * Math.PI / 2) * 0.45, 0.12, Math.cos(i * Math.PI / 2) * 0.45], [Math.PI / 2, 0, -i * Math.PI / 2], [1, 1, 0.3]);
          this.assets.ball(group, 0.13, color, [0, 0.15, 0]);
        } else if (field.kind === 'spring') {
          this.assets.tube(group, [0.23, 0.23], 0.06, color, [0, 0.07, 0], [0, 0, 0]);
          for (let i = 0; i < 3; i++) this.assets.ring(group, 0.15, 0.025, '#f3ffeb', [0, 0.12 + i * 0.06, 0], [Math.PI / 2, 0, 0]);
        } else {
          this.assets.tube(group, [0.34, 0.34], 0.06, color, [0, 0.06, 0], [0, 0, 0]);
          this.assets.box(group, [0.38, 0.03, 0.08], '#fff9e8', [0, 0.11, 0], [0, 0.6, 0]);
          this.assets.box(group, [0.38, 0.03, 0.08], '#fff9e8', [0, 0.11, 0], [0, -0.6, 0]);
        }
      }
      return group;
    }, (mesh, field) => {
      mesh.position.set(field.pos.x, field.pos.y, field.pos.z);
      const radius = field.radius || 2;
      mesh.scale.setScalar(radius);
      if (!this.settings.reducedMotion && ['vortex', 'repulsor'].includes(field.kind)) mesh.rotation.y += dt * (field.kind === 'vortex' ? 2 : 0.35);
      if (field.expires - this.game.time < 1 && !this.settings.reducedMotion) mesh.visible = Math.sin(this.time * 12) > -0.4;
      else mesh.visible = true;
    });
  }

  syncEntities(entities, map, create, update) {
    const ids = new Set();
    for (const entity of entities) {
      ids.add(entity.id);
      if (!map.has(entity.id)) {
        const mesh = create(entity);
        map.set(entity.id, mesh);
        this.scene.add(mesh);
      }
      update(map.get(entity.id), entity);
    }
    for (const [id, mesh] of map) if (!ids.has(id)) { this.scene.remove(mesh); map.delete(id); }
  }

  updateCamera(dt, menu) {
    const actor = this.game.player;
    if (menu || !actor) {
      this.syncPresentation();
      const motion = this.settings.reducedMotion ? 0 : 1;
      const orbit = this.time * 0.032 * motion;
      this.camera.position.set(Math.cos(orbit) * 18, 11, Math.sin(orbit) * 18 + 10);
      this.camera.lookAt(0, 0, 0);
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
      this.hero.position.y = -0.08 + Math.sin(this.time * 1.7) * 0.035 * motion;
      this.hero.rotation.y = Math.PI - 0.38 + Math.sin(this.time * 0.5) * 0.17 * motion;
      this.hero.userData.arms[0].rotation.x = -0.2 + Math.sin(this.time * 1.7) * 0.08 * motion;
      const propeller = this.hero.getObjectByName('propeller');
      if (propeller) propeller.rotation.y += dt * 4 * motion;
      return;
    }
    const speed = Math.hypot(actor.vel.x, actor.vel.z);
    const aim = !!actor.aiming;
    const sprint = !!actor.intent?.sprint && speed > 1 && !aim;
    const reduced = this.settings.reducedMotion;
    const targetFov = clamp(Number(this.settings.fov) || 85, 60, 110) - (aim ? 14 : 0) + (sprint && !reduced ? 7 : 0);
    this.camera.fov = damp(this.camera.fov, targetFov, 10, dt);
    this.camera.updateProjectionMatrix();
    const eye = this.game.eye(actor);
    const targetEyeHeight = eye.y - actor.pos.y;
    this.eyeHeight = damp(this.eyeHeight ?? targetEyeHeight, targetEyeHeight, 18, dt);
    eye.y += this.eyeHeight - targetEyeHeight;
    if (actor.alive && actor.prevPos) {
      for (const axis of ['x', 'y', 'z']) eye[axis] -= (actor.pos[axis] - actor.prevPos[axis]) * (1 - this.alpha);
    }
    this.bob += dt * Math.min(speed, 10) * 1.85;
    const bobStrength = actor.grounded && actor.alive && !reduced ? Math.min(speed / 6, 1) : 0;
    const shake = reduced ? 0 : this.shake * (Number(this.settings.shake) || 0);
    this.camera.position.set(eye.x, eye.y + Math.sin(this.bob * 2) * bobStrength * 0.015 - (reduced ? 0 : this.land * 0.045), eye.z);
    this.camera.rotation.set(actor.pitch + (reduced ? 0 : this.recoil * 0.017) + Math.sin(this.time * 63) * shake * 0.007, actor.yaw + Math.cos(this.time * 51) * shake * 0.005, Math.sin(this.bob) * bobStrength * 0.0025, 'YXZ');
    this.updateWeapon(dt, aim, sprint, bobStrength);
  }

  updateWeapon(dt, aim, sprint, bobStrength) {
    const actor = this.game.player;
    const slot = actor.activeSlot === 1 ? 'secondary' : 'primary';
    const weaponId = actor.equipment?.[slot] || 'fizz';
    const appearance = weaponAppearance(actor.equipment, slot);
    const signature = JSON.stringify([weaponId, appearance]);
    if (this.weaponSignature !== signature) {
      if (this.weapon) { this.assets.releaseVisual(this.weapon); this.weaponGroup.remove(this.weapon); }
      this.weapon = this.assets.weapon(weaponId, appearance);
      this.weaponGroup.add(this.weapon);
      this.weaponId = weaponId;
      this.weaponSignature = signature;
      this.swap = 1;
    }
    const sleeveColor = PALETTE[(actor.cosmetics || actor.equipment?.cosmetics)?.bodyColor] || '#c9ef64';
    for (const sleeve of this.sleeves) sleeve.material = this.assets.material(sleeveColor);
    const state = this.game.combat?.getWeaponState(actor);
    const weapon = this.game.combat?.getWeapon(actor);
    const reloading = state?.reloadEnd > this.game.time;
    const reloadProgress = reloading ? clamp(1 - (state.reloadEnd - this.game.time) / (weapon?.reloadTime || 1.8), 0, 1) : 0;
    const reloadDip = reloading ? Math.sin(reloadProgress * Math.PI) : 0;
    const targetX = aim ? 0.07 : 0.29;
    this.weaponRoot.position.x = damp(this.weaponRoot.position.x, targetX, 12, dt);
    const kick = this.recoil * (this.settings.reducedMotion ? 0.3 : 1);
    this.weaponRoot.position.y = -0.25 - reloadDip * 0.18 - this.swap * 0.32 - this.gadgetMotion * 0.15 + Math.cos(this.bob * 2) * bobStrength * 0.013;
    this.weaponRoot.position.z = -0.62 + kick * 0.07 + (aim ? -0.035 : 0);
    this.weaponRoot.rotation.set(kick * 0.13 + sprint * 0.15 + reloadDip * 0.28, sprint * -0.28 + Math.sin(this.bob) * bobStrength * 0.015, -reloadDip * 0.62 - sprint * 0.25 + this.gadgetMotion * 0.25 + Math.sin(this.bob) * bobStrength * 0.025);
    const magazine = this.weapon.getObjectByName('magazine');
    if (magazine) magazine.position.y = -0.23 - reloadDip * 0.3;
    const spinner = this.weapon.getObjectByName('spinner');
    if (spinner && !this.settings.reducedMotion) spinner.rotation.z += dt * (['updraft', 'spool'].includes(weaponId) ? 8 + this.recoil * 30 : 1);
    const disc = this.weapon.getObjectByName('disc');
    if (disc && !this.settings.reducedMotion) disc.rotation.y += dt * (2 + this.recoil * 20);
    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    this.muzzleFlash.visible = this.muzzleTime > 0;
    if (this.muzzleFlash.visible) {
      this.muzzleFlash.position.copy(this.weapon.getObjectByName('muzzle').position);
      this.muzzleFlash.scale.set(1, 1, 1.7);
      this.muzzleFlash.rotation.z = this.time * 31;
      this.weaponRoot.localToWorld(this.temp.copy(this.muzzleFlash.position));
      this.muzzleLight.position.copy(this.temp);
    }
    this.muzzleLight.intensity = this.muzzleTime > 0 ? 2 : 0;
  }

  effect(mesh, life, data = {}) {
    if (this.effects.length >= this.maxEffects) this.removeEffect(0);
    this.scene.add(mesh);
    this.effects.push({ mesh, life, duration: life, ...data });
  }

  effectMesh(key, geometry, color, options = {}) {
    const pool = this.effectPool.get(key);
    const mesh = pool?.pop() || new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, ...options }));
    if (mesh.userData.effectKey) this.pooledEffects--;
    mesh.userData.effectKey = key;
    mesh.material.color.set(color);
    mesh.material.opacity = 1;
    mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
    return mesh;
  }

  removeEffect(index) {
    const [effect] = this.effects.splice(index, 1);
    this.scene.remove(effect.mesh);
    const key = effect.mesh.userData.effectKey;
    if (key && this.pooledEffects < this.maxEffects) {
      if (!this.effectPool.has(key)) this.effectPool.set(key, []);
      this.effectPool.get(key).push(effect.mesh); this.pooledEffects++;
    } else effect.mesh.material.dispose();
  }

  particle(point, color, speed, life = 0.6, confetti = false) {
    const geometry = this.assets.geometry(confetti ? 'BoxGeometry' : 'OctahedronGeometry', confetti ? [0.1, 0.045, 0.16] : [0.055, 0]);
    const mesh = this.effectMesh(confetti ? 'confetti' : 'spark', geometry, color);
    mesh.position.set(point.x, point.y, point.z);
    const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed);
    this.effect(mesh, life, { velocity: direction, gravity: confetti ? 5 : 9, spin: this.settings.reducedMotion ? 0 : confetti ? 9 : 3 });
  }

  tracer(start, end, color, radius = 0.018, life = 0.065) {
    if (!start || !end) return;
    const a = new THREE.Vector3(start.x, start.y, start.z);
    const b = new THREE.Vector3(end.x, end.y, end.z);
    const distance = a.distanceTo(b);
    if (distance < 0.001) return;
    const mesh = this.effectMesh('trace', this.assets.geometry('CylinderGeometry', [1, 1, 1, 5]), color || '#ffe19c');
    mesh.position.copy(a).lerp(b, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    mesh.scale.set(radius, distance, radius);
    this.effect(mesh, life);
  }

  burst(point, color, radius) {
    const mesh = this.effectMesh('burst', this.assets.geometry('SphereGeometry', [1, 12, 8]), color, { wireframe: true });
    mesh.position.set(point.x, point.y, point.z);
    mesh.scale.setScalar(0.1);
    this.effect(mesh, 0.32, { expand: radius || 2.5 });
  }

  pulse(event) {
    const point = event.point || this.game.getActor(event.actorId)?.pos;
    if (!point) return;
    const direction = new THREE.Vector3(event.direction?.x || 0, event.direction?.y || 0, event.direction?.z ?? -1).normalize();
    const count = this.settings.effects === 'low' ? 1 : 3;
    for (let i = 0; i < count; i++) {
      const mesh = this.effectMesh('pulse', this.assets.geometry('TorusGeometry', [1, 0.026, 6, 32]), event.color || '#a1eddb');
      const start = new THREE.Vector3(point.x, point.y, point.z);
      mesh.position.copy(start);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      const range = event.radius || 8;
      mesh.scale.setScalar(0.2);
      this.effect(mesh, 0.28 + i * 0.055, { pulse: true, start, direction, range, pull: event.core === 'pull', lift: event.core === 'lift' });
    }
  }

  electricTrace(origin, point, color) {
    if (!origin || !point) return;
    const a = new THREE.Vector3(origin.x, origin.y, origin.z);
    const b = new THREE.Vector3(point.x, point.y, point.z);
    const count = this.settings.effects === 'low' ? 2 : 5;
    let previous = a;
    for (let i = 1; i <= count; i++) {
      const next = a.clone().lerp(b, i / count);
      if (i < count) { next.x += (i % 2 ? 1 : -1) * 0.12; next.y += (i % 2 ? -1 : 1) * 0.14; }
      this.tracer(previous, next, color || '#9fbdff', 0.025, 0.12); previous = next;
    }
  }

  handleEvents(events) {
    for (const event of events) {
      const local = event.actorId === this.game.player?.id;
      const mesh = this.actorMeshes.get(event.actorId);
      if (event.type === 'shot') {
        if (local) {
          this.recoil = Math.min(1.8, this.recoil + (event.weaponId === 'fizz' ? 0.45 : 1));
          this.shake = Math.min(1.5, this.shake + (event.weaponId === 'fizz' ? 0.1 : 0.25));
          this.muzzleTime = 0.055;
        }
        if (mesh) mesh.userData.recoil = 0.4;
        let origin = event.origin;
        if (local && origin) {
          const yaw = this.game.player.yaw;
          origin = { x: origin.x + Math.cos(yaw) * 0.22, y: origin.y - 0.12, z: origin.z - Math.sin(yaw) * 0.22 };
        }
        if (event.weaponId === 'arc') this.electricTrace(origin, event.point, event.color);
        else this.tracer(origin, event.point, event.color, event.weaponId === 'rail' ? 0.045 : 0.017, event.weaponId === 'rail' ? 0.16 : 0.055);
      } else if (event.type === 'impact' && event.point) {
        for (let i = 0; i < Math.ceil(3 * this.effectDensity); i++) this.particle(event.point, event.color || '#fff0b8', 2 + Math.random() * 2, 0.23);
      } else if (event.type === 'damage') {
        if (mesh) mesh.userData.hit = 1;
        if (local) this.shake = Math.min(this.shake + 0.6, 1.8);
      } else if (event.type === 'eliminate' && event.point) {
        const count = Math.ceil(24 * this.effectDensity);
        for (let i = 0; i < count; i++) this.particle(event.point, COLORS[i % COLORS.length], 2 + Math.random() * 5, 1.1 + Math.random() * 0.4, true);
        this.burst(event.point, event.color || '#d6ee80', 1.5);
      } else if (event.type === 'explosion' && event.point) {
        this.burst(event.point, event.color || '#ffbd75', event.radius);
        for (let i = 0; i < Math.ceil(10 * this.effectDensity); i++) this.particle(event.point, event.color || '#ffbd75', 4 + Math.random() * 4, 0.6);
        const player = this.game.player;
        if (player) {
          const distance = Math.hypot(player.pos.x - event.point.x, player.pos.y - event.point.y, player.pos.z - event.point.z);
          this.shake = Math.min(this.shake + Math.max(0, 1 - distance / 15), 1.8);
        }
      } else if (event.type === 'impulse') {
        this.pulse(event);
        if (local) { this.gadgetMotion = 1; this.shake = Math.max(this.shake, 0.25); }
        if (mesh) mesh.userData.gadget = 1;
      } else if (event.type === 'ability' || event.type === 'gadget') {
        if (local) this.gadgetMotion = 1;
        if (mesh) mesh.userData.gadget = 1;
        if (event.point && event.type === 'ability') this.burst({ ...event.point, y: event.point.y + 0.35 }, event.color || '#b8e8d9', event.classId === 'bulwark' ? 1.1 : 0.65);
      } else if (event.type === 'slide') {
        if (local) this.land = 0.65;
      } else if (event.type === 'land') {
        if (local) this.land = 1;
        if (mesh) mesh.userData.land = 1;
      } else if (event.type === 'switch' && local) {
        this.swap = 1;
      } else if (event.type === 'spawn') {
        if (local) { this.recoil = 0; this.shake = 0; this.swap = 1; }
      } else if (event.type === 'matchStart') {
        while (this.effects.length) this.removeEffect(0);
        for (const collection of [this.projectileMeshes, this.fieldMeshes]) {
          for (const object of collection.values()) this.scene.remove(object);
          collection.clear();
        }
      }
    }
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      if (effect.life <= 0) { this.removeEffect(i); continue; }
      const fade = effect.life / effect.duration;
      effect.mesh.material.opacity = fade * (effect.expand ? 0.35 : 0.9);
      if (effect.velocity) {
        effect.velocity.y -= dt * effect.gravity;
        effect.mesh.position.addScaledVector(effect.velocity, dt);
        if (effect.mesh.position.y < 0.06) { effect.mesh.position.y = 0.06; effect.velocity.y *= -0.3; effect.velocity.x *= 0.8; effect.velocity.z *= 0.8; }
        effect.mesh.rotation.x += dt * effect.spin;
        effect.mesh.rotation.z += dt * effect.spin * 0.65;
      }
      if (effect.expand) effect.mesh.scale.setScalar((1 - fade) * effect.expand);
      if (effect.pulse) {
        const progress = effect.pull ? fade : 1 - fade;
        effect.mesh.position.copy(effect.start).addScaledVector(effect.direction, progress * effect.range);
        if (effect.lift) effect.mesh.position.y += progress * 1.1;
        effect.mesh.scale.setScalar(0.18 + progress * effect.range * 0.42);
      }
    }
  }

  render(dt, alpha = 1) {
    dt = clamp(dt || 0, 0, 0.06);
    this.time += dt;
    const menu = this.game.match.state === 'menu';
    this.alpha = this.game.paused || menu || this.game.match.state === 'ended' ? 1 : clamp(alpha, 0, 1);
    this.recoil = damp(this.recoil, 0, 13, dt);
    this.shake = damp(this.shake, 0, 10, dt);
    this.land = damp(this.land, 0, 12, dt);
    this.swap = damp(this.swap, 0, 11, dt);
    this.gadgetMotion = damp(this.gadgetMotion, 0, 7, dt);
    this.syncActors(dt, menu);
    this.syncCombat(dt);
    this.updateCamera(dt, menu);
    this.updateEffects(dt);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    if (menu) this.renderer.render(this.presentationScene, this.presentationCamera);
    else if (this.game.player?.alive) this.renderer.render(this.weaponScene, this.weaponCamera);
  }

  dispose() {
    while (this.effects.length) this.removeEffect(0);
    for (const pool of this.effectPool.values()) for (const mesh of pool) mesh.material.dispose();
    this.effectPool.clear(); this.pooledEffects = 0;
    for (const disposable of this.extraDisposables) disposable.dispose();
    this.sun.shadow.dispose();
    this.assets.dispose();
    this.renderer.dispose();
  }
}
