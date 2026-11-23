// Azura Bay world: deterministic city data built from a seed.
// 5 districts, a street grid, the Old Pasaru night market, downtown with the
// BANK tower, Kumala Strand beach road and the sea. No Math.random anywhere.
import { makeRng, hashString } from './random.js';
import {
  SEED, COUNTS, DISTRICTS, SHOP_SIGNS, HOUSE_COLORS, SHOP_COLORS,
  TOWER_COLORS, SHIRT_COLORS, CAR_COLORS, HERO,
} from './config.js';

const AVENUES = [-160, -120, -80, -40, 0, 40, 80, 120, 160]; // roads along z
const STREETS = [-120, -80, -40, 0, 40, 80, 120]; // roads along x
const ROAD_W = 14;

function onRoad(x, z) {
  if (AVENUES.some((ax) => Math.abs(x - ax) < ROAD_W / 2 + 5)) return true;
  if (STREETS.some((sz) => Math.abs(z - sz) < ROAD_W / 2 + 5)) return true;
  return false;
}

function inMarket(x, z) {
  return x >= -152 && x <= -68 && z >= -42 && z <= 62;
}

function inBeach(x, z) {
  return z >= 138;
}

export function buildWorld(seed = SEED) {
  const rng = makeRng(seed);
  const world = {
    seed,
    districts: DISTRICTS,
    buildings: [],
    stalls: [],
    peds: [],
    cars: [],
    lights: [],
    props: [],
    palms: [],
    bank: null,
    heli: { x: 20, z: -40, y: 55, angle: 0, rotor: 0 },
    hero: { mode: 'foot', x: -110, z: 38, heading: Math.PI, speed: 0, carColor: HERO.carColor, carName: HERO.carName },
    time: 0,
  };

  // --- Towers (downtown skyline, BANK is the tallest) ---
  const towerSpots = [
    { x: 35, z: -75, h: 58, bank: true },
    { x: -8, z: -95, h: 44 },
    { x: 62, z: -58, h: 40 },
    { x: 88, z: -42, h: 36 },
    { x: -25, z: -60, h: 33 },
    { x: 78, z: -95, h: 47 },
  ];
  towerSpots.forEach((t, i) => {
    const b = {
      kind: 'tower', x: t.x, z: t.z, w: 22, d: 22, h: t.h,
      color: TOWER_COLORS[i % TOWER_COLORS.length],
      floors: Math.floor(t.h / 3.4), sign: t.bank ? 'BANK' : null,
    };
    world.buildings.push(b);
    if (t.bank) world.bank = b;
  });

  // --- Houses + shops on the blocks between streets ---
  // Block centres sit midway between avenues/streets (multiples of 40),
  // i.e. at -140, -100, -60, -20, 20, 60, 100, 140 — 4 plots per block.
  const candidates = [];
  for (let bx = -160; bx <= 120; bx += 40) {
    for (let bz = -120; bz <= 80; bz += 40) {
      const cx = bx + 20;
      const cz = bz + 20;
      for (const [ox, oz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
        const px = cx + ox;
        const pz = cz + oz;
        if (onRoad(px, pz) || inMarket(px, pz) || inBeach(px, pz)) continue;
        if (px > -30 && px < 95 && pz > -115 && pz < -25) continue; // downtown tower block
        candidates.push({ x: px, z: pz });
      }
    }
  }
  const shuffled = rng.shuffle(candidates);
  let houses = 0;
  let shops = 0;
  for (const c of shuffled) {
    if (houses >= COUNTS.gableHouses && shops >= COUNTS.shops) break;
    const isShop = shops < COUNTS.shops && (houses >= COUNTS.gableHouses || rng.chance(0.45));
    const w = rng.range(9, 15);
    const d = rng.range(8, 13);
    const h = isShop ? rng.range(5, 8) : rng.range(5, 9.5);
    const b = {
      kind: isShop ? 'shop' : 'house',
      x: c.x + rng.range(-4, 4), z: c.z + rng.range(-4, 4),
      w, d, h,
      color: isShop ? rng.pick(SHOP_COLORS) : rng.pick(HOUSE_COLORS),
      sign: isShop ? rng.pick(SHOP_SIGNS) : null,
      awning: isShop ? rng.pick([0xd9382b, 0x2b7ad9, 0xe8d02b, 0x2bd95f, 0xe87ab0]) : null,
      rot: rng.pick([0, Math.PI / 2]),
    };
    world.buildings.push(b);
    if (isShop) shops += 1; else houses += 1;
  }

  // --- Market stalls: two rows down the Pasaru aisle (aisle runs along z at x=-110) ---
  const awningStripes = [0xd9382b, 0x2b7ad9, 0xe8d02b, 0x2bd95f, 0xe87ab0, 0x2bd9c9];
  for (let i = 0; i < COUNTS.stalls; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    world.stalls.push({
      x: -110 + side * 7.5,
      z: 46 - row * 9.5,
      w: 5.5, d: 4.5, h: 3.2,
      awning: awningStripes[i % awningStripes.length],
      goods: rng.pick([0xe88a2b, 0x5ab87a, 0xd95f4b, 0xe8d02b, 0x4ba3d9]),
      sign: rng.pick(SHOP_SIGNS),
    });
  }

  // --- Pedestrians: 204. The first 18 are the market crowd (staged by shots). ---
  for (let i = 0; i < COUNTS.pedestrians; i++) {
    let x;
    let z;
    let axis;
    let min;
    let max;
    if (i < 18) {
      // market aisle crowd, z from 44 down to -28
      x = -110 + rng.range(-3.5, 3.5);
      z = 44 - i * 4.2;
      axis = 'z'; min = -30; max = 50;
    } else {
      // sidewalk walkers across the city
      const av = rng.pick(AVENUES);
      const st = rng.pick(STREETS);
      if (rng.chance(0.5)) {
        axis = 'z';
        x = av + rng.pick([-1, 1]) * (ROAD_W / 2 + 2.5);
        z = rng.range(-140, 130);
        min = -140; max = 130;
      } else {
        axis = 'x';
        z = st + rng.pick([-1, 1]) * (ROAD_W / 2 + 2.5);
        x = rng.range(-180, 180);
        min = -180; max = 180;
      }
    }
    world.peds.push({
      x, z, axis, min, max,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(0.8, 1.8),
      shirt: rng.pick(SHIRT_COLORS),
      skin: rng.pick([0xe8c090, 0xc98a5a, 0x8a5a3a, 0xf0d0b0]),
      phase: rng.range(0, Math.PI * 2),
      hero: i === 0,
    });
  }
  // Hero ped is the first market ped, red shirt, center aisle.
  world.peds[0].shirt = HERO.shirt;
  world.peds[0].x = -110;
  world.peds[0].z = 38;

  // --- Traffic: 42 cars + 4 KPD cruisers + 2 school buses on the roads ---
  const carKinds = [];
  for (let i = 0; i < COUNTS.trafficCars; i++) carKinds.push('traffic');
  for (let i = 0; i < COUNTS.kpdCruisers; i++) carKinds.push('kpd');
  for (let i = 0; i < COUNTS.schoolBuses; i++) carKinds.push('bus');
  carKinds.forEach((kind, i) => {
    const alongZ = rng.chance(0.5);
    const road = alongZ ? rng.pick(AVENUES) : rng.pick(STREETS);
    const pos = rng.range(-170, 170);
    world.cars.push({
      kind,
      road, pos,
      alongZ,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: kind === 'bus' ? rng.range(6, 9) : kind === 'kpd' ? rng.range(13, 17) : rng.range(8, 14),
      color: kind === 'kpd' ? 0xf0f0f0 : kind === 'bus' ? 0xe8c01a : rng.pick(CAR_COLORS),
      lane: rng.pick([-1, 1]) * 3.5,
    });
  });

  // --- Traffic lights at 10 intersections, red at shot time ---
  const lightSpots = [
    [-40, -40], [0, -40], [40, -40], [-40, 0], [0, 0],
    [40, 0], [-40, 40], [0, 40], [40, 40], [0, -80],
  ];
  lightSpots.forEach(([x, z], i) => {
    world.lights.push({ x: x + 9, z: z + 9, state: 'red', phase: i * 0.7 });
  });

  // --- Props: crates, barrels, baskets, planters. 9 fixed in the market foreground. ---
  const propKinds = ['crate', 'barrel', 'basket', 'planter'];
  for (let i = 0; i < COUNTS.props; i++) {
    let x;
    let z;
    if (i < 9) {
      // fixed foreground cluster at the south end of the market aisle (fills the cover frame)
      const spots = [
        [-119, 50], [-115, 52], [-103, 51], [-100, 48], [-118, 46],
        [-104, 46], [-112, 48], [-120, 44], [-101, 44],
      ];
      [x, z] = spots[i];
    } else if (i < 29) {
      x = -110 + rng.range(-14, 14);
      z = rng.range(-30, 55);
    } else if (i < 49) {
      x = rng.range(-30, 60);
      z = rng.pick([-40, 0, 40]) + rng.pick([-1, 1]) * (ROAD_W / 2 + 2.5);
    } else {
      x = rng.range(-60, 140);
      z = 130 + rng.pick([-1, 1]) * (ROAD_W / 2 + 3);
    }
    world.props.push({
      kind: propKinds[i % propKinds.length],
      x, z,
      s: i < 9 ? rng.range(0.7, 1.0) : rng.range(0.8, 1.4),
      color: rng.pick([0x8a6b3a, 0x6b5a3a, 0x9a7a4a, 0x5a8a4a, 0xb87a3a]),
    });
  }

  // --- Palms: beach road, market edge, harbor ---
  for (let i = 0; i < COUNTS.palms; i++) {
    let x;
    let z;
    if (i < 26) {
      x = -170 + i * 13.5;
      z = 130 + (i % 2 === 0 ? -11 : 11);
    } else if (i < 36) {
      x = -158 + (i % 2) * 96;
      z = -30 + (i - 26) * 9;
    } else {
      x = rng.range(-140, -60);
      z = rng.range(110, 135);
    }
    world.palms.push({ x, z, h: rng.range(7, 11), lean: rng.range(-0.12, 0.12) });
  }

  return world;
}

export function worldHash(world) {
  const parts = [
    world.seed,
    world.buildings.length,
    world.stalls.length,
    world.peds.length,
    world.cars.length,
    world.lights.length,
    world.props.length,
    world.palms.length,
    world.bank ? `${world.bank.x},${world.bank.z},${world.bank.h}` : 'nobank',
    world.buildings.slice(0, 5).map((b) => `${b.x.toFixed(1)},${b.z.toFixed(1)},${b.h.toFixed(1)}`).join('|'),
  ];
  return hashString(parts.join(';'));
}

export function stepWorld(world, dt) {
  world.time += dt;
  for (const p of world.peds) {
    const d = p.dir * p.speed * dt;
    if (p.axis === 'z') {
      p.z += d;
      if (p.z > p.max) { p.z = p.max; p.dir = -1; }
      if (p.z < p.min) { p.z = p.min; p.dir = 1; }
    } else {
      p.x += d;
      if (p.x > p.max) { p.x = p.max; p.dir = -1; }
      if (p.x < p.min) { p.x = p.min; p.dir = 1; }
    }
    p.phase += dt * p.speed * 2.2;
  }
  for (const c of world.cars) {
    c.pos += c.dir * c.speed * dt;
    if (c.pos > 175) { c.pos = 175; c.dir = -1; }
    if (c.pos < -175) { c.pos = -175; c.dir = 1; }
  }
  world.heli.angle += dt * 0.12;
  world.heli.rotor += dt * 22;
  for (const l of world.lights) {
    const t = (world.time + l.phase * 7) % 21;
    l.state = t < 8 ? 'red' : t < 10 ? 'amber' : 'green';
  }
}

// Deterministic per-shot staging: repositions a fixed set of peds, cars and the
// heli so the graded frames are crowded and readable. No RNG — same every run.
export function stageShot(world, shotId) {
  // Reset lights to red for every shot (the brief: red at shot time).
  for (const l of world.lights) l.state = 'red';

  if (shotId === 'cover') {
    // 18 market peds already along the aisle; tighten them into the frame:
    // hero close to camera, browsers at stalls, no gaps in the aisle.
    world.peds.slice(0, 18).forEach((p, i) => {
      p.axis = 'z';
      p.x = -110 + [-2.5, 1.5, -1, 2.5, 0, -3, 2, -0.5, 3, -2, 1, -3.5, 2.5, 0.5, -1.5, 3.5, -2.5, 1][i];
      p.z = 46 - i * 4.1;
      p.dir = i % 2 === 0 ? 1 : -1;
    });
    world.peds[0].x = -110;
    world.peds[0].z = 48;
    world.peds[0].shirt = HERO.shirt;
    world.hero = { mode: 'foot', x: -110, z: 48, heading: Math.PI, speed: 0, carColor: HERO.carColor, carName: HERO.carName };
  }

  if (shotId === 'city') {
    // Beach chase: 12 cars ahead on Strand Blvd (z=130), KPD in pursuit,
    // bus ahead, heli top-left with cone.
    const beachCars = world.cars.filter((c) => c.kind !== 'bus').slice(0, 10);
    const bus = world.cars.find((c) => c.kind === 'bus');
    const kpd = world.cars.filter((c) => c.kind === 'kpd').slice(0, 3);
    beachCars.forEach((c, i) => {
      c.alongZ = false; c.road = 130; c.dir = 1; c.lane = (i % 2 === 0 ? -3.5 : 3.5);
      c.pos = 18 + i * 9;
    });
    kpd.forEach((c, i) => {
      c.alongZ = false; c.road = 130; c.dir = 1; c.lane = i % 2 === 0 ? -3.5 : 3.5;
      c.pos = 4 + i * 7;
    });
    if (bus) { bus.alongZ = false; bus.road = 130; bus.dir = 1; bus.lane = 3.5; bus.pos = 72; }
    world.heli = { x: 30, z: 138, y: 20, angle: 0.4, rotor: 0.8 };
    world.hero = { mode: 'car', x: 0, z: 130, heading: Math.PI / 2, speed: 31, carColor: 0xd9382b, carName: 'RUKAN PELO GT' };
  }

  if (shotId === 'mission') {
    // Bank job: parked cars filling BOTH near-foreground sides of the avenue,
    // moving traffic ahead, KPD ahead, hero coupe bright orange and fully
    // visible above the dialogue box.
    const parked = world.cars.slice(0, 10);
    parked.forEach((c, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      c.alongZ = true; c.road = 0; c.dir = 1; c.lane = side * 9.5;
      c.pos = -14 - row * 10;
      c.speed = 0;
    });
    const movers = world.cars.slice(10, 16);
    movers.forEach((c, i) => {
      c.alongZ = true; c.road = 0; c.dir = -1; c.lane = (i % 2 === 0 ? -3.5 : 3.5);
      c.pos = -48 - i * 8; c.speed = 9;
    });
    const kpd = world.cars.find((c) => c.kind === 'kpd');
    if (kpd) { kpd.alongZ = true; kpd.road = 0; kpd.dir = -1; kpd.lane = -3.5; kpd.pos = -62; kpd.speed = 12; }
    // Sidewalk peds flanking the avenue near the camera.
    world.peds.slice(18, 30).forEach((p, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      p.axis = 'z';
      p.x = side * 10.5;
      p.z = -8 - Math.floor(i / 2) * 7;
    });
    world.hero = { mode: 'car', x: 0, z: -2, heading: Math.PI, speed: 8, carColor: HERO.carColor, carName: HERO.carName };
  }

  if (shotId === 'night') {
    // Night heli: hero on foot on the centerline, KPD + parked cars flanking,
    // peds on sidewalks, heli cone down the road, BANK through the cone.
    const parked = world.cars.slice(0, 6);
    parked.forEach((c, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      c.alongZ = true; c.road = 0; c.dir = 1; c.lane = side * 9.5;
      c.pos = -14 - row * 13;
      c.speed = 0;
    });
    const kpd = world.cars.find((c) => c.kind === 'kpd');
    if (kpd) { kpd.alongZ = true; kpd.road = 0; kpd.dir = -1; kpd.lane = 0; kpd.pos = -34; kpd.speed = 0; }
    world.peds.slice(18, 28).forEach((p, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      p.axis = 'z';
      p.x = side * 10.5;
      p.z = -4 - Math.floor(i / 2) * 8;
    });
    world.heli = { x: 4, z: -34, y: 32, angle: 0.2, rotor: 1.7 };
    world.hero = { mode: 'foot', x: 0, z: -6, heading: Math.PI, speed: 0, carColor: HERO.carColor, carName: HERO.carName };
    world.peds[0].x = 0;
    world.peds[0].z = -6;
    world.peds[0].shirt = HERO.shirt;
  }
}
