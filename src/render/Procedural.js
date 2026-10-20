import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COSMETICS, WEAPON_FINISHES } from '../data/customization.js';

const INK = '#242432';
const CREAM = '#fff6df';
export const PALETTE = Object.fromEntries(Object.entries({ ...COSMETICS.bodyColor, mono: WEAPON_FINISHES.mono }).map(([id, entry]) => [id, entry.color]));
const GUN_COLORS = { fizz: '#ff795f', doorbell: '#ffca42', bankshot: '#cced45', confetti: '#c49aff', rail: '#72e6de', updraft: '#ff9b49', yoink: '#f06eb0', burst: '#d1e7b1', spool: '#f29d6a', tack: '#86cbd4', disc: '#b2a0df', arc: '#f0d875' };

export function visualSignature(equipment = {}, actor = {}) {
  return JSON.stringify([actor.classId || equipment.classId || 'runner', actor.cosmetics || equipment.cosmetics || {}, actor.team || null]);
}

export function weaponAppearance(equipment = {}, slot = 'primary') {
  return { finish: equipment.finishes?.[slot] || 'factory', mods: equipment.mods?.[slot] || {} };
}

/** Shared geometry and materials keep a full bot match inexpensive to draw. */
export class Procedural {
  constructor() {
    this.geometries = new Map();
    this.materials = new Map();
    this.uniqueMaterials = new Set();
    this.weapons = new Map();
    this.ownedGeometries = new Set();
  }

  geometry(kind, args) {
    const key = `${kind}:${args.join(',')}`;
    if (!this.geometries.has(key)) this.geometries.set(key, new THREE[kind](...args));
    return this.geometries.get(key);
  }

  material(color, options = {}) {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...options }));
    }
    return this.materials.get(key);
  }

  mesh(parent, kind, args, color, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], options = {}) {
    const mesh = new THREE.Mesh(this.geometry(kind, args), this.material(color, options));
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(p, size, c, at, rot) { return this.mesh(p, 'BoxGeometry', size, c, at, rot); }
  ball(p, radius, c, at, scale) { return this.mesh(p, 'SphereGeometry', [radius, 14, 10], c, at, undefined, scale); }
  tube(p, radii, length, c, at, rot = [Math.PI / 2, 0, 0]) {
    return this.mesh(p, 'CylinderGeometry', [radii[0], radii[1], length, 16], c, at, rot);
  }
  ring(p, radius, tube, c, at, rot) { return this.mesh(p, 'TorusGeometry', [radius, tube, 8, 20], c, at, rot); }

  weapon(id, appearance = {}) {
    if (!this.weapons.has(id)) this.weapons.set(id, this.buildWeapon(id));
    const root = this.weapons.get(id).clone(true);
    const finish = PALETTE[appearance.finish];
    if (finish) {
      const original = new THREE.Color(GUN_COLORS[id] || GUN_COLORS.fizz).getHex();
      root.traverse(node => { if (node.isMesh && node.material.color.getHex() === original) node.material = this.material(finish); });
    }
    const mods = appearance.mods || {};
    const accent = finish || GUN_COLORS[id] || GUN_COLORS.fizz;
    if (mods.barrel && mods.barrel !== 'standard') {
      const muzzle = root.getObjectByName('muzzle');
      const profile = ({ precision: [0.075, 0.17], long: [0.085, 0.28], compact: [0.09, 0.05], impact: [0.16, 0.09] })[mods.barrel] || [0.1, 0.1];
      const [radius, length] = profile;
      this.tube(root, [radius, radius], length, INK, [0, 0, muzzle.position.z - length / 2]);
      this.ring(root, radius, 0.02, accent, [0, 0, muzzle.position.z - length]);
      if (mods.barrel === 'impact' || mods.barrel === 'long') this.ring(root, radius, 0.02, CREAM, [0, 0, muzzle.position.z - length / 2]);
      muzzle.position.z -= length;
    }
    if (mods.magazine && mods.magazine !== 'standard') {
      const magazine = root.getObjectByName('magazine');
      if (/drum|extended|large/.test(mods.magazine)) {
        magazine.visible = false;
        const drum = this.tube(root, [0.18, 0.18], 0.23, INK, [0, -0.23, -0.24], [0, 0, Math.PI / 2]);
        drum.name = 'drum';
        this.tube(root, [0.14, 0.14], 0.245, accent, [0, -0.23, -0.24], [0, 0, Math.PI / 2]);
      } else if (mods.magazine === 'quick') {
        magazine.scale.set(0.82, 0.8, 0.9);
        this.box(root, [0.19, 0.055, 0.23], CREAM, [0, -0.32, -0.24]);
      } else {
        this.box(root, [0.1, 0.24, 0.17], INK, [0.22, -0.12, -0.12], [0, 0, -0.2]);
        this.box(root, [0.11, 0.045, 0.18], accent, [0.24, -0.23, -0.12], [0, 0, -0.2]);
      }
    }
    if (mods.handling && mods.handling !== 'standard') {
      if (/stabil|steady|stock/.test(mods.handling)) {
        this.box(root, [0.08, 0.08, 0.26], INK, [0, -0.03, 0.24]);
        this.box(root, [0.21, 0.24, 0.055], accent, [0, -0.075, 0.35]);
      } else {
        this.box(root, [0.075, 0.18, 0.08], INK, [-0.01, -0.2, -0.42], [-0.22, 0, 0]);
        if (mods.handling === 'rapid') this.box(root, [0.045, 0.16, 0.045], accent, [0.12, -0.16, 0.02], [-0.4, 0, 0]);
        else for (let i = 0; i < 2; i++) this.ring(root, 0.045, 0.012, CREAM, [0.15, 0.05, -0.08 - i * 0.1], [0, Math.PI / 2, 0]);
      }
    }
    this.packStatic(root, node => {
      for (let part = node; part && part !== root; part = part.parent) if (['magazine', 'drum', 'spinner', 'disc'].includes(part.name)) return false;
      return true;
    });
    return root;
  }

  buildWeapon(id) {
    const root = new THREE.Group();
    root.name = `weapon-${id}`;
    const color = GUN_COLORS[id] || GUN_COLORS.fizz;
    const body = new THREE.Group();
    body.name = 'receiver';
    root.add(body);
    // The same readable toy silhouettes are used in hands and on bots.
    this.box(body, [0.17, 0.34, 0.14], INK, [0.01, -0.2, 0.05], [-0.2, 0, 0]);
    const magazine = this.box(body, [0.17, 0.26, 0.21], color, [0, -0.23, -0.24], [0.12, 0, 0]);
    magazine.name = 'magazine';
    let muzzle = -0.75;

    if (id === 'fizz') {
      this.box(body, [0.27, 0.27, 0.55], color, [0, 0, -0.17]);
      this.box(body, [0.29, 0.07, 0.39], CREAM, [0, 0.16, -0.14]);
      this.tube(body, [0.085, 0.11], 0.28, INK, [0, 0, -0.57]);
      this.ring(body, 0.09, 0.025, color, [0, 0, -0.73]);
      const can = this.tube(body, [0.1, 0.1], 0.31, '#b9ee50', [0.19, 0.07, -0.11], [0, 0, -0.18]);
      can.name = 'spinner';
      this.tube(body, [0.102, 0.102], 0.024, CREAM, [0.216, 0.23, -0.11], [0, 0, -0.18]);
      this.box(body, [0.045, 0.065, 0.1], INK, [0, 0.22, -0.34]);
    } else if (id === 'doorbell') {
      this.box(body, [0.32, 0.27, 0.42], '#a16e43', [0, 0, -0.04]);
      this.tube(body, [0.14, 0.26], 0.36, color, [0, 0, -0.43]);
      this.tube(body, [0.255, 0.255], 0.02, INK, [0, 0, -0.618]);
      this.ring(body, 0.255, 0.035, color, [0, 0, -0.63]);
      this.ball(body, 0.085, CREAM, [0.2, 0.12, -0.08]);
      this.box(body, [0.24, 0.07, 0.28], CREAM, [0, 0.17, -0.04]);
      muzzle = -0.66;
    } else if (id === 'bankshot') {
      this.box(body, [0.36, 0.24, 0.44], color, [0, 0, -0.12]);
      this.box(body, [0.1, 0.085, 0.56], INK, [-0.14, 0, -0.49]);
      this.box(body, [0.1, 0.085, 0.56], INK, [0.14, 0, -0.49]);
      this.ball(body, 0.14, '#bc89fa', [0, 0, -0.46]);
      this.tube(body, [0.19, 0.19], 0.12, CREAM, [0, 0.15, -0.03], [0, 0, 0]);
      this.box(body, [0.05, 0.025, 0.21], '#fa79a7', [0, 0.22, -0.03], [0, 0.6, 0]);
      muzzle = -0.79;
    } else if (id === 'confetti') {
      this.tube(body, [0.2, 0.2], 0.55, color, [0, 0, -0.18]);
      this.tube(body, [0.17, 0.29], 0.28, '#ffbb5e', [0, 0, -0.57]);
      this.tube(body, [0.28, 0.28], 0.02, INK, [0, 0, -0.716]);
      this.ring(body, 0.28, 0.025, CREAM, [0, 0, -0.73]);
      for (let i = 0; i < 3; i++) this.ring(body, 0.202, 0.022, CREAM, [0, 0, 0.03 - i * 0.18]);
      this.box(body, [0.07, 0.12, 0.08], '#bdf059', [0, 0.25, 0.02]);
      muzzle = -0.76;
    } else if (id === 'rail') {
      this.box(body, [0.22, 0.2, 0.65], color, [0, 0, -0.2]);
      this.box(body, [0.1, 0.1, 0.5], INK, [0, 0, -0.73]);
      for (let i = 0; i < 4; i++) this.ring(body, 0.09, 0.023, '#f8a2cf', [0, 0, -0.55 - i * 0.1]);
      this.tube(body, [0.085, 0.085], 0.28, CREAM, [0, 0.21, -0.2]);
      this.tube(body, [0.067, 0.067], 0.014, '#414362', [0, 0.21, -0.048]);
      this.box(body, [0.18, 0.27, 0.21], INK, [0, -0.02, 0.25], [0.3, 0, 0]);
      muzzle = -1;
    } else if (id === 'updraft') {
      this.box(body, [0.23, 0.25, 0.38], color, [0, 0, 0]);
      this.tube(body, [0.16, 0.3], 0.34, color, [0, 0, -0.35]);
      this.tube(body, [0.28, 0.28], 0.01, INK, [0, 0, -0.525]);
      this.ring(body, 0.29, 0.035, CREAM, [0, 0, -0.54]);
      const fan = new THREE.Group();
      fan.name = 'spinner';
      fan.position.set(0, 0, -0.548);
      body.add(fan);
      for (let i = 0; i < 3; i++) this.box(fan, [0.1, 0.4, 0.02], '#b8e7dc', [0, 0, 0], [0, 0, i * Math.PI / 3]);
      this.ball(fan, 0.07, color);
      muzzle = -0.58;
    } else if (id === 'burst') {
      this.box(body, [0.3, 0.12, 0.7], INK, [0, -0.055, -0.23]);
      this.box(body, [0.32, 0.12, 0.65], color, [0, 0.13, -0.22], [-0.06, 0, 0]);
      this.tube(body, [0.085, 0.085], 0.35, CREAM, [0, 0.06, 0.08], [0, 0, Math.PI / 2]);
      this.box(body, [0.2, 0.14, 0.1], color, [0, 0.015, -0.6]);
      this.box(body, [0.13, 0.035, 0.03], INK, [0, 0.035, -0.66]);
      for (let i = 0; i < 3; i++) this.box(body, [0.04, 0.027, 0.09], CREAM, [-0.09 + i * 0.09, 0.2, -0.22]);
      muzzle = -0.68;
    } else if (id === 'spool') {
      this.box(body, [0.25, 0.27, 0.4], color, [0, 0, -0.02]);
      const spinner = new THREE.Group(); spinner.name = 'spinner'; spinner.position.z = -0.43; body.add(spinner);
      for (let i = 0; i < 3; i++) this.tube(spinner, [0.065, 0.065], 0.5, INK, [Math.cos(i * 2.094) * 0.11, Math.sin(i * 2.094) * 0.11, 0]);
      this.ring(spinner, 0.18, 0.035, color, [0, 0, -0.18]);
      this.tube(body, [0.2, 0.2], 0.26, color, [0.22, 0.02, 0.02], [0, 0, Math.PI / 2]);
      this.tube(body, [0.22, 0.22], 0.035, CREAM, [0.36, 0.02, 0.02], [0, 0, Math.PI / 2]);
      muzzle = -0.72;
    } else if (id === 'tack') {
      this.tube(body, [0.15, 0.15], 0.43, color, [0, 0, -0.18]);
      this.tube(body, [0.14, 0.035], 0.24, '#f9b56e', [0, 0, -0.51]);
      this.tube(body, [0.08, 0.08], 0.38, CREAM, [0, 0.17, 0.04], [0, 0, 0]);
      this.ring(body, 0.15, 0.025, CREAM, [0, 0, -0.25]);
      this.box(body, [0.07, 0.11, 0.08], INK, [0, 0.16, -0.3]);
      this.ball(body, 0.07, '#d4ed9c', [0, 0, -0.66], [0.7, 1.2, 0.7]);
      muzzle = -0.68;
    } else if (id === 'disc') {
      this.box(body, [0.38, 0.12, 0.42], color, [0, 0, -0.12]);
      this.box(body, [0.06, 0.1, 0.48], INK, [-0.2, 0, -0.38]);
      this.box(body, [0.06, 0.1, 0.48], INK, [0.2, 0, -0.38]);
      const disc = new THREE.Group(); disc.position.set(0, 0, -0.38); disc.name = 'disc'; body.add(disc);
      this.tube(disc, [0.235, 0.235], 0.045, CREAM, [0, 0, 0], [0, 0, 0]);
      this.ring(disc, 0.17, 0.025, color, [0, 0.03, 0], [Math.PI / 2, 0, 0]);
      this.tube(disc, [0.07, 0.07], 0.065, INK, [0, 0, 0], [0, 0, 0]);
      muzzle = -0.68;
    } else if (id === 'arc') {
      this.box(body, [0.29, 0.23, 0.38], color, [0, 0, -0.08]);
      for (const sign of [-1, 1]) {
        this.tube(body, [0.04, 0.04], 0.4, INK, [sign * 0.15, 0, -0.44]);
        for (let i = 0; i < 3; i++) this.ring(body, 0.06, 0.018, '#9a9fe6', [sign * 0.15, 0, -0.3 - i * 0.1]);
        this.ball(body, 0.075, CREAM, [sign * 0.15, 0, -0.65]);
      }
      this.tube(body, [0.11, 0.11], 0.045, CREAM, [0, 0.16, -0.08], [0, 0, 0]);
      this.box(body, [0.035, 0.02, 0.13], INK, [0, 0.19, -0.08], [0, -0.4, 0]);
      muzzle = -0.73;
    } else {
      this.box(body, [0.26, 0.23, 0.38], color, [0, 0, -0.02]);
      this.tube(body, [0.07, 0.07], 0.35, INK, [0, 0, -0.35]);
      for (let i = 0; i < 5; i++) this.ring(body, 0.11, 0.017, CREAM, [0, 0, -0.22 - i * 0.065]);
      this.tube(body, [0.07, 0.23], 0.15, '#fc74ad', [0, 0, -0.6]);
      this.ring(body, 0.23, 0.025, '#fc74ad', [0, 0, -0.69]);
      this.ball(body, 0.07, '#bdf052', [0.17, 0.08, -0.04]);
      muzzle = -0.72;
    }
    const front = new THREE.Object3D();
    front.name = 'muzzle';
    front.position.set(0, 0, muzzle);
    root.add(front);
    return root;
  }

  mascot(color, variant = 0, weaponId = 'fizz', options = {}) {
    const cosmetics = options.cosmetics || {};
    color = PALETTE[cosmetics.bodyColor] || color;
    const accent = PALETTE[cosmetics.accentColor] || '#f28cad';
    const root = new THREE.Group();
    const torso = new THREE.Group();
    root.add(torso);
    const body = this.mesh(torso, 'CapsuleGeometry', [0.43, 0.62, 6, 16], color, [0, 0.98, 0]);
    body.material = body.material.clone();
    this.uniqueMaterials.add(body.material);
    // An asymmetrical brow and enormous eyes make these beans look delightfully concerned.
    for (const sign of [-1, 1]) {
      this.ball(torso, 0.15, CREAM, [sign * 0.17, 1.27, -0.37], [0.95, 1.2, 0.6]);
      this.ball(torso, 0.072, INK, [sign * 0.17 - 0.012, 1.27, -0.457], [0.83, 1.12, 0.42]);
      this.ball(torso, 0.023, '#ffffff', [sign * 0.17 - 0.028, 1.297, -0.483]);
      this.box(torso, [0.19, 0.055, 0.055], INK, [sign * 0.17, 1.49, -0.335], [0, 0, sign < 0 ? -0.18 : 0.32]);
      this.ball(torso, 0.075, '#ff7b93', [sign * 0.29, 1.065, -0.344], [1, 0.48, 0.3]);
    }
    this.ball(torso, 0.078, INK, [0, 1.045, -0.422], [1, 0.36, 0.25]);
    this.box(torso, [0.045, 0.031, 0.015], CREAM, [0.018, 1.054, -0.444]);
    const feet = [];
    const arms = [];
    for (const sign of [-1, 1]) {
      const foot = new THREE.Group();
      foot.position.set(sign * 0.23, 0.13, 0);
      root.add(foot);
      this.ball(foot, 0.2, INK, [0, 0.025, -0.07], [0.92, 0.57, 1.35]);
      this.box(foot, [0.29, 0.045, 0.39], CREAM, [0, -0.04, -0.05]);
      this.box(foot, [0.14, 0.025, 0.03], color, [0, 0.12, -0.17]);
      feet.push(foot);
      const arm = new THREE.Group();
      arm.position.set(sign * 0.39, 1.02, 0);
      torso.add(arm);
      this.mesh(arm, 'CapsuleGeometry', [0.1, 0.25, 4, 8], color, [sign * 0.05, -0.14, -0.02], [0.5, 0, sign * 0.3]);
      this.ball(arm, 0.12, CREAM, [sign * 0.09, -0.25, -0.13]);
      arms.push(arm);
    }
    const hat = new THREE.Group();
    torso.add(hat);
    const hatId = cosmetics.hat || ['antenna', 'cap', 'crown'][variant % 3];
    if (hatId === 'antenna') {
      this.tube(hat, [0.19, 0.24], 0.11, accent, [0, 1.71, 0], [0, 0, 0]);
      this.box(hat, [0.035, 0.2, 0.035], INK, [0, 1.86, 0]);
      const propeller = this.box(hat, [0.48, 0.025, 0.08], accent, [0, 1.96, 0], [0, 0.35, 0]);
      propeller.name = 'propeller';
      this.ball(hat, 0.045, CREAM, [0, 1.98, 0]);
    } else if (hatId === 'cap') {
      this.tube(hat, [0.22, 0.31], 0.15, accent, [0, 1.73, 0], [0, 0, 0]);
      this.ball(hat, 0.3, accent, [0, 1.67, -0.19], [1, 0.09, 0.8]);
    } else if (hatId === 'crown') {
      this.tube(hat, [0.25, 0.26], 0.11, accent, [0, 1.72, 0], [0, 0, 0]);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        this.mesh(hat, 'ConeGeometry', [0.075, 0.19, 4], accent, [Math.sin(a) * 0.21, 1.84, Math.cos(a) * 0.21]);
      }
    } else if (hatId === 'headphones') {
      this.ring(hat, 0.4, 0.045, INK, [0, 1.36, 0], [0, 0, 0]);
      for (const sign of [-1, 1]) this.ball(hat, 0.16, accent, [sign * 0.43, 1.33, 0], [0.45, 1, 0.8]);
    }
    this.customizeCharacter(torso, root, cosmetics, accent, options.classId || 'runner', options.team);
    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.34, 0.93, -0.28);
    weaponPivot.scale.setScalar(0.52);
    torso.add(weaponPivot);
    const weapon = this.weapon(weaponId, options.appearance);
    weaponPivot.add(weapon);
    root.userData = { torso, body, feet, arms, hat, weaponPivot, weapon, weaponId, hit: 0, recoil: 0, land: 0, gadget: 0 };
    this.packStatic(torso, node => {
      if (node === body || node.name === 'propeller') return false;
      for (let part = node; part && part !== torso; part = part.parent) if (arms.includes(part) || part === weaponPivot) return false;
      return true;
    });
    return root;
  }

  customizeCharacter(torso, root, cosmetics, accent, classId, team) {
    const decoration = new THREE.Group(); decoration.name = 'cosmetics'; torso.add(decoration);
    if (cosmetics.pattern === 'stripe') {
      this.mesh(decoration, 'CylinderGeometry', [0.434, 0.434, 0.13, 20, 1, true], accent, [0, 0.78, 0]);
    } else if (cosmetics.pattern === 'dots') {
      for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; this.ball(decoration, 0.065, accent, [Math.sin(a) * 0.421, 0.67 + (i % 2) * 0.17, Math.cos(a) * 0.421]); }
    } else if (cosmetics.pattern === 'split') {
      this.mesh(decoration, 'CylinderGeometry', [0.435, 0.435, 0.6, 12, 1, true, 0, Math.PI], accent, [0, 0.92, 0]);
    }
    if (cosmetics.face === 'visor') {
      this.ball(decoration, 0.34, accent, [0, 1.29, -0.405], [1, 0.6, 0.39]);
      this.box(decoration, [0.32, 0.028, 0.017], CREAM, [-0.04, 1.36, -0.535], [0, 0, -0.07]);
    } else if (cosmetics.face === 'shades') {
      for (const sign of [-1, 1]) {
        this.box(decoration, [0.27, 0.2, 0.045], INK, [sign * 0.17, 1.27, -0.53], [0, sign * 0.1, 0]);
        this.box(decoration, [0.09, 0.018, 0.01], CREAM, [sign * 0.17 - 0.045, 1.32, -0.563], [0, 0, -0.35]);
      }
      this.box(decoration, [0.1, 0.035, 0.05], accent, [0, 1.29, -0.54]);
    } else if (cosmetics.face === 'mask') {
      this.ball(decoration, 0.21, accent, [0, 1.02, -0.406], [1.1, 0.65, 0.42]);
      for (let i = -1; i <= 1; i++) this.box(decoration, [0.025, 0.08, 0.015], INK, [i * 0.07, 1.02, -0.494]);
    }
    if (cosmetics.back === 'tank') {
      for (const sign of [-1, 1]) {
        this.mesh(decoration, 'CapsuleGeometry', [0.14, 0.42, 4, 10], accent, [sign * 0.23, 0.97, 0.43]);
        this.tube(decoration, [0.09, 0.09], 0.08, INK, [sign * 0.23, 1.35, 0.43], [0, 0, 0]);
      }
    } else if (cosmetics.back === 'fins') {
      for (const sign of [-1, 1]) this.mesh(decoration, 'ConeGeometry', [0.19, 0.64, 3], accent, [sign * 0.44, 0.99, 0.24], [0, 0, -sign * 0.65], [0.6, 1, 0.45]);
    } else if (cosmetics.back === 'coil') {
      this.box(decoration, [0.42, 0.45, 0.18], INK, [0, 1.05, 0.4]);
      for (let i = 0; i < 4; i++) this.ring(decoration, 0.16, 0.025, accent, [0, 0.9 + i * 0.11, 0.49], [Math.PI / 2, 0, 0]);
      this.ball(decoration, 0.1, CREAM, [0, 1.48, 0.42]);
    }
    const kit = new THREE.Group(); kit.name = `class-${classId}`; torso.add(kit);
    // Class gear changes the silhouette while the simulation keeps identical hitboxes.
    if (classId === 'bulwark') {
      for (const sign of [-1, 1]) this.box(kit, [0.28, 0.19, 0.36], accent, [sign * 0.43, 1.12, 0], [0, 0, sign * -0.12]);
      this.box(kit, [0.25, 0.24, 0.05], INK, [0, 0.84, -0.43]);
      this.mesh(kit, 'ConeGeometry', [0.08, 0.11, 3], CREAM, [0, 0.82, -0.47], [0, 0, Math.PI]);
    } else if (classId === 'medic') {
      this.box(kit, [0.32, 0.28, 0.065], CREAM, [0, 0.82, -0.41]);
      this.box(kit, [0.07, 0.2, 0.025], accent, [0, 0.82, -0.457]);
      this.box(kit, [0.2, 0.07, 0.025], accent, [0, 0.82, -0.459]);
      this.box(kit, [0.17, 0.28, 0.23], CREAM, [-0.45, 0.72, 0.06]);
    } else if (classId === 'engineer') {
      this.box(kit, [0.72, 0.09, 0.7], INK, [0, 0.72, 0]);
      for (const sign of [-1, 1]) {
        this.box(kit, [0.13, 0.26, 0.17], accent, [sign * 0.43, 0.78, -0.05]);
        this.box(kit, [0.045, 0.22, 0.045], CREAM, [sign * 0.45, 0.98, -0.05]);
      }
    } else if (classId === 'disruptor') {
      for (const sign of [-1, 1]) {
        this.ring(kit, 0.14, 0.035, INK, [sign * 0.38, 1.12, -0.03], [Math.PI / 2, 0, sign * 0.2]);
        this.ball(kit, 0.07, accent, [sign * 0.43, 1.21, -0.03]);
      }
      this.mesh(kit, 'OctahedronGeometry', [0.12, 0], accent, [0, 0.83, -0.43], undefined, [1, 1, 0.3]);
    } else if (classId === 'acrobat') {
      for (const sign of [-1, 1]) {
        for (let i = 0; i < 3; i++) this.ring(root, 0.12, 0.018, accent, [sign * 0.23, 0.26 + i * 0.055, 0], [Math.PI / 2, 0, 0]);
        this.box(kit, [0.08, 0.34, 0.08], accent, [sign * 0.23, 0.82, -0.36], [0, 0, -sign * 0.3]);
      }
    } else {
      for (const sign of [-1, 1]) this.mesh(kit, 'ConeGeometry', [0.1, 0.32, 3], accent, [sign * 0.39, 0.67, 0.12], [0, 0, -sign * 0.6], [0.5, 1, 1]);
      this.box(kit, [0.08, 0.25, 0.04], CREAM, [0, 0.82, -0.43], [0, 0, -0.4]);
    }
    if (team) {
      const badge = new THREE.Group(); badge.name = 'team-badge'; badge.position.set(-0.32, 1.03, -0.31); kit.add(badge);
      if (team === 'b') this.box(badge, [0.13, 0.13, 0.03], '#f5fbff', undefined, [0, 0, Math.PI / 4]);
      else this.mesh(badge, 'ConeGeometry', [0.09, 0.16, 3], '#f5fbff', undefined, undefined, [1, 1, 0.3]);
    }
  }

  releaseMascot(root) {
    const material = root?.userData?.body?.material;
    if (material) { this.uniqueMaterials.delete(material); material.dispose(); }
    this.releaseVisual(root);
  }

  /** Bake unmoving colored pieces together. Feet, hands, magazines and rotors stay articulated. */
  packStatic(root, include) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    const meshes = [];
    root.traverse(node => { if (node.isMesh && include(node)) meshes.push(node); });
    if (meshes.length < 2) return;
    const pieces = meshes.map(mesh => {
      const source = mesh.geometry.clone();
      const geometry = source.index ? source.toNonIndexed() : source;
      if (source !== geometry) source.dispose();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      const color = mesh.material.color;
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geometry;
    });
    const merged = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    if (!merged) return;
    this.ownedGeometries.add(merged);
    const baked = new THREE.Mesh(merged, this.material('#ffffff', { vertexColors: true }));
    baked.name = 'baked-static-parts'; baked.castShadow = baked.receiveShadow = true;
    for (const mesh of meshes) mesh.removeFromParent();
    root.add(baked);
  }

  releaseVisual(root) {
    root?.traverse(node => {
      if (node.isMesh && this.ownedGeometries.has(node.geometry)) {
        this.ownedGeometries.delete(node.geometry); node.geometry.dispose();
      }
    });
  }

  dispose() {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const material of this.uniqueMaterials) material.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
  }
}
