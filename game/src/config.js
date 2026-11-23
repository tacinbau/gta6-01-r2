// Azura Bay configuration: districts, names, palettes, counts, missions.
// One source of truth — world.js builds from this, render.js draws from this,
// hud.js labels from this. Nothing here is copied from any other game.
export const SEED = 20261123;

export const WORLD = {
  size: 420, // playable square, metres
  roadWidth: 14,
  sidewalkWidth: 4,
};

export const COUNTS = {
  buildings: 136,
  gableHouses: 71,
  shops: 59,
  towers: 6,
  stalls: 20,
  pedestrians: 204,
  trafficCars: 42,
  kpdCruisers: 4,
  schoolBuses: 2,
  trafficLights: 10,
  palms: 46,
  props: 64,
};

export const DISTRICTS = [
  { id: 'pasaru', name: 'OLD PASARU', sub: 'Stilt houses and the night market', center: [-105, 10], color: 0x8a6b4a },
  { id: 'downtown', name: 'DOWNTOWN', sub: 'Glass towers and the bank', center: [20, -70], color: 0x5a6b8a },
  { id: 'strand', name: 'KUMALA STRAND', sub: 'Strand Boulevard', center: [60, 130], color: 0xc9a86a },
  { id: 'harbor', name: 'HARBOUR', sub: 'Docks and warehouses', center: [-60, 150], color: 0x4a6b6b },
  { id: 'hills', name: 'CORAL HILLS', sub: 'Houses above the bay', center: [110, -110], color: 0x6b8a5a },
];

export const SHOP_SIGNS = [
  'BAKSO', 'TACOS', 'FISH', 'PIER', 'SHOP', 'CAFE', 'NASI', 'SOTO',
  'MART', 'KITE', 'SHO', 'ROTI', 'KOPI', 'IKAN', 'BUAH', 'TOKO',
];

export const HOUSE_COLORS = [
  0xd9a066, 0xc97b5a, 0xe0c080, 0x9ab87a, 0x7fa3b8, 0xb87a8a,
  0xd4b48a, 0x8a9a6b, 0xc9a06b, 0xa87a6b, 0x7a8aa0, 0xe8d0a0,
];

export const SHOP_COLORS = [
  0xe8b45a, 0xd95f4b, 0x4ba3d9, 0x5ab87a, 0xe07a9a, 0x8a7ad9,
  0xd9c94b, 0x4bd9c9, 0xe08a4b, 0x9a6bd9,
];

export const TOWER_COLORS = [0x3a4a63, 0x4a3a5a, 0x2f4258, 0x55607a, 0x3d4a55, 0x5a4a6b];

export const SHIRT_COLORS = [
  0xd9382b, 0x2bd95f, 0x2b7ad9, 0xe8d02b, 0xe87ab0, 0x7a2bd9,
  0x2bd9c9, 0xe88a2b, 0xf0f0f0, 0x2b2b2b, 0xd9a02b, 0x5ad92b,
];

export const CAR_COLORS = [
  0xd9382b, 0x2b7ad9, 0xe8d02b, 0x2bd95f, 0xe87ab0, 0x7a2bd9,
  0x2bd9c9, 0xe88a2b, 0xf0f0f0, 0x2b2b2b, 0x8a5a2b, 0x5a8a2b,
];

export const HERO = {
  shirt: 0xd9382b, // bright red, easy to pick out in every shot
  carColor: 0xff7a1a, // bright orange coupe for the mission shot
  carName: 'SOL COUPE',
  name: 'TOMO',
};

export const CREW = [
  { name: 'MIRA', role: 'Driver', card: 'SWAP PLATES', key: 'Z' },
  { name: 'LIO', role: 'Mechanic', card: 'QUICK FIX', key: 'X' },
  { name: 'KIKI', role: 'Lookout', card: 'EYES OUT', key: 'C' },
];

export const WEAPONS = [
  { slot: 1, name: 'FISTS', ammo: '∞' },
  { slot: 2, name: '.38', ammo: '48' },
  { slot: 3, name: 'SMG', ammo: '120' },
];

export const POLICE_UNITS = ['CORAL-48', 'CORAL-85', 'CORAL-122', 'MARLIN-3'];

export const RADIO_STATIONS = [
  { name: 'Sol Mar FM', genre: 'Island Pop' },
  { name: 'Bayou 94', genre: 'Swamp Blues' },
  { name: 'Neon Drive', genre: 'Night Synth' },
];

export const STREET_NAMES = {
  market: 'Pasar Lane',
  avenue: 'Meridian Ave',
  strand: 'Strand Blvd',
  downtown: 'Crown Street',
};
