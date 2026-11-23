// The screenshot scenes behind ?shot=cover|city|mission|night. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (drive toward the objective, back up when stuck), so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { ROADS_X, ROADS_Y, STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';
import { MISSIONS } from './missions.js';

const SAMPLE = STEP;

/** Put the player in the nearest parked car to (x, y). */
function placeInCar(state, x, y) {
  let best = null;
  let bestD = 1e9;
  for (const car of state.cars) {
    if (car.kind !== 'parked' && car.kind !== 'garage') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  const p = state.player;
  p.inCar = best;
  p.x = best.x;
  p.y = best.y;
  p.angle = best.angle;
  p.speed = 0;
  best.kind = 'stolen';
}

function nearestLine(list, v) {
  return list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

/** Next road waypoint toward (tx, ty): stay on the road grid, turn at intersections, and
 * cut across the block only for the last stretch — a real drive, not a crow-flies line. */
function navPoint(state, tx, ty) {
  const p = state.player;
  if (Math.hypot(tx - p.x, ty - p.y) < 320) return { x: tx, y: ty };
  const rx = nearestLine(ROADS_X, p.x);
  const ry = nearestLine(ROADS_Y, p.y);
  const onV = Math.abs(p.x - rx) < 55;
  const onH = Math.abs(p.y - ry) < 55;
  if (onH && Math.abs(ty - ry) < 70) return { x: tx, y: ry };
  if (onV && Math.abs(tx - rx) < 70) return { x: rx, y: ty };
  if (onH) return { x: nearestLine(ROADS_X, tx), y: ry };
  if (onV) return { x: rx, y: nearestLine(ROADS_Y, ty) };
  const dx = Math.abs(p.x - rx);
  const dy = Math.abs(p.y - ry);
  return dx < dy ? { x: rx, y: p.y } : { x: p.x, y: ry };
}

/** Steer the player's car toward the next road waypoint; back up briefly when stuck. */
function autopilot(state, tx, ty, stuck) {
  const p = state.player;
  const nav = navPoint(state, tx, ty);
  const desired = Math.atan2(nav.y - p.y, nav.x - p.x);
  let diff = desired - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (stuck.time > 0) {
    stuck.time -= SAMPLE;
    return { x: -Math.sign(diff || 1), y: 1 };
  }
  if (Math.abs(p.speed) < 25) {
    stuck.low += SAMPLE;
    if (stuck.low > 1.5) {
      stuck.low = 0;
      stuck.time = 0.9;
      return { x: -Math.sign(diff || 1), y: 1 };
    }
  } else stuck.low = 0;
  return { x: Math.max(-1, Math.min(1, diff * 2)), y: -1 };
}

/** Step the world for `seconds`, driving toward (tx, ty) the whole time. */
function driveFor(world, seconds, tx, ty) {
  const state = world.state;
  const stuck = { low: 0, time: 0 };
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const axes = autopilot(state, tx, ty, stuck);
    world.step(STEP, { axes, aimX: state.player.x + 100, aimY: state.player.y, firing: false, actions: 0 });
  }
}

/** Make sure at least two cruisers are close enough to see in the frame. */
function ensureChase(state) {
  const p = state.player;
  let near = 0;
  for (const cop of state.cruisers) {
    if (!cop.dead && Math.hypot(cop.x - p.x, cop.y - p.y) < 700) near += 1;
  }
  const spots = [[-380, -220], [420, 260], [-300, 380], [360, -300]];
  for (let i = near; i < 2; i += 1) {
    const [dx, dy] = spots[i % spots.length];
    state.cruisers.push({
      x: p.x + dx, y: p.y + dy, angle: Math.atan2(-dy, -dx), speed: 300, health: 90,
      fireTimer: 1, dead: false, roadblock: false, bustTimer: 0, ramTimer: 0,
    });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it. Any name other than
 * the four is the cover. The world must be fresh (seed 7) when this is called.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  state.timeOfDay = 0;

  if (name === 'city') {
    // Dusk drive through the Marina, no heat, traffic all around.
    state.timeOfDay = 1;
    state.missionIndex = 8;
    placeInCar(state, 2600, 2000);
    driveFor(world, 14, 2400, 2200);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    // Mission 3/8, Lose the Tail: 3 stars, the clock running, cruisers behind.
    state.missionIndex = 2;
    state.mission = { def: MISSIONS[2], stepIndex: 0, timer: 0, failTimer: 0, data: {} };
    state.heat = 65;
    placeInCar(state, 2000, 500);
    // The chase car is staged tough so it survives the drive and stays in the frame.
    if (state.player.inCar) state.player.inCar.health = 400;
    driveFor(world, 22, 2400, 850);
    // Re-stage the mission at its first step with the clock running: the drive may have
    // advanced it, and the frame is Lose the Tail in progress.
    state.mission = { def: MISSIONS[2], stepIndex: 0, timer: 24, failTimer: 0, data: {} };
    ensureChase(state);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'night') {
    // Night, 4 stars, Air One overhead with its spotlight.
    state.timeOfDay = 2;
    state.missionIndex = 8;
    state.heat = 85;
    placeInCar(state, 1650, 1400);
    // The chase car is staged tough so it survives the drive and stays in the frame.
    if (state.player.inCar) state.player.inCar.health = 400;
    driveFor(world, 16, 1900, 1300);
    ensureChase(state);
    if (!state.heli) state.heli = { x: state.player.x, y: state.player.y - 260, angle: 0 };
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // Cover: Mission 5/8, The Vault, driving on the bank with 3 stars and cruisers behind.
  state.missionIndex = 4;
  state.mission = { def: MISSIONS[4], stepIndex: 0, timer: 0, failTimer: 0, data: {} };
  state.heat = 65;
  placeInCar(state, 1400, 900);
  // The chase car is staged tough so it survives the drive and stays in the frame.
  if (state.player.inCar) state.player.inCar.health = 400;
  driveFor(world, 18, 1650, 1075);
  // Re-stage the Vault at its first step: the drive may have reached the bank already.
  state.mission = { def: MISSIONS[4], stepIndex: 0, timer: 0, failTimer: 0, data: {} };
  ensureChase(state);
  return { screen: SCREEN_PLAY, best: 0 };
}
