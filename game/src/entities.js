// Entities: cars, traffic, pedestrians, police, helicopter, roadblocks,
// bullets and the wanted system. All movement is deterministic per seed.
import { WORLD, CAR, CAR_MODELS, UPGRADES, WEAPONS, WANTED, POLICE_PER_STAR, ROADBLOCK_STARS, HELI_STARS } from './config.js';
import { makeRng, clamp, dist2, angleTo, angleDiff } from './random.js';
import { isRoad, nearestRoadPoint, collidesWithBuildings, districtAt } from './world.js';

let nextId = 1;

export function makeCar(modelId, x, y, angle, owner) {
  const model = CAR_MODELS.find((m) => m.id === modelId) || CAR_MODELS[0];
  return {
    id: nextId++, kind: 'car', model: model.id, modelName: model.name,
    x, y, angle, speed: 0, color: model.color, owner,
    hp: 100, maxHp: 100, top: model.top, accel: model.accel, grip: model.grip,
    parked: owner === 'parked', target: null, dir: 0, stuck: 0,
  };
}

export function spawnParkedCars(state, rng) {
  const spots = [];
  const s = WORLD.roadSpacing;
  for (let i = 0; i < 26; i += 1) {
    const gx = rng.int(1, 9) * s + WORLD.roadWidth / 2;
    const gy = rng.int(1, 9) * s + WORLD.roadWidth / 2;
    const vertical = rng.chance(0.5);
    const x = vertical ? gx + 16 : gx + rng.range(-120, 120);
    const y = vertical ? gy + rng.range(-120, 120) : gy + 16;
    const model = rng.pick(CAR_MODELS);
    spots.push(makeCar(model.id, x, y, vertical ? Math.PI / 2 : 0, 'parked'));
  }
  state.cars.push(...spots);
}

export function spawnTraffic(state, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    const x = rng.range(200, WORLD.size - 200);
    const y = rng.range(200, WORLD.size - 200);
    const p = nearestRoadPoint(x, y);
    const car = makeCar(rng.pick(['sedan', 'sedan', 'coupe', 'van']).id, p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'traffic');
    car.dir = rng.int(0, 3);
    car.speed = rng.range(110, 170);
    state.cars.push(car);
  }
}

export function spawnPeds(state, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    state.peds.push({
      id: nextId++, kind: 'ped',
      x: rng.range(100, WORLD.size - 100), y: rng.range(100, WORLD.size - 100),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55),
      color: rng.pick(['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1', '#1abc9c']),
      hp: 30, flee: 0, target: null,
    });
  }
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function stepCarPhysics(car, dt, city, steerInput, throttle) {
  const target = throttle > 0 ? car.top : throttle < 0 ? -CAR.reverseMax : 0;
  if (throttle !== 0) {
    // simple approach toward target speed
    const rate = throttle > 0 ? car.accel : CAR.brake;
    if (car.speed < target) car.speed = Math.min(target, car.speed + rate * dt);
    else if (car.speed > target) car.speed = Math.max(target, car.speed - rate * dt);
  } else {
    car.speed *= Math.pow(0.4, dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  const steerAmount = steerInput * CAR.steer * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collidesWithBuildings(city, nx, ny, 20);
  if (hit) {
    car.speed *= -0.25;
  } else {
    car.x = clamp(nx, 20, WORLD.size - 20);
    car.y = clamp(ny, 20, WORLD.size - 20);
  }
}

export function updatePlayerCar(state, dt, input) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (!car) return;
  const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  // Rook's crew bonus: sharper steering and higher top speed
  const topBonus = state.crewActive === 'rook' ? 1.12 : 1;
  const savedTop = car.top;
  car.top = savedTop * topBonus;
  stepCarPhysics(car, dt, state.city, steer, throttle);
  car.top = savedTop;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  if (Math.abs(car.speed) > 240 && state.wanted > 0) state.wantedHeat = Math.min(100, state.wantedHeat + dt * 2);
}

export function updatePlayerOnFoot(state, dt, input) {
  const p = state.player;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.angle = Math.atan2(my, mx);
    const speed = input.shift ? 265 : 175;
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    if (!collidesWithBuildings(state.city, nx, p.y, 13)) p.x = clamp(nx, 20, WORLD.size - 20);
    if (!collidesWithBuildings(state.city, p.x, ny, 13)) p.y = clamp(ny, 20, WORLD.size - 20);
  }
}

export function updateTraffic(state, dt) {
  const s = WORLD.roadSpacing;
  for (const car of state.cars) {
    if (car.owner !== 'traffic' || car.ghost || car.fleeing) continue;
    const [dx, dy] = DIRS[car.dir];
    // at an intersection, sometimes turn
    const nearX = Math.abs(car.x % s - WORLD.roadWidth / 2) < 14;
    const nearY = Math.abs(car.y % s - WORLD.roadWidth / 2) < 14;
    if (nearX && nearY && state.rng.chance(dt * 1.2)) {
      car.dir = (car.dir + state.rng.pick([-1, 1])) % 4;
      if (car.dir < 0) car.dir += 4;
    }
    const targetAngle = Math.atan2(dy, dx);
    car.angle += angleDiff(car.angle, targetAngle) * Math.min(1, dt * 4);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 40 || car.x > WORLD.size - 40 || car.y < 40 || car.y > WORLD.size - 40) {
      car.dir = (car.dir + 2) % 4;
    }
    // slow for the car ahead
    for (const other of state.cars) {
      if (other === car) continue;
      const d2 = dist2(car.x, car.y, other.x, other.y);
      if (d2 < 60 * 60 && Math.abs(angleDiff(car.angle, angleTo(car.x, car.y, other.x, other.y))) < 0.6) {
        car.speed = Math.max(0, car.speed - 220 * dt);
      }
    }
    car.speed = Math.min(car.speed + 40 * dt, 170);
  }
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    const d2 = dist2(ped.x, ped.y, p.x, p.y);
    const carNear = state.cars.some((c) => c.owner !== 'parked' && Math.abs(c.speed) > 120 && dist2(ped.x, ped.y, c.x, c.y) < 130 * 130);
    if (ped.flee > 0 || d2 < 90 * 90 || carNear) {
      ped.flee = Math.max(ped.flee, 1.2);
      const away = angleTo(p.x, p.y, ped.x, ped.y);
      ped.angle = away;
      ped.x += Math.cos(away) * 120 * dt;
      ped.y += Math.sin(away) * 120 * dt;
      ped.flee -= dt;
    } else {
      if (!ped.target || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 30 * 30 || state.rng.chance(dt * 0.05)) {
        ped.target = { x: clamp(ped.x + state.rng.range(-300, 300), 60, WORLD.size - 60), y: clamp(ped.y + state.rng.range(-300, 300), 60, WORLD.size - 60) };
      }
      const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * ped.speed * dt;
      const ny = ped.y + Math.sin(a) * ped.speed * dt;
      if (!collidesWithBuildings(state.city, nx, ny, 10)) {
        ped.x = nx;
        ped.y = ny;
      }
    }
    ped.x = clamp(ped.x, 30, WORLD.size - 30);
    ped.y = clamp(ped.y, 30, WORLD.size - 30);
  }
}

export function addHeat(state, amount, reason) {
  state.wantedHeat = clamp(state.wantedHeat + amount, 0, 100);
  state.lastCrime = state.time;
  state.lastCrimeReason = reason;
  const stars = heatToStars(state.wantedHeat);
  if (stars > state.wanted) state.wanted = stars;
}

export function heatToStars(heat) {
  if (heat < 15) return 0;
  if (heat < 35) return 1;
  if (heat < 55) return 2;
  if (heat < 75) return 3;
  if (heat < 90) return 4;
  return 5;
}

export function updateWanted(state, dt) {
  const p = state.player;
  let seen = false;
  for (const car of state.cars) {
    if (car.owner === 'police' && dist2(car.x, car.y, p.x, p.y) < 520 * 520) seen = true;
  }
  if (state.heli.active && dist2(state.heli.x, state.heli.y, p.x, p.y) < 420 * 420) seen = true;
  const decay = state.crewActive === 'vera' ? WANTED.decayBase * 1.4 : WANTED.decayBase;
  if (state.time - state.lastCrime > 4) {
    state.wantedHeat = Math.max(0, state.wantedHeat - decay * (seen ? 0.4 : WANTED.decayHidden) * dt);
  }
  state.wanted = heatToStars(state.wantedHeat);
  if (state.wanted === 0) {
    state.police = [];
    state.roadblocks = [];
    state.heli.active = false;
    state.bustTimer = 0;
  }
}

export function ensurePolice(state) {
  const want = POLICE_PER_STAR[state.wanted] || 0;
  while (state.police.length < want) {
    const a = state.rng.range(0, Math.PI * 2);
    const r = state.rng.range(420, 700);
    const x = clamp(state.player.x + Math.cos(a) * r, 60, WORLD.size - 60);
    const y = clamp(state.player.y + Math.sin(a) * r, 60, WORLD.size - 60);
    const p = nearestRoadPoint(x, y);
    const car = makeCar('sedan', p.x, p.y, 0, 'police');
    car.color = '#1a1a2e';
    car.top = 500;
    car.accel = 420;
    state.cars.push(car);
    state.police.push({ carId: car.id, mode: 'chase', ramCooldown: 0 });
  }
  if (state.wanted >= HELI_STARS && !state.heli.active) {
    state.heli.active = true;
    state.heli.x = state.player.x - 200;
    state.heli.y = state.player.y - 200;
  }
  if (state.wanted >= ROADBLOCK_STARS && state.roadblocks.length < 2 && state.time - state.lastRoadblock > (state.crewActive === 'vera' ? 26 : 14)) {
    state.lastRoadblock = state.time;
    const a = state.player.angle;
    const bx = clamp(state.player.x + Math.cos(a) * 520, 80, WORLD.size - 80);
    const by = clamp(state.player.y + Math.sin(a) * 520, 80, WORLD.size - 80);
    const p = nearestRoadPoint(bx, by);
    state.roadblocks.push({ x: p.x, y: p.y, angle: p.vertical ? 0 : Math.PI / 2, life: 30 });
    const c1 = makeCar('sedan', p.x - 30, p.y, p.vertical ? Math.PI / 2 : 0, 'police');
    const c2 = makeCar('sedan', p.x + 30, p.y, p.vertical ? Math.PI / 2 : 0, 'police');
    c1.color = '#1a1a2e';
    c2.color = '#1a1a2e';
    c1.parked = true;
    c2.parked = true;
    state.cars.push(c1, c2);
    state.roadblocks[state.roadblocks.length - 1].carIds = [c1.id, c2.id];
  }
}

export function updatePolice(state, dt) {
  const p = state.player;
  for (const cop of state.police) {
    const car = state.cars.find((c) => c.id === cop.carId);
    if (!car) continue;
    if (car.hp <= 0) {
      car.parked = true; // wrecked cruiser stays as a wreck
      continue;
    }
    const d = Math.sqrt(dist2(car.x, car.y, p.x, p.y));
    const wantAngle = angleTo(car.x, car.y, p.x, p.y);
    const steer = clamp(angleDiff(car.angle, wantAngle) * 1.6, -1, 1);
    const throttle = d > 60 ? 1 : 0.4;
    stepCarPhysics(car, dt, state.city, steer, throttle);
    if (d < 70 && car.speed > 200) {
      // ramming the player's car
      const pc = state.cars.find((c) => c.id === p.carId);
      if (pc) {
        pc.hp -= 14 * dt;
        addHeat(state, 0, '');
      }
    }
    // busted: police right on top of a slow player on foot or stopped car
    const playerSpeed = p.carId ? (state.cars.find((c) => c.id === p.carId)?.speed || 0) : 0;
    if (d < WANTED.bustDistance && (p.carId ? Math.abs(playerSpeed) < 30 : true)) {
      state.bustTimer += dt;
      if (state.bustTimer > 2.2) state.busted = true;
    } else {
      state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    }
    // shooting at the player when close and wanted is high
    if (state.wanted >= 2 && d < 300 && state.rng.chance(dt * 0.5)) {
      fireBullet(state, car.x, car.y, wantAngle, 8, 'police');
    }
  }
  // wrecked police cruisers stop chasing
  state.police = state.police.filter((cop) => {
    const car = state.cars.find((c) => c.id === cop.carId);
    return car && car.hp > 0;
  });
  // heli follows
  if (state.heli.active) {
    const h = state.heli;
    const wantAngle = angleTo(h.x, h.y, p.x, p.y);
    h.angle = wantAngle;
    const d = Math.sqrt(dist2(h.x, h.y, p.x, p.y));
    const sp = d > 120 ? 260 : 120;
    h.x += Math.cos(wantAngle) * sp * dt;
    h.y += Math.sin(wantAngle) * sp * dt;
    h.rotor = (h.rotor || 0) + dt * 30;
  }
  for (const rb of state.roadblocks) rb.life -= dt;
  state.roadblocks = state.roadblocks.filter((rb) => {
    if (rb.life > 0) return true;
    for (const id of rb.carIds || []) {
      const i = state.cars.findIndex((c) => c.id === id);
      if (i >= 0) state.cars.splice(i, 1);
    }
    return false;
  });
}

export function fireBullet(state, x, y, angle, damage, from) {
  state.bullets.push({
    x: x + Math.cos(angle) * 24, y: y + Math.sin(angle) * 24,
    vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900,
    life: 0.6, damage, from,
  });
  state.muzzle = 0.05;
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.from === 'player') {
      for (const ped of state.peds) {
        if (dist2(b.x, b.y, ped.x, ped.y) < 18 * 18) {
          ped.hp -= b.damage;
          b.life = 0;
          addHeat(state, 8, 'shooting');
          if (ped.hp <= 0) {
            ped.dead = true;
            addHeat(state, 12, 'ped down');
          }
        }
      }
      for (const car of state.cars) {
        if (car.owner === 'police' && dist2(b.x, b.y, car.x, car.y) < 24 * 24) {
          car.hp -= b.damage;
          b.life = 0;
          addHeat(state, 6, 'shooting at police');
        }
      }
    } else {
      const p = state.player;
      if (dist2(b.x, b.y, p.x, p.y) < 16 * 16) {
        p.health -= b.damage;
        b.life = 0;
        if (p.health <= 0) state.wasted = true;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  state.peds = state.peds.filter((ped) => !ped.dead);
  if (state.muzzle > 0) state.muzzle -= dt;
}

export function tryEnterCar(state) {
  const p = state.player;
  if (p.carId) {
    const car = state.cars.find((c) => c.id === p.carId);
    if (car) {
      car.parked = true;
      p.carId = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    }
    return;
  }
  let best = null;
  let bestD = 60 * 60;
  for (const car of state.cars) {
    if (car.owner === 'police') continue;
    const d2 = dist2(p.x, p.y, car.x, car.y);
    if (d2 < bestD) {
      bestD = d2;
      best = car;
    }
  }
  if (best) {
    p.carId = best.id;
    best.parked = false;
    best.owner = 'player';
    if (best.ownerWas !== 'player' && best.model !== 'sedan') {
      // stealing a stranger's car draws heat
    }
    if (best.stolen !== true && best.id !== state.ownedCarId) {
      addHeat(state, 18, 'grand theft auto');
      best.stolen = true;
    }
    p.x = best.x;
    p.y = best.y;
    p.angle = best.angle;
  }
}

export function collideCars(state, dt) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.parked && b.parked) continue;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 < 40 * 40 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (40 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        if (!a.parked) {
          a.x -= nx * push;
          a.y -= ny * push;
          a.speed *= 0.92;
        }
        if (!b.parked) {
          b.x += nx * push;
          b.y += ny * push;
          b.speed *= 0.92;
        }
        // crashing into a police car or a pedestrian car is a crime
        if ((a.owner === 'player' && b.owner === 'police') || (b.owner === 'player' && a.owner === 'police')) {
          if (Math.abs(a.speed) + Math.abs(b.speed) > 200) addHeat(state, 4, 'ramming police');
        }
        if ((a.owner === 'player' || b.owner === 'player') && state.rng.chance(dt * 0.4)) {
          state.particles.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, life: 0.4, color: '#f1c40f' });
        }
      }
    }
  }
}
