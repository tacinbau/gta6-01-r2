// Police: wanted stars, responding units for the HUD, roadblocks at 3+ stars.
// The KPD cruisers in the sim chase the player when stars > 0; Air One joins at 4.
import { TUNING } from './config.js';

const UNIT_NAMES = ['CORAL-48', 'CORAL-85', 'CORAL-122', 'MARLIN-3', 'KITE-1', 'AIR ONE'];

export function policeRows(world) {
  const p = world.player;
  const rows = [];
  if (p.stars <= 0) return rows;
  const kpd = world.cars.filter((c) => c.type === 'kpd');
  kpd.forEach((c, i) => {
    rows.push({ name: UNIT_NAMES[i % UNIT_NAMES.length], status: 'IN PURSUIT', dist: Math.round(Math.hypot(c.x - p.x, c.z - p.z)) });
  });
  if (p.stars >= TUNING.heliAtStars) {
    rows.push({ name: 'AIR ONE', status: 'OVERHEAD', dist: Math.round(Math.hypot(world.heli.x - p.x, world.heli.z - p.z)) });
  }
  if (p.stars >= 2) rows.push({ name: 'FOOT ×2', status: 'IN PURSUIT', dist: 41 });
  return rows.slice(0, 5);
}

export function addWanted(world, n) {
  world.player.stars = Math.max(0, Math.min(5, world.player.stars + n));
}

export function roadblockSpots(world) {
  // Roadblocks on the roads nearest the player when stars hit 3+.
  if (world.player.stars < TUNING.roadblockAtStars) return [];
  const p = world.player;
  return [
    { x: p.x + 30, z: p.z, heading: 0 },
    { x: p.x - 26, z: p.z + 18, heading: Math.PI / 2 },
  ];
}
