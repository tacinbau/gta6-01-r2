// Azura Bay — tuning, districts, palettes and shared constants.
// An invented sun-soaked island city. No real place, no borrowed names.
export const WORLD = {
  size: 3200,
  roadSpacing: 320,
  roadWidth: 46,
  beach: 120,
};

export const DISTRICTS = [
  { id: 'oldtown', name: 'Old Town', x: 0, y: 0, w: 1280, h: 1280, color: '#e8b64c', standing: 0 },
  { id: 'hills', name: 'The Hills', x: 1280, y: 0, w: 1920, h: 1280, color: '#7fb069', standing: 0 },
  { id: 'downtown', name: 'Downtown', x: 0, y: 1280, w: 1600, h: 960, color: '#4cc9f0', standing: 0 },
  { id: 'docks', name: 'The Docks', x: 1600, y: 1280, w: 1600, h: 960, color: '#f4845f', standing: 0 },
  { id: 'marina', name: 'Marina', x: 0, y: 2240, w: 3200, h: 960, color: '#ff70a6', standing: 0 },
];

export const PLAYER = {
  walkSpeed: 175,
  sprintSpeed: 265,
  radius: 13,
  maxHealth: 100,
  startCash: 300,
};

export const CAR = {
  accel: 330,
  brake: 700,
  reverseMax: 150,
  steer: 2.6,
  grip: 0.94,
  length: 46,
  width: 22,
};

export const CAR_MODELS = [
  { id: 'sedan', name: 'Marina Sedan', top: 380, accel: 300, grip: 0.94, price: 0, color: '#5a7d9a' },
  { id: 'coupe', name: 'Sol Coupe', top: 470, accel: 360, grip: 0.95, price: 1200, color: '#c0392b' },
  { id: 'muscle', name: 'Brasa Muscle', top: 430, accel: 420, grip: 0.90, price: 1800, color: '#e67e22' },
  { id: 'sport', name: 'Azura GT', top: 540, accel: 430, grip: 0.96, price: 3500, color: '#f1c40f' },
  { id: 'van', name: 'Docks Van', top: 330, accel: 260, grip: 0.93, price: 900, color: '#7f8c8d' },
];

export const UPGRADES = {
  engine: [0, 400, 900, 1600],
  tires: [0, 350, 800, 1400],
  armor: [0, 450, 1000, 1800],
};

export const WEAPONS = [
  { id: 'fists', name: 'Fists', slot: 1, damage: 12, rate: 0.35, range: 34, ammo: Infinity, price: 0 },
  { id: 'pistol', name: 'P9 Pistol', slot: 2, damage: 22, rate: 0.28, range: 320, ammo: 60, price: 250 },
  { id: 'smg', name: 'Vesper SMG', slot: 3, damage: 14, rate: 0.09, range: 300, ammo: 180, price: 900 },
];

export const CREW = [
  { id: 'rook', name: 'Rook', role: 'Getaway driver', bonus: 'Top speed +12%, sharper steering', locked: true },
  { id: 'vera', name: 'Vera', role: 'Hacker', bonus: 'Wanted cools down 40% faster, roadblocks arrive late', locked: true },
];

export const WANTED = {
  decayBase: 0.55,
  decayHidden: 1.6,
  bustDistance: 46,
  maxStars: 5,
};

export const POLICE_PER_STAR = [0, 2, 3, 4, 5, 6];
export const ROADBLOCK_STARS = 3;
export const HELI_STARS = 4;

export const STEP = 1 / 60;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const RADIO = [
  { id: 'sol', name: 'SOL 98.5 — Sunset Synth', bpm: 112, root: 57, scale: [0, 3, 5, 7, 10] },
  { id: 'brasa', name: 'BRASA 101 — Island Heat', bpm: 96, root: 55, scale: [0, 2, 3, 7, 8] },
  { id: 'ola', name: 'OLA FM — Talk & Traffic', bpm: 0, root: 0, scale: [] },
];

export const SAVE_KEY = 'azura-bay-save-v1';
