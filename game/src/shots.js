// Screenshot scenes behind ?shot=cover|city|mission|night. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by simple autopilots that follow the road grid, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP, WORLD } from './config.js';
import { makeCar, addHeat } from './entities.js';
import { startMission } from './missions.js';

const SAMPLE = STEP;

function roadLine(n) {
  return n * WORLD.roadSpacing + WORLD.roadWidth / 2;
}

/** Steer a car toward a point far ahead on the same road line. */
function driveAlong(state, tx, ty) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (!car) return { up: false, down: false, left: false, right: false, shift: false };
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    up: true, down: false,
    left: diff < -0.06, right: diff > 0.06,
    shift: false,
  };
}

/** Walk on foot toward a point. */
function walkToward(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  return {
    up: dy < -12, down: dy > 12,
    left: dx < -12, right: dx > 12,
    shift: false,
  };
}

function simulate(state, seconds, steerFn) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    state.stepWorld(SAMPLE, steerFn ? steerFn(state) : {});
  }
}

function putPlayerInCar(state, modelId, x, y, angle) {
  const car = makeCar(modelId, x, y, angle, 'player');
  state.cars.push(car);
  state.player.carId = car.id;
  state.ownedCarId = car.id;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

/**
 * Set the world to the named scene and return the screen to draw.
 * cover: 3-star chase east along Downtown with the heli overhead.
 * city: dusk drive along the Marina with traffic and pedestrians.
 * mission: The Vault in progress — on foot outside the bank, heat rising.
 * night: 4-star roadblock at night under the heli spotlight.
 */
export function stageShot(name, state) {
  state.resetWorld(1);
  const L = state.city.landmarks;
  if (name === 'city') {
    state.timeOfDay = 18.2;
    putPlayerInCar(state, 'sedan', 700, roadLine(7), 0);
    state.player.health = 100;
    simulate(state, 14, (s) => driveAlong(s, 2900, roadLine(7)));
    return 'play';
  }
  if (name === 'mission') {
    state.timeOfDay = 11.0;
    state.player.x = L.bank.x + 60;
    state.player.y = L.bank.y + 80;
    state.player.health = 82;
    startMission(state, 4);
    simulate(state, 3, (s) => walkToward(s, L.bank.x, L.bank.y));
    // escape in a stolen coupe, east along the Downtown road
    putPlayerInCar(state, 'coupe', 900, roadLine(5), 0);
    simulate(state, 4, (s) => driveAlong(s, 2800, roadLine(5)));
    return 'play';
  }
  if (name === 'night') {
    state.timeOfDay = 22.0;
    putPlayerInCar(state, 'sport', 900, roadLine(4), 0);
    addHeat(state, 78, 'night heat');
    state.wanted = 4;
    simulate(state, 9, (s) => driveAlong(s, 2600, roadLine(4)));
    return 'play';
  }
  // cover: the chase
  state.timeOfDay = 16.4;
  putPlayerInCar(state, 'sport', 500, roadLine(5), 0);
  addHeat(state, 64, 'chase heat');
  state.wanted = 3;
  simulate(state, 11, (s) => driveAlong(s, 2800, roadLine(5)));
  return 'play';
}
