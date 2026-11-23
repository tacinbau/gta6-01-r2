// The game's rules and state, with no drawing and no browser in it: the island city, its
// traffic and pedestrians, the player on foot and in cars, the wanted level, the garage and
// the save. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns, except the short-lived objective marker objects.
import {
  BANK, CARS, CASINO, DISTRICTS, FIXER, GARAGE, HEAT, MARINA_BASIN, ROADS_X, ROADS_Y, ROAD_W,
  ROOF_COLORS, SAFEHOUSE, SAND, SAVE_KEY, TREE_COLORS, UPGRADES, WORLD, districtAt,
} from './config.js';
import { randInt, randPick } from './random.js';
import { updateMission } from './missions.js';
import { updatePolice } from './police.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_WIN = 8;
export const EVENT_CRASH = 16;
export const EVENT_SHOT = 32;

const TRAFFIC_COUNT = 26;
const PED_COUNT = 34;

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRect(cx, cy, r, bx, by, bw, bh) {
  const nx = Math.max(bx, Math.min(cx, bx + bw));
  const ny = Math.max(by, Math.min(cy, by + bh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function createWorld(random) {
  // ---- the city, built once from the seeded stream ----
  const buildings = [];
  const palms = [];
  const parkedSpots = [];
  const groundPatches = [];
  const speckles = [];
  const sandSpeckles = [];
  const waves = [];
  const parks = [];
  const plaza = { x: 1260, y: 1160, w: 280, h: 280, benches: [], trees: [] };
  const roundabout = { x: 1900, y: 850, r: 72 };
  const streetlights = [];
  const signs = [];
  const boats = [];

  function onRoad(x, y, margin) {
    for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2 + margin) return true;
    for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2 + margin) return true;
    return false;
  }

  /** One building: a footprint of one to three rects (a slab, an L or a U around a
   * courtyard — never just a box), a varied roof colour, and rooftop clutter. */
  function makeBuilding(x, y, w, h) {
    const roll = random();
    let parts;
    if (roll < 0.55) {
      parts = [{ x, y, w, h }];
    } else if (roll < 0.8) {
      // L-shape: a top bar and one leg, with a courtyard notch at the other corner.
      const barH = h * (0.45 + random() * 0.15);
      const legW = w * (0.4 + random() * 0.15);
      if (random() < 0.5) parts = [{ x, y, w, h: barH }, { x, y: y + barH, w: legW, h: h - barH }];
      else parts = [{ x, y, w, h: barH }, { x: x + w - legW, y: y + barH, w: legW, h: h - barH }];
    } else {
      // U-shape: a top bar and two legs around a courtyard.
      const barH = h * (0.35 + random() * 0.1);
      const legW = w * (0.3 + random() * 0.08);
      parts = [
        { x, y, w, h: barH },
        { x, y: y + barH, w: legW, h: h - barH },
        { x: x + w - legW, y: y + barH, w: legW, h: h - barH },
      ];
    }
    // Rooftop clutter on the biggest part: AC units, vents, skylights.
    let big = parts[0];
    for (const part of parts) if (part.w * part.h > big.w * big.h) big = part;
    const features = [];
    const count = 2 + Math.floor(random() * 4);
    for (let i = 0; i < count; i += 1) {
      const kind = random();
      const fw = 8 + random() * 8;
      const fh = 7 + random() * 7;
      const fx = big.x + 12 + random() * Math.max(1, big.w - 24 - fw);
      const fy = big.y + 12 + random() * Math.max(1, big.h - 24 - fh);
      features.push({ type: kind < 0.45 ? 'ac' : kind < 0.75 ? 'vent' : 'skylight', x: fx, y: fy, w: fw, h: fh });
    }
    return {
      x, y, w, h, parts, features,
      roof: randPick(random, ROOF_COLORS),
      district: districtAt(x + w / 2, y + h / 2).id,
    };
  }

  function buildCity() {
    buildings.length = 0;
    palms.length = 0;
    parkedSpots.length = 0;
    groundPatches.length = 0;
    speckles.length = 0;
    sandSpeckles.length = 0;
    waves.length = 0;
    parks.length = 0;
    streetlights.length = 0;
    signs.length = 0;
    boats.length = 0;
    // Two blocks are parks, not buildings: the Docks green and the Marina green.
    const parkBlocks = [[0, 4], [5, 0]];
    // One pass per block: a block is the rectangle between two neighbouring roads.
    const xs = [0, ...ROADS_X, WORLD.width];
    const ys = [0, ...ROADS_Y, WORLD.height];
    for (let bx = 0; bx < xs.length - 1; bx += 1) {
      for (let by = 0; by < ys.length - 1; by += 1) {
        const x0 = xs[bx] + ROAD_W / 2 + 24;
        const x1 = xs[bx + 1] - ROAD_W / 2 - 24;
        const y0 = ys[by] + ROAD_W / 2 + 24;
        const y1 = ys[by + 1] - ROAD_W / 2 - 24;
        if (x1 - x0 < 90 || y1 - y0 < 90) continue;
        const isPark = parkBlocks.some(([px, py]) => px === bx && py === by);
        if (isPark) {
          // A green with crossing paths, varied trees and bushes — no buildings.
          const park = {
            x0, y0, x1, y1,
            paths: [
              { x: x0, y: (y0 + y1) / 2 - 9, w: x1 - x0, h: 18 },
              { x: (x0 + x1) / 2 - 9, y: y0, w: 18, h: y1 - y0 },
            ],
            trees: [], bushes: [],
          };
          for (let i = 0; i < 8; i += 1) {
            park.trees.push({
              x: x0 + 30 + random() * (x1 - x0 - 60),
              y: y0 + 30 + random() * (y1 - y0 - 60),
              r: 13 + random() * 11,
              color: randPick(random, TREE_COLORS),
            });
          }
          for (let i = 0; i < 6; i += 1) {
            park.bushes.push({
              x: x0 + 20 + random() * (x1 - x0 - 40),
              y: y0 + 20 + random() * (y1 - y0 - 40),
              r: 6 + random() * 5,
            });
          }
          parks.push(park);
          continue;
        }
        const cols = Math.max(1, Math.floor((x1 - x0) / 150));
        const rows = Math.max(1, Math.floor((y1 - y0) / 150));
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            if (random() < 0.12) continue;
            const w = 90 + random() * 70;
            const h = 80 + random() * 60;
            const x = x0 + c * ((x1 - x0) / cols) + ((x1 - x0) / cols - w) / 2;
            const y = y0 + r * ((y1 - y0) / rows) + ((y1 - y0) / rows - h) / 2;
            if (rectsOverlap(x, y, w, h, MARINA_BASIN.x - 10, MARINA_BASIN.y - 10, MARINA_BASIN.w + 20, MARINA_BASIN.h + 20)) continue;
            buildings.push(makeBuilding(x, y, w, h));
          }
        }
      }
    }
    // Top-up: the self-test needs more than 50 buildings, and the block pass alone can fall
    // short on some seeds. Place one jittered building per slot of every block until 75.
    const slots = [];
    for (let gx = 200; gx < WORLD.width - 200; gx += 220) {
      for (let gy = 200; gy < WORLD.height - 200; gy += 220) slots.push([gx, gy]);
    }
    let pass = 0;
    while (buildings.length < 75 && pass < 5) {
      for (const [sx, sy] of slots) {
        if (buildings.length >= 75) break;
        const x = sx + (random() - 0.5) * 120;
        const y = sy + (random() - 0.5) * 120;
        const w = 80 + random() * 60;
        const h = 70 + random() * 50;
        if (onRoad(x + w / 2, y + h / 2, 90)) continue;
        if (rectsOverlap(x, y, w, h, MARINA_BASIN.x - 10, MARINA_BASIN.y - 10, MARINA_BASIN.w + 20, MARINA_BASIN.h + 20)) continue;
        let clash = false;
        for (const b of buildings) {
          if (rectsOverlap(x - 20, y - 20, w + 40, h + 40, b.x, b.y, b.w, b.h)) { clash = true; break; }
        }
        if (!clash) buildings.push(makeBuilding(x, y, w, h));
      }
      pass += 1;
    }
    // Trees and bushes: palms, round canopies and dark shrubs, all varied.
    for (let i = 0; i < 90; i += 1) {
      const x = 100 + random() * (WORLD.width - 200);
      const y = 100 + random() * (WORLD.height - 200);
      if (onRoad(x, y, 40)) continue;
      let clash = false;
      for (const b of buildings) if (circleRect(x, y, 26, b.x, b.y, b.w, b.h)) { clash = true; break; }
      if (rectsOverlap(x - 20, y - 20, 40, 40, MARINA_BASIN.x, MARINA_BASIN.y, MARINA_BASIN.w, MARINA_BASIN.h)) clash = true;
      if (!clash) {
        const roll = random();
        palms.push({
          x, y, r: 12 + random() * 8,
          kind: roll < 0.4 ? 'palm' : roll < 0.85 ? 'round' : 'bush',
          color: randPick(random, TREE_COLORS),
        });
      }
    }
    // The plaza's benches and corner trees.
    plaza.benches = [
      { x: plaza.x + 20, y: plaza.y + 20, w: 40, h: 10 },
      { x: plaza.x + plaza.w - 60, y: plaza.y + 20, w: 40, h: 10 },
      { x: plaza.x + 20, y: plaza.y + plaza.h - 30, w: 40, h: 10 },
      { x: plaza.x + plaza.w - 60, y: plaza.y + plaza.h - 30, w: 40, h: 10 },
    ];
    plaza.trees = [
      { x: plaza.x + 36, y: plaza.y + 52, r: 14, color: '#4a8a44' },
      { x: plaza.x + plaza.w - 36, y: plaza.y + 52, r: 14, color: '#3f7a3a' },
      { x: plaza.x + 36, y: plaza.y + plaza.h - 52, r: 14, color: '#5a9a4a' },
      { x: plaza.x + plaza.w - 36, y: plaza.y + plaza.h - 52, r: 14, color: '#4a8a44' },
    ];
    // Streetlights along every road, alternating sides.
    for (const rx of ROADS_X) {
      for (let y = 260; y < WORLD.height - 200; y += 320) {
        const side = Math.floor(y / 320) % 2 === 0 ? 1 : -1;
        streetlights.push({ x: rx + side * (ROAD_W / 2 + 18), y });
      }
    }
    for (const ry of ROADS_Y) {
      for (let x = 260; x < WORLD.width - 200; x += 320) {
        const side = Math.floor(x / 320) % 2 === 0 ? 1 : -1;
        streetlights.push({ x, y: ry + side * (ROAD_W / 2 + 18) });
      }
    }
    // Signposts at a few intersections.
    for (const [sx, sy, color] of [
      [400, 400, '#e5534b'], [900, 850, '#4f7ec9'], [1400, 400, '#f2c94c'],
      [1900, 1300, '#e5534b'], [2400, 1750, '#4f7ec9'], [2900, 2200, '#f2c94c'],
      [900, 1750, '#7ac94f'], [2400, 400, '#e5534b'],
    ]) {
      signs.push({ x: sx + 78, y: sy + 78, color });
    }
    // Two wooden docks jut into the basin from its west edge; boats moor alongside.
    for (const dy of [1470, 1600]) {
      boats.push({ x: 2980, y: dy, angle: 0, len: 110, color: '#7a5a3a', dock: true });
    }
    const boatColors = ['#e8e0d0', '#c9d8e8', '#e8c9c9', '#d8e8c9'];
    for (let i = 0; i < 4; i += 1) {
      boats.push({
        x: 3050, y: [1445, 1500, 1575, 1630][i],
        angle: 0, len: 52 + random() * 14, color: boatColors[i % boatColors.length], dock: false,
      });
    }
    boats.push({ x: 3140, y: 1550, angle: 0.4, len: 58, color: '#e8e0d0', dock: false });
    // Ground texture: dry patches and grass speckles, never one flat fill.
    const patchColors = ['#7fae6a', '#5d8a4e', '#8aba76', '#a8a06a', '#6a9a55'];
    for (let i = 0; i < 50; i += 1) {
      groundPatches.push({
        x: 180 + random() * (WORLD.width - 360),
        y: 180 + random() * (WORLD.height - 360),
        rx: 60 + random() * 160, ry: 40 + random() * 110,
        color: randPick(random, patchColors),
      });
    }
    const speckleColors = ['#5d8a4e', '#8aba76', '#6a9a55'];
    for (let i = 0; i < 400; i += 1) {
      speckles.push({
        x: 160 + random() * (WORLD.width - 320),
        y: 160 + random() * (WORLD.height - 320),
        color: randPick(random, speckleColors),
      });
    }
    // Sand speckles live in the rim band between the water and the grass.
    for (let i = 0; i < 150; i += 1) {
      const edge = Math.floor(random() * 4);
      let x;
      let y;
      if (edge === 0) { x = 60 + random() * (WORLD.width - 120); y = 60 + random() * 80; }
      else if (edge === 1) { x = 60 + random() * (WORLD.width - 120); y = WORLD.height - 140 + random() * 80; }
      else if (edge === 2) { x = 60 + random() * 80; y = 60 + random() * (WORLD.height - 120); }
      else { x = WORLD.width - 140 + random() * 80; y = 60 + random() * (WORLD.height - 120); }
      sandSpeckles.push({ x, y, color: random() < 0.5 ? '#c9b078' : '#ecdcab' });
    }
    // Gentle wave arcs along the water's edge, just off the sand.
    for (let x = 120; x < WORLD.width - 60; x += 190) waves.push({ x, y: 34, r: 22 });
    for (let x = 120; x < WORLD.width - 60; x += 190) waves.push({ x, y: WORLD.height - 34, r: 22 });
    for (let y = 120; y < WORLD.height - 60; y += 190) waves.push({ x: 34, y, r: 22 });
    for (let y = 120; y < WORLD.height - 60; y += 190) waves.push({ x: WORLD.width - 34, y, r: 22 });
    // Parked cars along the avenues, and the garage's own row.
    for (let i = 0; i < 14; i += 1) {
      const rx = randPick(random, ROADS_X);
      const ry = 200 + random() * (WORLD.height - 400);
      parkedSpots.push({ x: rx + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 26), y: ry, angle: random() < 0.5 ? 0 : Math.PI });
    }
  }

  buildCity();

  // ---- entities ----
  const state = {
    time: 0,
    timeOfDay: 0, // 0 day, 1 dusk, 2 night
    cash: 500,
    missionIndex: 0,
    missionsDone: 0,
    standing: { downtown: 0, oldtown: 0, hills: 0, docks: 0, marina: 0 },
    crew: { rook: false, vera: false },
    ownedCars: ['corto'],
    upgrades: { corto: { engine: 0, tires: 0, armor: 0 } },
    player: { x: FIXER.x + 60, y: FIXER.y + 40, angle: 0, health: 100, inCar: null, speed: 0, wasDriving: false, hurtTimer: 0 },
    weapon: 0,
    ammo: [Infinity, 120, 240],
    fireTimer: 0,
    aimAngle: 0,
    heat: 0,
    heatSeenTimer: 0,
    cars: [],
    peds: [],
    cruisers: [],
    roadblocks: [],
    heli: null,
    ghost: null,
    convoy: [],
    mission: null,
    objective: null,
    banner: '',
    bannerTimer: 0,
    won: false,
    over: false,
    radioMuted: false,
  };

  function carSpec(car) {
    const def = CARS.find((c) => c.id === car.def) || CARS[0];
    const up = state.upgrades[car.def] || { engine: 0, tires: 0, armor: 0 };
    let top = def.top * (1 + up.engine * UPGRADES.engine.topBonus);
    if (state.crew.rook) top *= 1.12;
    return {
      top,
      accel: def.accel,
      grip: def.grip * (1 + up.tires * UPGRADES.tires.gripBonus),
      maxHealth: def.health + up.armor * UPGRADES.armor.healthBonus,
      color: def.color,
      name: def.name,
    };
  }

  function spawnTraffic() {
    state.cars.length = 0;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? randPick(random, ROADS_X) : randPick(random, ROADS_Y);
      const dir = random() < 0.5 ? -1 : 1;
      const speed = 90 + random() * 70;
      state.cars.push({
        kind: 'traffic',
        def: null,
        x: vertical ? road + (dir > 0 ? 26 : -26) : 120 + random() * (WORLD.width - 240),
        y: vertical ? 120 + random() * (WORLD.height - 240) : road + (dir > 0 ? 26 : -26),
        angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        speed,
        baseSpeed: speed,
        road: vertical ? 'v' : 'h',
        roadAt: road,
        dir,
        health: 60,
        color: randPick(random, ['#b8b0a0', '#5a6a7a', '#7a4a4a', '#4a6a5a', '#8a8a7a']),
      });
    }
    for (const spot of parkedSpots) {
      state.cars.push({
        kind: 'parked', def: null, x: spot.x, y: spot.y, angle: spot.angle, speed: 0, baseSpeed: 0,
        road: null, roadAt: 0, dir: 0, health: 120,
        color: randPick(random, ['#b8b0a0', '#5a6a7a', '#7a4a4a', '#4a6a5a']),
      });
    }
    // The garage row: the player's owned cars, parked by the garage.
    state.ownedCars.forEach((defId, i) => {
      const def = CARS.find((c) => c.id === defId);
      state.cars.push({
        kind: 'garage', def: defId, x: GARAGE.x - 140 + i * 90, y: GARAGE.y + 120, angle: -Math.PI / 2,
        speed: 0, baseSpeed: 0, road: null, roadAt: 0, dir: 0, health: def.health,
        color: def.color,
      });
    });
  }

  function spawnPeds() {
    state.peds.length = 0;
    for (let i = 0; i < PED_COUNT; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? randPick(random, ROADS_X) : randPick(random, ROADS_Y);
      const off = (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 26);
      state.peds.push({
        x: vertical ? road + off : 120 + random() * (WORLD.width - 240),
        y: vertical ? 120 + random() * (WORLD.height - 240) : road + off,
        angle: vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI),
        speed: 26 + random() * 22,
        panic: 0,
        color: randPick(random, ['#d8b48a', '#8ab4d8', '#d88a8a', '#a0d8a0', '#d8d8a0']),
      });
    }
  }

  function reset() {
    state.time = 0;
    state.timeOfDay = 0;
    state.cash = 500;
    state.missionIndex = 0;
    state.missionsDone = 0;
    state.standing = { downtown: 0, oldtown: 0, hills: 0, docks: 0, marina: 0 };
    state.crew = { rook: false, vera: false };
    state.ownedCars = ['corto'];
    state.upgrades = { corto: { engine: 0, tires: 0, armor: 0 } };
    state.player.x = FIXER.x + 60;
    state.player.y = FIXER.y + 40;
    state.player.angle = 0;
    state.player.health = 100;
    state.player.inCar = null;
    state.player.speed = 0;
    state.weapon = 0;
    state.ammo = [Infinity, 120, 240];
    state.fireTimer = 0;
    state.heat = 0;
    state.heatSeenTimer = 0;
    state.cruisers = [];
    state.roadblocks = [];
    state.heli = null;
    state.ghost = null;
    state.convoy = [];
    state.mission = null;
    state.objective = null;
    state.banner = '';
    state.bannerTimer = 0;
    state.won = false;
    state.over = false;
    spawnTraffic();
    spawnPeds();
  }

  function addHeat(amount) {
    state.heat = Math.min(100, state.heat + amount);
  }

  function stars() {
    return Math.min(5, Math.floor(state.heat / HEAT.perStar));
  }

  function hitsBuilding(x, y, r) {
    for (const b of buildings) {
      for (const part of b.parts) {
        if (circleRect(x, y, r, part.x - 4, part.y - 4, part.w + 8, part.h + 8)) return b;
      }
    }
    // The marina basin is water: nothing drives or walks into it.
    if (circleRect(x, y, r, MARINA_BASIN.x, MARINA_BASIN.y, MARINA_BASIN.w, MARINA_BASIN.h)) {
      return { x: MARINA_BASIN.x, y: MARINA_BASIN.y, w: MARINA_BASIN.w, h: MARINA_BASIN.h };
    }
    return null;
  }

  function nearestCar(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      if (kinds && !kinds.includes(car.kind)) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function damageCar(car, amount) {
    car.health -= amount;
    if (car.health <= 0 && car.kind === 'traffic') {
      car.kind = 'wreck';
      car.speed = 0;
    }
    return car.health <= 0;
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    const axes = input.axes;
    if (p.inCar) {
      const spec = carSpec(p.inCar);
      const fwd = { x: Math.cos(p.angle), y: Math.sin(p.angle) };
      const throttle = -axes.y; // W is up: forward
      if (throttle > 0) p.speed += spec.accel * dt;
      else if (throttle < 0) p.speed -= spec.accel * 0.9 * dt;
      else p.speed *= Math.max(0, 1 - 0.6 * dt);
      if (Math.abs(p.speed) > spec.top) p.speed = Math.sign(p.speed) * spec.top;
      if (Math.abs(p.speed) > 8) {
        p.angle += axes.x * spec.grip * dt * Math.min(1, Math.abs(p.speed) / 160) * Math.sign(p.speed);
      }
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!hitsBuilding(nx, p.y, 20)) p.x = nx;
      else { p.speed *= -0.25; }
      if (!hitsBuilding(p.x, ny, 20)) p.y = ny;
      else { p.speed *= -0.25; }
      p.x = Math.max(SAND, Math.min(WORLD.width - SAND, p.x));
      p.y = Math.max(SAND, Math.min(WORLD.height - SAND, p.y));
      p.inCar.x = p.x;
      p.inCar.y = p.y;
      p.inCar.angle = p.angle;
      p.inCar.speed = p.speed;
      p.wasDriving = true;
    } else {
      const len = Math.hypot(axes.x, axes.y);
      if (len > 0) {
        const nx = p.x + (axes.x / len) * 230 * dt;
        const ny = p.y + (axes.y / len) * 230 * dt;
        if (!hitsBuilding(nx, p.y, 14)) p.x = nx;
        if (!hitsBuilding(p.x, ny, 14)) p.y = ny;
        p.angle = Math.atan2(axes.y, axes.x);
        p.speed = 230;
      } else {
        p.speed = 0;
      }
      p.x = Math.max(SAND, Math.min(WORLD.width - SAND, p.x));
      p.y = Math.max(SAND, Math.min(WORLD.height - SAND, p.y));
      p.wasDriving = false;
    }
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
      car.x += fwd.x * car.speed * dt;
      car.y += fwd.y * car.speed * dt;
      if (car.road === 'v') {
        if (car.y < 60 || car.y > WORLD.height - 60) {
          car.dir *= -1;
          car.angle += Math.PI;
          car.y = Math.max(60, Math.min(WORLD.height - 60, car.y));
        }
      } else if (car.y < 60 || car.y > WORLD.height - 60 || car.x < 60 || car.x > WORLD.width - 60) {
        car.dir *= -1;
        car.angle += Math.PI;
        car.x = Math.max(60, Math.min(WORLD.width - 60, car.x));
      }
      if (car.road === 'h' && (car.x < 60 || car.x > WORLD.width - 60)) {
        car.dir *= -1;
        car.angle += Math.PI;
        car.x = Math.max(60, Math.min(WORLD.width - 60, car.x));
      }
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.panic > 0) {
        ped.panic -= dt;
        const away = Math.atan2(ped.y - p.y, ped.x - p.x);
        ped.x += Math.cos(away) * 150 * dt;
        ped.y += Math.sin(away) * 150 * dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (ped.x < 80 || ped.x > WORLD.width - 80 || ped.y < 80 || ped.y > WORLD.height - 80 || random() < 0.002) {
          ped.angle += (random() < 0.5 ? -1 : 1) * Math.PI / 2;
          ped.x = Math.max(80, Math.min(WORLD.width - 80, ped.x));
          ped.y = Math.max(80, Math.min(WORLD.height - 80, ped.y));
        }
      }
      ped.x = Math.max(40, Math.min(WORLD.width - 40, ped.x));
      ped.y = Math.max(40, Math.min(WORLD.height - 40, ped.y));
    }
  }

  function stepCarCollisions(dt) {
    const p = state.player;
    const all = state.cars;
    for (let i = 0; i < all.length; i += 1) {
      const a = all[i];
      if (a.kind === 'wreck') continue;
      for (let j = i + 1; j < all.length; j += 1) {
        const b = all[j];
        if (b.kind === 'wreck') continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          if (a.kind !== 'traffic') { a.x -= nx * push; a.y -= ny * push; }
          if (b.kind !== 'traffic') { b.x += nx * push; b.y += ny * push; }
          if ((p.inCar === a || p.inCar === b) && p.hurtTimer <= 0) {
            p.hurtTimer = 0.8;
            p.speed *= 0.7;
            damageCar(p.inCar, 4);
          }
        }
      }
      // Player on foot hit by a moving traffic car: one hit per 0.8 s, then a knockback.
      if (!p.inCar && a.kind === 'traffic') {
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (d < 30 && p.hurtTimer <= 0) {
          p.hurtTimer = 0.8;
          p.health -= 12;
          p.x += (p.x - a.x) / (d || 1) * 40;
          p.y += (p.y - a.y) / (d || 1) * 40;
        }
      }
    }
    // Player car vs buildings already clamps speed; car health from hard hits is in stepPlayer.
    if (p.inCar && p.inCar.health <= 0) {
      p.inCar.kind = 'wreck';
      p.inCar.speed = 0;
      p.inCar = null;
    }
  }

  function stepShooting(dt, input) {
    const p = state.player;
    state.fireTimer -= dt;
    if (p.inCar || state.fireTimer > 0 || !input.firing) return 0;
    const w = [0, 1, 2][state.weapon];
    const def = [ { damage: 12, range: 46, rate: 2.2 }, { damage: 26, range: 430, rate: 3.0 }, { damage: 13, range: 380, rate: 9.0 } ][w];
    if (state.ammo[w] !== Infinity && state.ammo[w] <= 0) return 0;
    if (state.ammo[w] !== Infinity) state.ammo[w] -= 1;
    state.fireTimer = 1 / def.rate;
    state.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (w === 0) {
      // Fists: a short arc in front of the player.
      for (const ped of state.peds) {
        const d = Math.hypot(ped.x - p.x, ped.y - p.y);
        if (d < 52) ped.panic = 3;
      }
      for (const car of state.cars) {
        if (Math.hypot(car.x - p.x, car.y - p.y) < 56) damageCar(car, 12);
      }
      return EVENT_SHOT;
    }
    // Hitscan: the first thing along the aim ray inside range takes the hit.
    const dx = Math.cos(state.aimAngle);
    const dy = Math.sin(state.aimAngle);
    let bestT = def.range;
    let bestKind = null;
    let bestRef = null;
    for (const car of state.cars) {
      if (car.kind === 'wreck') continue;
      const rx = car.x - p.x;
      const ry = car.y - p.y;
      const t = rx * dx + ry * dy;
      if (t < 0 || t > bestT) continue;
      const perp = Math.abs(-rx * dy + ry * dx);
      if (perp < 24) { bestT = t; bestKind = 'car'; bestRef = car; }
    }
    for (const ped of state.peds) {
      const rx = ped.x - p.x;
      const ry = ped.y - p.y;
      const t = rx * dx + ry * dy;
      if (t < 0 || t > bestT) continue;
      const perp = Math.abs(-rx * dy + ry * dx);
      if (perp < 14) { bestT = t; bestKind = 'ped'; bestRef = ped; }
    }
    for (const cop of state.cruisers) {
      const rx = cop.x - p.x;
      const ry = cop.y - p.y;
      const t = rx * dx + ry * dy;
      if (t < 0 || t > bestT) continue;
      const perp = Math.abs(-rx * dy + ry * dx);
      if (perp < 24) { bestT = t; bestKind = 'cop'; bestRef = cop; }
    }
    if (bestKind === 'car') {
      damageCar(bestRef, def.damage);
      addHeat(2);
    } else if (bestKind === 'ped') {
      bestRef.panic = 5;
      addHeat(HEAT.hitPed);
    } else if (bestKind === 'cop') {
      bestRef.health -= def.damage;
      if (bestRef.health <= 0) {
        bestRef.dead = true;
        addHeat(HEAT.killCop);
      } else addHeat(HEAT.hitCop);
    }
    addHeat(HEAT.shoot);
    return EVENT_SHOT;
  }

  function stepHeat(dt) {
    const p = state.player;
    let seen = false;
    for (const cop of state.cruisers) {
      if (Math.hypot(cop.x - p.x, cop.y - p.y) < 520) { seen = true; break; }
    }
    if (state.heli && Math.hypot(state.heli.x - p.x, state.heli.y - p.y) < 700) seen = true;
    if (seen) state.heatSeenTimer = 0;
    else state.heatSeenTimer += dt;
    const hidden = state.heatSeenTimer > 5;
    let rate = HEAT.decay;
    if (state.crew.vera) rate = HEAT.decayVera;
    if (hidden) rate = HEAT.decayHidden * (state.crew.vera ? 1.5 : 1);
    state.heat = Math.max(0, state.heat - rate * dt);
  }

  function handleEnter() {
    const p = state.player;
    if (p.inCar) {
      // Get out, on the side away from traffic.
      const out = p.inCar;
      p.inCar = null;
      p.x = out.x + Math.cos(out.angle + Math.PI / 2) * 34;
      p.y = out.y + Math.sin(out.angle + Math.PI / 2) * 34;
      p.speed = 0;
      return;
    }
    const car = nearestCar(p.x, p.y, 70, ['parked', 'garage', 'traffic']);
    if (!car) return;
    if (car.kind === 'traffic' || car.kind === 'parked') {
      addHeat(HEAT.stealCar);
      state.banner = car.kind === 'traffic' ? 'Carjacked! The law is coming.' : 'Car taken.';
      state.bannerTimer = 2.5;
      car.kind = 'stolen';
    }
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = 0;
    if (car.health <= 0) car.health = 60;
  }

  function step(dt, input) {
    let events = 0;
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.player.hurtTimer > 0) state.player.hurtTimer -= dt;
    if (state.over || state.won) return events;

    const actions = input.actions || 0;
    if (actions & 1) handleEnter(); // ACTION_ENTER
    if (actions & 2) { // ACTION_WEAPON: cycle fists -> pistol -> SMG
      state.weapon = (state.weapon + 1) % 3;
    }

    stepPlayer(dt, input);
    stepTraffic(dt);
    stepPeds(dt);
    stepCarCollisions(dt);
    events |= stepShooting(dt, input);
    events |= updatePolice(state, dt, random);
    stepHeat(dt);
    events |= updateMission(state, dt, random);

    if (state.player.health <= 0) {
      state.player.health = 100;
      state.player.x = 2400;
      state.player.y = 2000;
      state.player.inCar = null;
      state.cash = Math.max(0, state.cash - 200);
      state.heat = 0;
      state.cruisers = [];
      state.roadblocks = [];
      state.heli = null;
      state.banner = 'Wasted. The hospital took $200.';
      state.bannerTimer = 3;
      events |= EVENT_WASTED;
    }
    if (state.player.inCar && state.player.inCar.health <= 0) {
      state.player.inCar = null;
    }
    return events;
  }

  function garageDiscount() {
    return Math.min(25, state.standing.downtown * 5);
  }

  function buyCar(defId) {
    const def = CARS.find((c) => c.id === defId);
    if (!def || state.ownedCars.includes(defId)) return false;
    const price = Math.round(def.price * (1 - garageDiscount() / 100));
    if (state.cash < price) return false;
    state.cash -= price;
    state.ownedCars.push(defId);
    state.upgrades[defId] = { engine: 0, tires: 0, armor: 0 };
    state.cars.push({
      kind: 'garage', def: defId, x: GARAGE.x - 140 + (state.ownedCars.length - 1) * 90, y: GARAGE.y + 120,
      angle: -Math.PI / 2, speed: 0, baseSpeed: 0, road: null, roadAt: 0, dir: 0, health: def.health, color: def.color,
    });
    return true;
  }

  function buyUpgrade(defId, kind) {
    const up = state.upgrades[defId];
    const def = UPGRADES[kind];
    if (!up || !def || up[kind] >= def.max) return false;
    const price = Math.round(def.base * (up[kind] + 1) * (1 - garageDiscount() / 100));
    if (state.cash < price) return false;
    state.cash -= price;
    up[kind] += 1;
    return true;
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash,
        missionIndex: state.missionIndex,
        missionsDone: state.missionsDone,
        standing: state.standing,
        crew: state.crew,
        ownedCars: state.ownedCars,
        upgrades: state.upgrades,
        ammo: state.ammo,
      }));
      return true;
    } catch {
      return false;
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.cash = data.cash ?? 500;
      state.missionIndex = data.missionIndex ?? 0;
      state.missionsDone = data.missionsDone ?? 0;
      state.standing = data.standing || state.standing;
      state.crew = data.crew || state.crew;
      state.ownedCars = data.ownedCars || ['corto'];
      state.upgrades = data.upgrades || { corto: { engine: 0, tires: 0, armor: 0 } };
      state.ammo = data.ammo || [Infinity, 120, 240];
      spawnTraffic();
      spawnPeds();
      return true;
    } catch {
      return false;
    }
  }

  reset();
  return {
    state, buildings, palms, groundPatches, speckles, sandSpeckles, waves, parks, plaza,
    roundabout, streetlights, signs, boats,
    reset, step, save, load, buyCar, buyUpgrade, garageDiscount,
    addHeat, stars, nearestCar, damageCar, districtAt,
  };
}
