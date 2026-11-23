// Azura Bay — bootstrap, game loop and screen state machine.
// Title, play, pause, jobs, garage, crew, busted, wasted and won screens.
// Screenshot mode (?shot=cover|city|mission|night) stages one deterministic
// frame and renders it once; self-test mode (?selftest=1) checks invariants.
import { WORLD, DISTRICTS, PLAYER, CAR_MODELS, UPGRADES, WEAPONS, STEP, VIEW_W, VIEW_H } from './config.js';
import { makeRng, clamp } from './random.js';
import { buildCity } from './world.js';
import {
  makeCar, spawnParkedCars, spawnTraffic, spawnPeds,
  updatePlayerCar, updatePlayerOnFoot, updateTraffic, updatePeds,
  updateWanted, ensurePolice, updatePolice, updateBullets, collideCars,
  tryEnterCar, fireBullet, addHeat,
} from './entities.js';
import { MISSIONS, startMission, updateMission, failMission } from './missions.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { ensureAudio, resumeAudio, sfx, startRadio, stopRadio, radioName } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const selftest = params.get('selftest') === '1';

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error));
  const node = document.getElementById('err');
  if (node) node.textContent = window.__errors.join(' | ');
});

const canvas = document.getElementById('game');
const input = createInput();
input.attachCanvas(canvas);
const renderer = createRenderer(canvas);

function freshState(seedValue) {
  const rng = makeRng(seedValue);
  const city = buildCity(seedValue);
  const standing = {};
  for (const d of DISTRICTS) standing[d.id] = 0;
  return {
    rng, city, seed: seedValue,
    time: 0, timeOfDay: 10.5,
    cash: PLAYER.startCash, jobsDone: 0,
    standing, crew: { rook: false, vera: false }, crewActive: null,
    garage: { owned: ['sedan'], upgrades: { engine: 0, tires: 0, armor: 0 }, current: 'sedan' },
    weapons: ['fists'], ammo: { pistol: 60, smg: 0 },
    wanted: 0, wantedHeat: 0, lastCrime: -99, lastCrimeReason: '',
    police: [], roadblocks: [], lastRoadblock: -99,
    heli: { active: false, x: 0, y: 0, angle: 0, rotor: 0 },
    bustTimer: 0, busted: false, wasted: false, gameWon: false, wonShown: false,
    bullets: [], particles: [], muzzle: 0, fireCooldown: 0,
    mission: null, missionObjective: '',
    toast: '', toastTime: 0,
    radio: 0, radioOn: true,
    cars: [], peds: [],
    player: { x: 420, y: 460, angle: 0, carId: null, health: PLAYER.maxHealth, weapon: 'fists' },
    ownedCarId: null,
    MISSIONS,
  };
}

let state = freshState(seed);

function resetWorld(seedValue) {
  const next = freshState(seedValue);
  for (const key of Object.keys(next)) state[key] = next[key];
  spawnParkedCars(state, state.rng);
  spawnTraffic(state, 16);
  spawnPeds(state, 34);
}

state.resetWorld = resetWorld;

function stepWorld(dt, inputState) {
  state.time += dt;
  state.timeOfDay = (state.timeOfDay + dt / 240) % 24;
  if (state.toastTime > 0) state.toastTime -= dt;
  for (const pt of state.particles) pt.life -= dt;
  state.particles = state.particles.filter((pt) => pt.life > 0);
  if (state.fireCooldown > 0) state.fireCooldown -= dt;

  if (state.player.carId) updatePlayerCar(state, dt, inputState);
  else updatePlayerOnFoot(state, dt, inputState);

  // shooting (on foot only)
  if (!state.player.carId && inputState.mouseDown && state.fireCooldown <= 0) {
    const w = WEAPONS.find((x) => x.id === state.player.weapon);
    if (w && w.id !== 'fists' && (state.ammo[w.id] || 0) > 0) {
      const s = state.player;
      const rect = canvas.getBoundingClientRect();
      const mx = inputState.mouseX;
      const my = inputState.mouseY;
      const camX = clamp(s.x - VIEW_W / 2 / 0.9, -100, WORLD.size - VIEW_W / 0.9 + 100);
      const camY = clamp(s.y - VIEW_H / 2 / 0.9, -100, WORLD.size - VIEW_H / 0.9 + 100);
      const wx = camX + mx / 0.9;
      const wy = camY + my / 0.9;
      const angle = Math.atan2(wy - s.y, wx - s.x);
      fireBullet(state, s.x, s.y, angle, w.damage, 'player');
      state.ammo[w.id] -= 1;
      state.fireCooldown = w.rate;
      sfx('shot');
    } else if (w && w.id === 'fists' && inputState.mouseClicked) {
      const s = state.player;
      for (const ped of state.peds) {
        if (Math.hypot(ped.x - s.x, ped.y - s.y) < 40) {
          ped.hp -= w.damage;
          if (ped.hp <= 0) {
            ped.dead = true;
            addHeat(state, 12, 'ped down');
          }
        }
      }
      state.fireCooldown = w.rate;
    }
  }

  updateTraffic(state, dt);
  updatePeds(state, dt);
  ensurePolice(state);
  updatePolice(state, dt);
  updateWanted(state, dt);
  updateBullets(state, dt);
  collideCars(state, dt);
  updateMission(state, dt);

  // the player's car can be wrecked: eject the player on foot
  const pc = state.cars.find((c) => c.id === state.player.carId);
  if (pc && pc.hp <= 0) {
    for (let i = 0; i < 10; i += 1) {
      state.particles.push({ x: pc.x, y: pc.y, life: 0.7, color: '#e74c3c' });
    }
    state.cars = state.cars.filter((c) => c.id !== pc.id);
    state.player.carId = null;
    state.player.x = pc.x + 30;
    state.player.y = pc.y + 30;
    toast('Your car is wrecked!');
  }

  if (state.busted) {
    state.screen = 'busted';
    state.busted = false;
  } else if (state.wasted) {
    state.screen = 'wasted';
    state.wasted = false;
  } else if (state.gameWon && !state.wonShown) {
    state.wonShown = true;
    state.screen = 'won';
  }
}

state.stepWorld = stepWorld;

function toast(msg) {
  state.toast = msg;
  state.toastTime = 3;
}

function respawn() {
  const hospital = state.city.landmarks.hospital;
  state.player.x = hospital.x + 40;
  state.player.y = hospital.y + 60;
  state.player.carId = null;
  state.player.health = PLAYER.maxHealth;
  state.wanted = 0;
  state.wantedHeat = 0;
  state.cash = Math.max(0, state.cash - 200);
  state.police = [];
  state.roadblocks = [];
  state.heli.active = false;
  if (state.mission) failMission(state, 'you were taken in');
  state.screen = 'play';
}

function startNewGame() {
  resetWorld(seed);
  state.screen = 'play';
  toast('Welcome to Azura Bay — press J for jobs');
}

function continueSave() {
  const data = loadGame();
  if (!data) return false;
  resetWorld(seed);
  state.cash = data.cash;
  state.jobsDone = data.jobsDone;
  state.standing = data.standing;
  state.crew = data.crew;
  state.garage = data.garage;
  state.weapons = data.weapons;
  state.ammo = data.ammo;
  state.player.health = data.health;
  state.player.x = data.playerX;
  state.player.y = data.playerY;
  state.screen = 'play';
  toast('Save loaded — welcome back to Azura Bay');
  return true;
}

function spawnGarageCar(modelId) {
  const g = state.city.landmarks.garage;
  const car = makeCar(modelId, g.x + 80, g.y + 40, 0, 'player');
  const up = state.garage.upgrades;
  car.top += up.engine * 45;
  car.accel += up.engine * 40;
  car.grip = Math.min(0.99, car.grip + up.tires * 0.015);
  car.maxHp += up.armor * 60;
  car.hp = car.maxHp;
  state.cars.push(car);
  state.ownedCarId = car.id;
  state.player.x = g.x + 80;
  state.player.y = g.y + 90;
  state.player.carId = null;
  return car;
}

function buyOrSelectCar(index) {
  const models = CAR_MODELS;
  const m = models[index];
  if (!m) return;
  if (state.garage.owned.includes(m.id)) {
    state.garage.current = m.id;
    spawnGarageCar(m.id);
    state.screen = 'play';
    toast(`${m.name} ready at the garage`);
    return;
  }
  const discount = 1 - 0.05 * Object.values(state.standing).reduce((a, b) => a + b, 0);
  const price = Math.round(m.price * Math.max(0.5, discount));
  if (state.cash >= price) {
    state.cash -= price;
    state.garage.owned.push(m.id);
    state.garage.current = m.id;
    spawnGarageCar(m.id);
    state.screen = 'play';
    toast(`Bought the ${m.name} for $${price}`);
    sfx('cash');
  } else {
    toast(`Need $${price} — you have $${state.cash}`);
  }
}

function upgrade(kind) {
  const up = state.garage.upgrades;
  const level = up[kind];
  if (level >= 3) {
    toast(`${kind} is already maxed`);
    return;
  }
  const cost = [400, 900, 1600][level];
  if (state.cash < cost) {
    toast(`Need $${cost} for ${kind} Lv${level + 1}`);
    return;
  }
  state.cash -= cost;
  up[kind] = level + 1;
  toast(`${kind} upgraded to Lv${level + 1}`);
  sfx('cash');
}

function handleKeys() {
  const p = input.state.pressed;
  const screen = state.screen || 'title';
  if (screen === 'title') {
    if (p.Enter) startNewGame();
    else if (p.KeyC && hasSave()) continueSave();
    return;
  }
  if (screen === 'play') {
    if (p.KeyJ) {
      state.screen = 'jobs';
      return;
    }
    if (p.KeyP || p.Escape) {
      state.screen = 'pause';
      return;
    }
    if (p.KeyE) {
      tryEnterCar(state);
      return;
    }
    if (p.KeyF) {
      toast(saveGame(state) ? 'Game saved' : 'Save failed');
      return;
    }
    if (p.KeyR) {
      if (state.radioOn && state.radio < 2) state.radio += 1;
      else if (state.radioOn) {
        state.radioOn = false;
        stopRadio();
      } else {
        state.radioOn = true;
        state.radio = 0;
        ensureAudio();
        startRadio(state.radio);
      }
      if (state.radioOn) {
        ensureAudio();
        startRadio(state.radio);
      }
      toast(state.radioOn ? radioName(state.radio) : 'Radio off');
      return;
    }
    if (p.KeyG) {
      const g = state.city.landmarks.garage;
      if (Math.hypot(state.player.x - g.x, state.player.y - g.y) < 160) state.screen = 'garage';
      else toast('Garage is at Cleo\u2019s — marked on the minimap');
      return;
    }
    if (p.Tab) {
      state.screen = 'crew';
      return;
    }
    if (p.Digit1 || p.Digit2 || p.Digit3) {
      const w = WEAPONS[parseInt((p.Digit1 ? '1' : p.Digit2 ? '2' : '3'), 10) - 1];
      if (state.weapons.includes(w.id)) {
        state.player.weapon = w.id;
        toast(w.name);
      } else {
        const price = w.price;
        if (state.cash >= price) {
          state.cash -= price;
          state.weapons.push(w.id);
          state.ammo[w.id] = w.ammo;
          state.player.weapon = w.id;
          toast(`Bought the ${w.name}`);
          sfx('cash');
        } else {
          toast(`${w.name} costs $${price} — visit the garage area to buy`);
        }
      }
      return;
    }
    return;
  }
  if (screen === 'pause') {
    if (p.KeyP || p.Escape) state.screen = 'play';
    else if (p.KeyF) toast(saveGame(state) ? 'Game saved' : 'Save failed');
    else if (p.KeyG) state.screen = 'garage';
    return;
  }
  if (screen === 'jobs') {
    if (p.KeyJ || p.Escape) {
      state.screen = 'play';
      return;
    }
    for (let i = 0; i < 8; i += 1) {
      if (p[`Digit${i + 1}`] && i === state.jobsDone) {
        if (startMission(state, i)) {
          state.screen = 'play';
          toast(`${MISSIONS[i].name} — ${MISSIONS[i].brief}`);
        }
        return;
      }
    }
    return;
  }
  if (screen === 'garage') {
    if (p.KeyG || p.Escape) {
      state.screen = 'play';
      return;
    }
    for (let i = 0; i < 5; i += 1) {
      if (p[`Digit${i + 1}`]) {
        buyOrSelectCar(i);
        return;
      }
    }
    if (p.KeyU) upgrade('engine');
    else if (p.KeyI) upgrade('tires');
    else if (p.KeyO) upgrade('armor');
    return;
  }
  if (screen === 'crew') {
    if (p.Tab || p.Escape) {
      state.screen = 'play';
      return;
    }
    if (p.Digit1 && state.crew.rook) {
      state.crewActive = 'rook';
      state.screen = 'play';
      toast('Rook is riding with you');
    } else if (p.Digit2 && state.crew.vera) {
      state.crewActive = 'vera';
      state.screen = 'play';
      toast('Vera is on comms');
    } else if (p.Digit3) {
      state.crewActive = null;
      state.screen = 'play';
      toast('Going solo');
    }
    return;
  }
  if (screen === 'busted' || screen === 'wasted' || screen === 'won') {
    if (p.Enter) {
      if (screen === 'won') state.screen = 'play';
      else respawn();
    }
  }
}

let last = 0;
let acc = 0;

function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  let dt = (ts - last) / 1000;
  last = ts;
  if (dt > 0.25) dt = 0.25;
  handleKeys();
  if (state.screen === 'play') {
    acc += dt;
    while (acc >= STEP) {
      stepWorld(STEP, input.state);
      acc -= STEP;
    }
  }
  renderer.render(state, input.state, state.screen || 'title');
  input.endFrame();
}

function runSelfTest() {
  const results = [];
  const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  try {
    resetWorld(1);
    check('city has buildings', state.city.buildings.length > 100);
    check('parked cars spawned', state.cars.length >= 20);
    check('traffic spawned', state.cars.filter((c) => c.owner === 'traffic').length >= 10);
    check('peds spawned', state.peds.length >= 20);
    check('landmarks present', Object.keys(state.city.landmarks).length === 9);
    startMission(state, 0);
    check('mission 0 starts', !!state.mission);
    for (let i = 0; i < 600; i += 1) stepWorld(STEP, {});
    check('600 steps without error', true);
    check('player still alive', state.player.health > 0);
    addHeat(state, 60, 'test');
    for (let i = 0; i < 300; i += 1) stepWorld(STEP, {});
    check('police spawn at heat', state.police.length > 0);
    check('wanted stars set', state.wanted >= 2);
    for (let i = 0; i < 3600; i += 1) stepWorld(STEP, {});
    check('3600 more steps without error', true);
  } catch (e) {
    results.push(`FAIL exception: ${e.message}`);
  }
  const node = document.getElementById('selftest');
  if (node) node.textContent = results.join('\n');
  document.title = results.every((r) => r.startsWith('PASS')) ? 'SELFTEST PASS' : 'SELFTEST FAIL';
  window.__selftest = results;
}

// ---- boot ----
state.screen = 'title';
if (shotName) {
  state.screen = stageShot(shotName, state);
  renderer.render(state, input.state, state.screen);
  document.title = `shot:${shotName}`;
} else if (selftest) {
  runSelfTest();
  renderer.render(state, input.state, 'title');
} else {
  resetWorld(seed);
  if (state.radioOn) {
    window.addEventListener('keydown', () => {
      ensureAudio();
      resumeAudio();
      startRadio(state.radio);
    }, { once: true });
  }
  requestAnimationFrame(frame);
}
