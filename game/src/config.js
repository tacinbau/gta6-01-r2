// Azura Bay — static configuration: districts, missions, names, tuning.
// Original fiction: a sun-soaked island city. No real-world or commercial-game names.

export const CITY = {
  name: 'AZURA BAY',
  seed: 20261123,
  // City extents (world units, 1 unit ~ 1 m).
  half: 260,
  roadHalfWidth: 7,
  sidewalk: 3,
};

export const DISTRICTS = [
  { id: 'pasaru', name: 'OLD PASARU', sub: 'Stilt houses and the night market', center: [-120, -60], color: '#e07840' },
  { id: 'strand', name: 'KUMALA STRAND', sub: 'Strand Boulevard', center: [150, 40], color: '#e0a83c' },
  { id: 'downtown', name: 'DOWNTOWN', sub: 'Glass towers and the bank', center: [40, -90], color: '#7fb2e0' },
  { id: 'port', name: 'PORT MERIDIAN', sub: 'Docks and warehouses', center: [-160, 130], color: '#8fae9c' },
  { id: 'hillcrest', name: 'HILLCREST', sub: 'Houses over the bay', center: [120, -170], color: '#c98ad0' },
];

export const MISSIONS = [
  { id: 1, name: 'FIRST ERRAND', district: 'downtown', stage: 'STAGE 1/1 · REACH THE MARKET STALL',
    objective: 'Walk the package to the stall in Old Pasaru.', next: 'Finish the job',
    speaker: 'ABUELA CLEO', line: 'Cleo: You want work, kid? Walk this package to the market stall. No sirens, no shortcuts through the sea.',
    reward: 500, wanted: 0 },
  { id: 2, name: 'HOT WHEELS', district: 'strand', stage: 'STAGE 1/2 · BORROW A RIDE',
    objective: 'Take a car from Strand Boulevard and lose the tail.', next: 'Lose the tail',
    speaker: 'MIRA KESANG', line: 'Mira: Any car with four wheels will do. Just don\'t pick the one with the baby seat.',
    reward: 900, wanted: 1 },
  { id: 3, name: 'FISH MARKET BLUES', district: 'pasaru', stage: 'STAGE 1/1 · QUIET THE DOCKS',
    objective: 'Settle the fish-stall debt without a scene.', next: 'Collect the debt',
    speaker: 'LIO', line: 'Lio: The fish man owes us. Ask nice first. Nice has a time limit.',
    reward: 1200, wanted: 1 },
  { id: 4, name: 'MARKET SQUEEZE', district: 'pasaru', stage: 'STAGE 1/1 · CLEAR THE AISLES',
    objective: 'Take out the Keron Boys 0/3.', next: 'Finish the job',
    speaker: 'MIRA KESANG', line: 'Mira: Two down the left aisle! I\'ve got the stall side, Tomo.',
    reward: 1800, wanted: 2 },
  { id: 5, name: 'THE VAULT', district: 'downtown', stage: 'STAGE 1/2 · REACH THE BANK',
    objective: 'Reach the bank on the downtown strip.', next: 'Hold the plaza',
    speaker: 'ABUELA CLEO', line: 'Cleo: The bank keeps a safe in the back. In, out, gone. The alarm is your starting gun.',
    reward: 4000, wanted: 2 },
  { id: 6, name: 'ORU\'S FALL', district: 'strand', stage: 'STAGE 1/1 · WRECK THE REGENT',
    objective: 'Wreck Oru\'s Regent before it reaches the pier.', next: 'Finish the job',
    speaker: 'MIRA KESANG', line: 'Mira: He\'s making for Kumala Pier! Ram the Regent before it reaches the water!',
    reward: 3500, wanted: 5 },
  { id: 7, name: 'HELI HUNT', district: 'port', stage: 'STAGE 1/1 · DODGE AIR ONE',
    objective: 'Cross the docks while Air One circles overhead.', next: 'Reach the warehouse',
    speaker: 'KIKI', line: 'Kiki: The heli sees everything except the containers. Stay under the cranes, Tomo.',
    reward: 2600, wanted: 4 },
  { id: 8, name: 'AZURA HEIST', district: 'downtown', stage: 'STAGE 1/3 · THE BIG ONE',
    objective: 'Hit the vault, the getaway car, and the bridge — in that order.', next: 'Get to the bridge',
    speaker: 'ABUELA CLEO', line: 'Cleo: Eight jobs to get here, kid. Don\'t trip on the last step.',
    reward: 9000, wanted: 3 },
];

export const CREW = [
  { key: 'Z', name: 'SWAP PLATES', who: 'MIRA · Driver', desc: 'Swap plates, lose one star' },
  { key: 'X', name: 'QUICK FIX', who: 'LIO · Mechanic', desc: 'Repair the car on the spot' },
  { key: 'C', name: 'EYES OUT', who: 'KIKI · Lookout', desc: 'Mark police on the minimap' },
];

export const WEAPONS = [
  { slot: 1, name: 'FISTS', ammo: '∞' },
  { slot: 2, name: '.38', ammo: '48' },
  { slot: 3, name: 'SMG', ammo: '120' },
];

export const SHOP_SIGNS = ['BAKSO', 'TACOS', 'FISH', 'PIER', 'SHOP', 'CAFE', 'ROTI', 'MART', 'KITE', 'SOTO', 'NASI', 'KOPI'];

export const SHIRT_COLORS = [0xe05a5a, 0x5ab0e0, 0x62c06a, 0xe0c05a, 0xc06ad0, 0xe08a3c, 0x3cc0b0, 0xf0f0f0, 0x404040, 0xe07ab0];
export const CAR_COLORS = [0xe05a3c, 0x3c7ae0, 0xe0c53c, 0x5ac06a, 0xf0f0f0, 0x2a2a2e, 0xc05a8a, 0x7a5ac0, 0x3ca8a0, 0x8a6a4a];

export const TUNING = {
  walkSpeed: 6, runSpeed: 10, carAccel: 26, carMaxSpeed: 42, carBrake: 40,
  carTurn: 2.1, wantedDecaySeconds: 45, heliAtStars: 4, roadblockAtStars: 3,
  trafficCount: 42, pedCount: 204, buildingCount: 136, stallCount: 20, propCount: 47,
  trafficLightCount: 10, trafficLightCycle: 12, // seconds; red at t = 2 in shots
};
