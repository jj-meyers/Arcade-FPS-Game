// Deliberately replaceable graybox: positions are centers in X/Z, Y is bottom.
export const ARENA = {
  name: 'THE TEST KITCHEN', size: 56,
  obstacles: [
    { id: 'center-a', x: -3.5, y: 0, z: 0, w: 3, h: 2.6, d: 5, color: '#626974' },
    { id: 'center-b', x: 4.5, y: 0, z: 1, w: 3, h: 1.4, d: 3, color: '#7d8588' },
    { id: 'west-wall', x: -13, y: 0, z: -5, w: 2, h: 3, d: 10, color: '#697579' },
    { id: 'east-wall', x: 14, y: 0, z: 5, w: 2, h: 3, d: 9, color: '#697579' },
    { id: 'south-cover', x: 3, y: 0, z: -13, w: 7, h: 1.7, d: 2, color: '#7d8588' },
    { id: 'north-cover', x: -11, y: 0, z: 14, w: 5, h: 1.6, d: 3, color: '#7d8588' },
    { id: 'east-box', x: 19, y: 0, z: -13, w: 3, h: 2.2, d: 3, color: '#737d85' },
    { id: 'west-box', x: -20, y: 0, z: 5, w: 3, h: 2, d: 3, color: '#737d85' },
    { id: 'platform', x: 2, y: 0, z: 13, w: 6, h: 2.4, d: 5, color: '#7d8588' },
  ],
  ramps: [{ id: 'ramp', x: 2, z: 6.5, w: 4, d: 8, h: 2.4, color: '#b4be85' }],
  spawns: [
    { x: 0, y: 0, z: 22 }, { x: -22, y: 0, z: -22 },
    { x: 22, y: 0, z: 22 }, { x: 22, y: 0, z: -22 },
    { x: -22, y: 0, z: 22 }, { x: 0, y: 0, z: -23 },
    { x: -23, y: 0, z: -2 }, { x: 23, y: 0, z: 0 },
    { x: -9, y: 0, z: -20 }, { x: 9, y: 0, z: 21 },
    { x: 20, y: 0, z: 13 }, { x: -19, y: 0, z: 15 },
    { x: 9, y: 0, z: -21 },
  ],
  pads: [],
};
