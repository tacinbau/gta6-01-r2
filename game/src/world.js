// Azura Bay city generation: a seeded road grid, building blocks, districts,
// beach, docks, garage, shops and mission landmarks. Deterministic per seed.
import { WORLD, DISTRICTS } from './config.js';
import { makeRng, clamp } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function isRoad(x, y) {
  const s = WORLD.roadSpacing;
  const w = WORLD.roadWidth;
  const mx = ((x % s) + s) % s;
  const my = ((y % s) + s) % s;
  return mx < w || my < w || mx > s - 2 || my > s - 2;
}

export function nearestRoadPoint(x, y) {
  const s = WORLD.roadSpacing;
  const w = WORLD.roadWidth;
  const gx = Math.floor(x / s) * s;
  const gy = Math.floor(y / s) * s;
  const cx = gx + w / 2;
  const cy = gy + w / 2;
  // snap to the closest road centre line (horizontal or vertical)
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx < dy) return { x: cx, y, vertical: true };
  return { x, y: cy, vertical: false };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const size = WORLD.size;
  const s = WORLD.roadSpacing;
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parkSpots = [];

  for (let bx = 0; bx < size / s; bx += 1) {
    for (let by = 0; by < size / s; by += 1) {
      const x0 = bx * s + WORLD.roadWidth + 14;
      const y0 = by * s + WORLD.roadWidth + 14;
      const bw = s - WORLD.roadWidth - 28;
      const bh = s - WORLD.roadWidth - 28;
      // beach strip along the south edge: no buildings, palms instead
      if (y0 > size - WORLD.beach - 160) {
        for (let i = 0; i < 5; i += 1) {
          trees.push({ x: x0 + rng.range(0, bw), y: y0 + rng.range(0, bh), palm: true });
        }
        continue;
      }
      const kind = rng.pick(['tower', 'tower', 'house', 'house', 'shop', 'park']);
      if (kind === 'park') {
        for (let i = 0; i < 6; i += 1) {
          trees.push({ x: x0 + rng.range(0, bw), y: y0 + rng.range(0, bh), palm: rng.chance(0.4) });
        }
        parkSpots.push({ x: x0 + bw / 2, y: y0 + bh / 2 });
        continue;
      }
      const count = kind === 'tower' ? rng.int(1, 2) : rng.int(3, 5);
      for (let i = 0; i < count; i += 1) {
        const w = kind === 'tower' ? rng.range(80, 130) : rng.range(50, 100);
        const h = kind === 'tower' ? rng.range(80, 130) : rng.range(50, 100);
        const x = x0 + rng.range(0, Math.max(1, bw - w));
        const y = y0 + rng.range(0, Math.max(1, bh - h));
        const d = districtAt(x + w / 2, y + h / 2);
        buildings.push({
          x, y, w, h,
          kind,
          height: kind === 'tower' ? rng.int(3, 9) : rng.int(1, 2),
          color: shade(d.color, rng.range(-0.25, 0.25)),
          roof: rng.pick(['#3d405b', '#6d6875', '#8d99ae', '#2b2d42']),
        });
      }
      if (rng.chance(0.5)) {
        trees.push({ x: x0 + rng.range(0, bw), y: y0 + rng.range(0, bh), palm: false });
      }
    }
  }

  // street lamps along every avenue crossing
  for (let x = 0; x <= size; x += s) {
    for (let y = 0; y <= size; y += s) {
      lamps.push({ x: x + WORLD.roadWidth + 6, y: y + WORLD.roadWidth + 6 });
    }
  }

  const landmarks = {
    garage: { x: 1760, y: 1500, name: 'Cleo\u2019s Garage' },
    cafe: { x: 420, y: 420, name: 'Caf\u00e9 Brasa' },
    bank: { x: 820, y: 1500, name: 'Azura National Bank' },
    casino: { x: 1140, y: 1820, name: 'Casino Solmar' },
    hospital: { x: 420, y: 1500, name: 'Azura General' },
    airstrip: { x: 2960, y: 260, name: 'Azura Airstrip' },
    pier: { x: 1500, y: 3080, name: 'Marina Pier' },
    ironworks: { x: 2100, y: 1500, name: 'Ironworks Ammo' },
    diner: { x: 2400, y: 2600, name: 'Docks Diner' },
  };

  return { seed, buildings, trees, lamps, landmarks, size };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = clamp(Math.round(r * (1 + amt)), 0, 255);
  g = clamp(Math.round(g * (1 + amt)), 0, 255);
  b = clamp(Math.round(b * (1 + amt)), 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function collidesWithBuildings(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) {
      return b;
    }
  }
  return null;
}

export function inWater(x, y) {
  return y > WORLD.size - WORLD.beach + 40 || x < -40 || x > WORLD.size + 40 || y < -40;
}
