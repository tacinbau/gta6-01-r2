// World sim: deterministic city layout, traffic, pedestrians, police, heli.
// No THREE.js here — plain data the renderer draws and the self-test counts.
import { makeRng } from './random.js';
import { CITY, DISTRICTS, MISSIONS, SHOP_SIGNS, SHIRT_COLORS, CAR_COLORS, TUNING } from './config.js';

// Road network: axis-aligned streets {x1,z1,x2,z2} (centerline), width 14 (7+7).
export const ROADS = [
  { id: 'boulevard', x1: -190, z1: 40, x2: 230, z2: 40 },   // Strand Boulevard (beach road)
  { id: 'strip', x1: 40, z1: -190, x2: 40, z2: 90 },        // Downtown strip (bank road)
  { id: 'market', x1: -210, z1: -60, x2: 10, z2: -60 },     // Old Pasaru market road
  { id: 'port', x1: -160, z1: -20, x2: -160, z2: 210 },     // Port Meridian road
  { id: 'hill', x1: 60, z1: -170, x2: 200, z2: -170 },      // Hillcrest road
  { id: 'cross1', x1: -40, z1: -170, x2: -40, z2: 60 },     // Downtown west cross
  { id: 'cross2', x1: 120, z1: -170, x2: 120, z2: 60 },     // Downtown east cross
  { id: 'cross3', x1: -160, z1: 20, x2: 200, z2: 20 },      // Midtown cross
  { id: 'cross4', x1: -160, z1: -140, x2: 200, z2: -140 },  // North cross
];

export const INTERSECTIONS = [
  [40, 40], [40, 20], [40, -60], [40, -140], [-40, 40], [-40, 20], [-40, -60],
  [120, 40], [120, -140], [-160, 20],
];

function roadLength(r) { return Math.hypot(r.x2 - r.x1, r.z2 - r.z1); }
function roadPoint(r, s) {
  const len = roadLength(r); const t = Math.max(0, Math.min(1, s / len));
  return { x: r.x1 + (r.x2 - r.x1) * t, z: r.z1 + (r.z2 - r.z1) * t, heading: Math.atan2(r.x2 - r.x1, r.z2 - r.z1) };
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    seed, time: 0,
    buildings: [], stalls: [], props: [], cars: [], peds: [], lights: [],
    palms: [], streetlamps: [], roadblocks: [],
    heli: { x: 60, z: 20, y: 55, angle: 0.6, radius: 90, speed: 0.12 },
    bank: { x: 40, z: -118, w: 26, h: 58, signY: 0.35 },
    player: null,
    stats: { buildings: 0, houses: 0, shops: 0, stalls: 0, props: 0, cars: 0, peds: 0, kpd: 0, bus: 0, lights: 0 },
  };

  // ---- Buildings: downtown towers first (skyline), then low houses/shops everywhere else.
  const towerSpots = [];
  for (let gx = -1; gx <= 2; gx++) for (let gz = 0; gz <= 3; gz++) {
    towerSpots.push([40 + gx * 42, -150 + gz * 34]);
  }
  for (const [bx, bz] of towerSpots) {
    // Towers never sit on a road: keep every street clear for traffic and sightlines.
    if (ROADS.some((r) => distToRoad(bx, bz, r) < 14)) continue;
    if (Math.abs(bx - 58) < 22 && Math.abs(bz + 118) < 22) continue; // keep the bank plot clear
    const h = rng.range(26, 68);
    world.buildings.push({ kind: 'tower', x: bx + rng.range(-4, 4), z: bz + rng.range(-4, 4),
      w: rng.range(18, 26), d: rng.range(18, 26), h, floors: Math.round(h / 3.4), tint: rng.pick([0x8a8f98, 0x9a8a72, 0x7a8898, 0xa89a80]) });
  }
  // The BANK tower: tall, warm stone, big yellow sign on its WEST face (facing the strip road),
  // set back from the road so the street stays clear.
  world.buildings.push({ kind: 'bank', x: 58, z: -118, w: 26, d: 24, h: 58, floors: 17, tint: 0xb08a4a, sign: 'BANK' });
  // Low houses + shops (1-2 floors, gable roofs) filling every district.
  const houseZones = [
    [-120, -60, 150, 90], [150, 40, 120, 80], [40, -90, 170, 120],
    [-160, 130, 130, 90], [120, -170, 130, 70], [-40, -140, 120, 80], [120, 20, 110, 70],
  ];
  let guard = 0;
  while (world.buildings.length < TUNING.buildingCount && guard++ < 4000) {
    const zone = rng.pick(houseZones);
    const x = zone[0] + rng.range(-zone[2] / 2, zone[2] / 2);
    const z = zone[1] + rng.range(-zone[3] / 2, zone[3] / 2);
    if (ROADS.some((r) => distToRoad(x, z, r) < 12)) continue;
    if (world.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < 16)) continue;
    const shop = rng.chance(0.42);
    world.buildings.push({ kind: shop ? 'shop' : 'house', x, z,
      w: rng.range(9, 15), d: rng.range(8, 13), h: shop ? rng.range(5, 7) : rng.range(4.5, 8),
      floors: shop ? 1 : rng.int(1, 2), tint: rng.pick([0xd8b08a, 0xc0d8d0, 0xe0c8a0, 0xb0c0e0, 0xd8a0a0, 0xa8c090]),
      sign: shop ? rng.pick(SHOP_SIGNS) : null, awning: shop ? rng.pick([0xe05a5a, 0x3c7ae0, 0x5ac06a, 0xe0c53c]) : 0 });
  }
  world.stats.buildings = world.buildings.length;
  world.stats.houses = world.buildings.filter((b) => b.kind === 'house').length;
  world.stats.shops = world.buildings.filter((b) => b.kind === 'shop').length;

  // ---- Night market stalls (Old Pasaru plaza) + props filling the ground.
  const plaza = { x: -120, z: -60 };
  for (let i = 0; i < TUNING.stallCount; i++) {
    const row = Math.floor(i / 5); const col = i % 5;
    world.stalls.push({ x: plaza.x - 34 + col * 17 + rng.range(-2, 2), z: plaza.z - 18 + row * 13 + rng.range(-2, 2),
      w: 7, d: 4, awning: rng.pick([0xe05a5a, 0x3c7ae0, 0xe0c53c, 0x5ac06a]), goods: rng.pick(['fish', 'fruit', 'cloth', 'spice']) });
  }
  for (let i = 0; i < TUNING.propCount; i++) {
    const kind = rng.pick(['crate', 'barrel', 'basket', 'planter']);
    world.props.push({ kind, x: plaza.x + rng.range(-46, 46), z: plaza.z + rng.range(-30, 34),
      s: rng.range(0.8, 1.6), rot: rng.range(0, Math.PI) });
  }
  // Fixed foreground props by the market-road camera corridor (no bare dirt in frame).
  // Both sides of the road near the camera: right (+z) and left (-z).
  for (const [x, z, kind] of [[-150, -40, 'crate'], [-138, -35, 'basket'], [-158, -32, 'barrel'], [-145, -48, 'crate'], [-135, -45, 'basket'], [-152, -28, 'planter'],
      [-152, -68, 'crate'], [-145, -69, 'basket'], [-158, -66, 'barrel']]) {
    world.props.push({ kind, x, z, s: 1.3, rot: 0.6 });
  }
  world.stats.stalls = world.stalls.length;
  world.stats.props = world.props.length;

  // ---- Traffic lights at intersections (cycle 12 s; offset picked so t = 2 s reads RED).
  INTERSECTIONS.slice(0, TUNING.trafficLightCount).forEach(([x, z], i) => {
    world.lights.push({ x: x + 9, z: z + 9, offset: 4 + (i % 7), cycle: TUNING.trafficLightCycle });
  });
  world.stats.lights = world.lights.length;

  // ---- Palms along the boulevard + streetlamps along main roads.
  for (let x = -170; x <= 210; x += 24) {
    world.palms.push({ x, z: 40 + (x % 48 === 0 ? 12 : -12), h: rng.range(7, 10) });
  }
  for (const r of ROADS) {
    const len = roadLength(r);
    for (let s = 20; s < len - 10; s += 46) {
      const p = roadPoint(r, s);
      world.streetlamps.push({ x: p.x + 9, z: p.z + 9 });
    }
  }

  // ---- Traffic: 42 cars on the roads (KPD cruisers, school bus, regular cars).
  const carTypes = ['kpd', 'kpd', 'kpd', 'kpd', 'bus', 'bus'];
  for (let i = 0; i < TUNING.trafficCount; i++) {
    const road = rng.pick(ROADS);
    const len = roadLength(road);
    const type = i < carTypes.length ? carTypes[i] : 'car';
    world.cars.push({ type, road: road.id, s: rng.range(0, len), lane: rng.pick([-3.4, 3.4]),
      speed: type === 'kpd' ? rng.range(13, 17) : type === 'bus' ? rng.range(8, 10) : rng.range(9, 14),
      color: type === 'kpd' ? 0x1a1a1e : type === 'bus' ? 0xe0b93c : rng.pick(CAR_COLORS),
      heading: 0, x: 0, z: 0 });
  }
  world.stats.cars = world.cars.length;
  world.stats.kpd = world.cars.filter((c) => c.type === 'kpd').length;
  world.stats.bus = world.cars.filter((c) => c.type === 'bus').length;

  // ---- Pedestrians: 204 — market crowd, sidewalk walkers, beach strollers.
  const pedSpots = [];
  for (let i = 0; i < 62; i++) pedSpots.push([plaza.x + rng.range(-44, 44), plaza.z + rng.range(-28, 32), 'market']);
  for (let i = 0; i < 118; i++) {
    const r = rng.pick(ROADS); const p = roadPoint(r, rng.range(0, roadLength(r)));
    pedSpots.push([p.x + rng.pick([-10.5, 10.5]), p.z + rng.pick([-10.5, 10.5]), 'walk']);
  }
  for (let i = 0; i < 24; i++) pedSpots.push([rng.range(185, 215), rng.range(-20, 110), 'beach']);
  for (const [x, z, mode] of pedSpots) {
    world.peds.push({ x, z, mode, heading: rng.range(0, Math.PI * 2), speed: rng.range(0.8, 1.8),
      shirt: rng.pick(SHIRT_COLORS), skin: rng.pick([0xe8b88a, 0xc88a5a, 0x8a5a3a, 0xf0c8a0]),
      phase: rng.range(0, Math.PI * 2), scale: rng.range(0.92, 1.08) });
  }
  world.stats.peds = world.peds.length;

  // ---- Player.
  world.player = {
    x: -120, z: -52, heading: Math.PI, speed: 0, onFoot: true,
    car: { name: 'RUKAN PELO GT', color: 0xe06a2a, condition: 100 },
    health: 100, armour: 50, money: 500, stars: 0, weapon: 0, radio: 0,
    mission: 0, missionProgress: 0, rank: 1, rp: 0,
  };
  return world;
}

export function distToRoad(x, z, r) {
  const dx = r.x2 - r.x1; const dz = r.z2 - r.z1;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((x - r.x1) * dx + (z - r.z1) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (r.x1 + dx * t), z - (r.z1 + dz * t));
}

export function trafficLightState(light, t) {
  const phase = (t + light.offset) % light.cycle;
  if (phase < 5) return 'green';
  if (phase < 6) return 'amber';
  return 'red';
}

export function districtAt(x, z) {
  let best = DISTRICTS[0]; let bd = Infinity;
  for (const d of DISTRICTS) { const dd = Math.hypot(d.center[0] - x, d.center[1] - z); if (dd < bd) { bd = dd; best = d; } }
  return best;
}

export function updateWorld(world, dt) {
  world.time += dt;
  const t = world.time;
  // Traffic flows along its road, wrapping at the ends.
  for (const car of world.cars) {
    const road = ROADS.find((r) => r.id === car.road);
    car.s += car.speed * dt;
    const len = roadLength(road);
    if (car.s > len) car.s -= len;
    const p = roadPoint(road, car.s);
    const nx = -(road.z2 - road.z1) / len; const nz = (road.x2 - road.x1) / len;
    car.x = p.x + nx * car.lane; car.z = p.z + nz * car.lane; car.heading = p.heading;
  }
  // Pedestrians stroll; market crowd drifts between stalls.
  for (const ped of world.peds) {
    if (ped.mode === 'market') {
      ped.heading += Math.sin(t * 0.3 + ped.phase) * dt * 0.4;
    } else {
      ped.heading += Math.sin(t * 0.2 + ped.phase) * dt * 0.15;
    }
    ped.x += Math.sin(ped.heading) * ped.speed * dt * 0.4;
    ped.z += Math.cos(ped.heading) * ped.speed * dt * 0.4;
    ped.phase += dt * ped.speed * 3.2;
  }
  // Heli orbits the player — unless a shot pinned it (world.heli.fixed), in
  // which case it stays where the staging put it.
  if (!world.heli.fixed) {
    world.heli.angle += world.heli.speed * dt;
    world.heli.x = world.player.x + Math.cos(world.heli.angle) * world.heli.radius;
    world.heli.z = world.player.z + Math.sin(world.heli.angle) * world.heli.radius;
  }
  // Wanted decays slowly when the player stays out of trouble.
  if (world.player.stars > 0 && Math.floor(t) % TUNING.wantedDecaySeconds === 0 && dt > 0) {
    world.player.stars = Math.max(0, world.player.stars - 0.02 * dt);
  }
}

// Deterministic fingerprint of the placed world (for the self-test).
export function hashWorld(world) {
  let h = 2166136261;
  const mix = (n) => { h ^= Math.round(n * 1000) & 0xffff; h = Math.imul(h, 16777619); };
  for (const b of world.buildings) { mix(b.x); mix(b.z); mix(b.h); }
  for (const c of world.cars) { mix(c.s); mix(c.speed); }
  for (const p of world.peds) { mix(p.x); mix(p.z); mix(p.shirt); }
  return (h >>> 0).toString(16);
}

export function missionById(id) { return MISSIONS.find((m) => m.id === id) || MISSIONS[0]; }
