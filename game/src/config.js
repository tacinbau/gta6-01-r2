// Azura Bay — every tuning number, colour and name in one place. The city is a fixed
// 3200x2400 logical island; the camera follows the player, so no rule below depends on the
// screen size. All names are invented: no Rockstar names, no real GTA content.
export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Avenues (vertical) and streets (horizontal); every road is this wide. */
export const ROADS_X = [400, 900, 1400, 1900, 2400, 2900];
export const ROADS_Y = [400, 850, 1300, 1750, 2200];
export const ROAD_W = 110;

/** The sand rim around the island, and the water beyond it. */
export const SAND = 150;

/** A water inlet cut into the island's east edge: the marina basin with docks and boats. */
export const MARINA_BASIN = { x: 2980, y: 1400, w: 220, h: 300 };

/** Roof colours for the city's buildings — terracotta, slate, sand, rust, green, blue-grey. */
export const ROOF_COLORS = ['#a85f3f', '#5a6a72', '#c9b078', '#8a5a3a', '#5a7a4a', '#6a7a8a', '#b5a06a', '#7a6a5a'];

/** Canopy colours: palms, round trees, autumn trees and dark bushes. */
export const TREE_COLORS = ['#3f7a3a', '#4a8a44', '#5a9a4a', '#7a9a3a', '#b58a3a', '#2f6a35'];

export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', x0: 900, y0: 1075, x1: 2300, y1: 1750, tint: '#7fae7a' },
  { id: 'oldtown', name: 'Old Town', x0: 0, y0: 0, x1: 1600, y1: 1075, tint: '#b5a06a' },
  { id: 'hills', name: 'The Hills', x0: 1600, y0: 0, x1: 3200, y1: 1075, tint: '#8fae6a' },
  { id: 'docks', name: 'The Docks', x0: 0, y0: 1075, x1: 900, y1: 2400, tint: '#7a8a9a' },
  { id: 'marina', name: 'Marina', x0: 2300, y0: 1075, x1: 3200, y1: 2400, tint: '#6aa5b5' },
];

/** Which district a point is in (Downtown's rect wins where regions overlap). */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[1];
}

export const PLAYER = {
  walkSpeed: 230,
  radius: 14,
  health: 100,
  fistRange: 46,
  fistDamage: 12,
};

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 12, range: 46, rate: 2.2, ammo: Infinity, auto: false },
  { id: 'pistol', name: 'Pistol', damage: 26, range: 430, rate: 3.0, ammo: 120, auto: false },
  { id: 'smg', name: 'SMG', damage: 13, range: 380, rate: 9.0, ammo: 240, auto: true },
];

/** The five garage cars. topSpeed is px/s before crew and engine bonuses. */
export const CARS = [
  { id: 'corto', name: 'Corto', top: 400, accel: 470, grip: 2.6, health: 100, price: 0, color: '#c94f43' },
  { id: 'brisa', name: 'Brisa', top: 445, accel: 510, grip: 2.8, health: 120, price: 800, color: '#4f7ec9' },
  { id: 'toro', name: 'Toro', top: 505, accel: 560, grip: 2.5, health: 150, price: 1800, color: '#c9a13b' },
  { id: 'vela', name: 'Vela', top: 565, accel: 620, grip: 3.1, health: 130, price: 3500, color: '#7ac94f' },
  { id: 'cometa', name: 'Cometa', top: 625, accel: 680, grip: 3.4, health: 140, price: 6000, color: '#a04fc9' },
];

export const UPGRADES = {
  engine: { name: 'Engine', max: 3, base: 400, topBonus: 0.09 },
  tires: { name: 'Tires', max: 3, base: 300, gripBonus: 0.18 },
  armor: { name: 'Armor', max: 3, base: 350, healthBonus: 40 },
};

/** Heat: 0..100 points, 20 per star. */
export const HEAT = {
  perStar: 20,
  stealCar: 15,
  shoot: 8,
  hitPed: 20,
  hitCop: 25,
  killCop: 35,
  decay: 1.6,
  decayHidden: 4.5,
  decayVera: 2.6,
};

/** The fixer, the crew and the safehouse. */
export const FIXER = { name: 'Abuela Cleo', x: 1150, y: 640 };
export const SAFEHOUSE = { x: 2650, y: 2050 };
export const GARAGE = { x: 1650, y: 1525 };
export const BANK = { x: 1650, y: 1075 };
export const CASINO = { x: 2150, y: 620 };

export const CREW = {
  rook: { name: 'Rook', bonus: 'Top speed +12%', topBonus: 0.12 },
  vera: { name: 'Vera', bonus: 'Heat cools faster, roadblocks held back', heatBonus: true },
};

export const PALETTE = {
  grass: '#6f9e5e',
  grass2: '#7fae6a',
  grassDark: '#5d8a4e',
  grassLight: '#8aba76',
  dryGrass: '#a8a06a',
  sand: '#e0c98f',
  sandDark: '#c9b078',
  sandLight: '#ecdcab',
  water: '#3d7ea6',
  waterDeep: '#2a5a7a',
  road: '#3a3a42',
  roadLine: '#d8c95a',
  roadEdge: 'rgba(242,240,232,0.28)',
  sidewalk: '#b0a894',
  curb: '#8a8474',
  crosswalk: 'rgba(242,240,232,0.85)',
  plaza: '#a8a294',
  parkPath: '#d8c9a0',
  building: '#8a6f5c',
  building2: '#6a7a8a',
  building3: '#a08a6a',
  roof: '#5c4a3a',
  parapet: 'rgba(0,0,0,0.28)',
  roofFeature: '#7a7a72',
  skylight: '#b8d8e8',
  palm: '#3f7a3a',
  bush: '#2f6a35',
  trunk: '#6a4a2a',
  shadow: 'rgba(0,0,0,0.22)',
  glowWarm: 'rgba(255,200,90,0.30)',
  dock: '#7a5a3a',
  boatHull: '#e8e0d0',
  panel: 'rgba(16,18,24,0.88)',
  text: '#f2f0e8',
  muted: '#b9b4a6',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4f7ec9',
  police: '#22262e',
  night: 'rgba(10,14,40,0.45)',
  dusk: 'rgba(200,90,40,0.18)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'azura-bay.save.v1';

export const RADIO = [
  { id: 'sol', name: 'Sol Mar FM', bpm: 96, root: 220, scale: [0, 3, 5, 7, 10] },
  { id: 'brisa', name: 'Brisa FM', bpm: 122, root: 196, scale: [0, 2, 4, 7, 9] },
  { id: 'neon', name: 'Neon FM', bpm: 140, root: 174, scale: [0, 3, 5, 6, 10] },
];
