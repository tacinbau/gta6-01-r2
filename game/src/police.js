// Police dispatch: cruisers that chase and ram, roadblocks from 3 stars (4 stars once Vera
// is on the crew), and the Air One helicopter from 4 stars. Busted happens on foot, when a
// cruiser stays close for a moment. All of it runs on the same seeded stream as the world.
import { EVENT_BUSTED } from './world.js';
import { HEAT, ROADS_X, ROADS_Y, WORLD } from './config.js';

const CRUISER_SPEED = 390; // just under the Corto's top speed, so a straight run escapes
const CRUISER_HEALTH = 90;

/** How many cruisers the wanted level wants on the road. */
function wantedCruisers(stars) {
  return stars === 0 ? 0 : Math.min(5, stars + (stars >= 3 ? 1 : 0));
}

function starsOf(state) {
  return Math.min(5, Math.floor(state.heat / HEAT.perStar));
}

function spawnPoint(state, random) {
  const p = state.player;
  const angle = random() * Math.PI * 2;
  const dist = 700 + random() * 300;
  const x = Math.max(120, Math.min(WORLD.width - 120, p.x + Math.cos(angle) * dist));
  const y = Math.max(120, Math.min(WORLD.height - 120, p.y + Math.sin(angle) * dist));
  return { x, y };
}

function placeRoadblock(state) {
  const p = state.player;
  // The road line ahead of the player, on the axis they are mostly travelling.
  const movingX = Math.abs(Math.cos(p.angle)) > Math.abs(Math.sin(p.angle));
  let line;
  if (movingX) {
    const dir = Math.cos(p.angle) >= 0 ? 1 : -1;
    const ahead = p.x + dir * 520;
    line = ROADS_Y.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
    state.roadblocks.push({ x: ahead, y: line, angle: 0, axis: 'h' });
  } else {
    const dir = Math.sin(p.angle) >= 0 ? 1 : -1;
    const ahead = p.y + dir * 520;
    line = ROADS_X.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
    state.roadblocks.push({ x: line, y: ahead, angle: Math.PI / 2, axis: 'v' });
  }
  // Two cruisers parked across it.
  const block = state.roadblocks[state.roadblocks.length - 1];
  for (const off of [-40, 40]) {
    const cx = block.axis === 'h' ? block.x + off : block.x;
    const cy = block.axis === 'h' ? block.y : block.y + off;
    state.cruisers.push({
      x: cx, y: cy, angle: block.angle, speed: 0, health: CRUISER_HEALTH,
      fireTimer: 0, dead: false, roadblock: true, bustTimer: 0, ramTimer: 0,
    });
  }
}

/** One fixed step of the police. Returns EVENT_BUSTED (0 otherwise). */
export function updatePolice(state, dt, random) {
  const p = state.player;
  const stars = starsOf(state);
  let events = 0;

  // Keep the cruiser count at what the wanted level asks for.
  const want = wantedCruisers(stars);
  const active = state.cruisers.filter((c) => !c.dead);
  if (active.length < want) {
    const at = spawnPoint(state, random);
    state.cruisers.push({
      x: at.x, y: at.y, angle: 0, speed: 0, health: CRUISER_HEALTH,
      fireTimer: 1 + random(), dead: false, roadblock: false, bustTimer: 0, ramTimer: 0,
    });
  }
  // Roadblocks: 3 stars, or 4 stars once Vera holds them back.
  const blockStars = state.crew.vera ? 4 : 3;
  if (stars >= blockStars && state.roadblocks.length === 0 && p.inCar) {
    placeRoadblock(state);
  }
  if (stars < blockStars && state.roadblocks.length > 0) {
    for (const c of state.cruisers) if (c.roadblock) c.roadblock = false;
    state.roadblocks = [];
  }
  // Air One from 4 stars.
  if (stars >= 4 && !state.heli) {
    state.heli = { x: p.x, y: p.y - 300, angle: 0 };
    state.banner = 'Air One is over you. Lose the spotlight.';
    state.bannerTimer = 3;
  }
  if (stars < 4 && state.heli) state.heli = null;
  if (state.heli) {
    const h = state.heli;
    h.x += (p.x - h.x) * Math.min(1, 1.4 * dt);
    h.y += (p.y - h.y) * Math.min(1, 1.4 * dt);
  }

  // Chase, ram and shoot.
  for (const cop of state.cruisers) {
    if (cop.dead) continue;
    if (cop.roadblock) {
      // Parked across the road until the player is close, then it joins the chase.
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (d < 260) cop.roadblock = false;
      continue;
    }
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    cop.speed = Math.min(CRUISER_SPEED, cop.speed + 420 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = Math.max(60, Math.min(WORLD.width - 60, cop.x));
    cop.y = Math.max(60, Math.min(WORLD.height - 60, cop.y));

    // Ram: one damaging hit per 0.8 s per cruiser, then a soft push apart.
    if (cop.ramTimer > 0) cop.ramTimer -= dt;
    if (dist < 46) {
      if (p.inCar) {
        if (cop.ramTimer <= 0) {
          cop.ramTimer = 0.8;
          p.inCar.health -= 4;
          cop.health -= 6;
          if (cop.health <= 0) cop.dead = true;
        }
        p.speed *= 0.85;
        cop.speed *= 0.5;
      } else {
        // On foot, close: the bust clock runs.
        cop.bustTimer += dt;
        p.health -= 4 * dt;
        if (cop.bustTimer > 1.2) {
          state.cash = Math.max(0, state.cash - 200);
          state.heat = 0;
          state.cruisers = [];
          state.roadblocks = [];
          state.heli = null;
          p.x = 2400;
          p.y = 2000;
          p.health = 100;
          state.banner = 'Busted. The fine took $200.';
          state.bannerTimer = 3;
          return EVENT_BUSTED;
        }
      }
    } else {
      cop.bustTimer = Math.max(0, cop.bustTimer - dt);
    }
    // Shoot when close and roughly facing the player.
    cop.fireTimer -= dt;
    if (dist < 380 && cop.fireTimer <= 0 && Math.abs(diff) < 0.5) {
      cop.fireTimer = 1.8 + random() * 1.0;
      if (p.inCar) p.inCar.health -= 3;
      else p.health -= 6;
    }
  }

  // Heli fire at 5 stars.
  if (state.heli && stars >= 5) {
    state.heli.fireTimer = (state.heli.fireTimer || 0) - dt;
    if (state.heli.fireTimer <= 0) {
      state.heli.fireTimer = 2;
      if (p.inCar) p.inCar.health -= 6;
      else p.health -= 8;
    }
  }

  // Clear the dead and the far away once the heat is gone.
  state.cruisers = state.cruisers.filter((c) => {
    if (c.dead) return false;
    if (stars === 0 && Math.hypot(c.x - p.x, c.y - p.y) > 1100) return false;
    return true;
  });
  return events;
}
