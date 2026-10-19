import * as THREE from 'three';

const INK = '#242432';
const CREAM = '#fff6df';

/** Shared geometry and materials keep a full bot match inexpensive to draw. */
export class Procedural {
  constructor() {
    this.geometries = new Map();
    this.materials = new Map();
    this.uniqueMaterials = new Set();
    this.weapons = new Map();
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

  weapon(id) {
    if (!this.weapons.has(id)) this.weapons.set(id, this.buildWeapon(id));
    return this.weapons.get(id).clone(true);
  }

  buildWeapon(id) {
    const root = new THREE.Group();
    root.name = `weapon-${id}`;
    const color = ({ fizz: '#ff795f', doorbell: '#ffca42', bankshot: '#cced45', confetti: '#c49aff', rail: '#72e6de', updraft: '#ff9b49', yoink: '#f06eb0' })[id] || '#ff795f';
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

  mascot(color, variant = 0, weaponId = 'fizz') {
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
    if (variant % 3 === 0) {
      this.tube(hat, [0.19, 0.24], 0.11, '#fc80b0', [0, 1.71, 0], [0, 0, 0]);
      this.box(hat, [0.035, 0.2, 0.035], INK, [0, 1.86, 0]);
      const propeller = this.box(hat, [0.48, 0.025, 0.08], '#fc80b0', [0, 1.96, 0], [0, 0.35, 0]);
      propeller.name = 'propeller';
      this.ball(hat, 0.045, CREAM, [0, 1.98, 0]);
    } else if (variant % 3 === 1) {
      this.tube(hat, [0.26, 0.3], 0.19, '#a48ae1', [0, 1.76, 0], [0, 0, 0]);
      this.tube(hat, [0.37, 0.37], 0.045, '#a48ae1', [0, 1.665, 0], [0, 0, 0]);
      this.box(hat, [0.1, 0.07, 0.025], '#ffe386', [0, 1.75, -0.29]);
    } else {
      this.mesh(hat, 'ConeGeometry', [0.23, 0.42, 12], '#ffb35e', [0, 1.85, 0], [0, 0, -0.2]);
      this.ball(hat, 0.07, CREAM, [0.04, 2.07, 0]);
    }
    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.34, 0.93, -0.28);
    weaponPivot.scale.setScalar(0.52);
    torso.add(weaponPivot);
    const weapon = this.weapon(weaponId);
    weaponPivot.add(weapon);
    root.userData = { torso, body, feet, arms, hat, weaponPivot, weapon, weaponId, hit: 0, recoil: 0, land: 0 };
    return root;
  }

  dispose() {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const material of this.uniqueMaterials) material.dispose();
  }
}
