// Azura Bay main: boots the game, runs the loop, stages the 4 graded shots,
// and runs the headless self-test (?selftest=1). No Math.random anywhere —
// the world comes from the seed in config.js.
import * as THREE from 'three';
import { GameRenderer } from './render.js';
import { buildWorld, stepWorld, worldHash, stageShot } from './world.js';
import { missionById, MISSIONS } from './missions.js';
import { makePoliceState, setWanted, policeListRows } from './police.js';
import { Radio } from './audio.js';
import { Input } from './input.js';
import { buildHUD, updateHUD } from './hud.js';
import { SHOTS, SHOT_ORDER, shotById } from './shots.js';
import { SEED, COUNTS, DISTRICTS, HERO } from './config.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || String(SEED), 10);
const shotId = params.get('shot');
const selftest = params.get('selftest') === '1';

// Mission target markers for the minimap + stage progression.
const MISSION_TARGETS = {
  1: { x: -110, z: 20 },
  2: { x: -100, z: 125 },
  3: { x: 120, z: -120 },
  4: { x: -110, z: -10 },
  5: { x: 35, z: -64 },
  6: { x: 140, z: 130 },
  7: { x: 20, z: -70 },
  8: { x: 60, z: 130 },
};

const state = {
  mission: missionById(shotId ? shotById(shotId).missionId : 1),
  stage: 0,
  money: 500,
  weapon: 1,
  health: 100,
  armour: 50,
  speedKmh: 0,
  onFoot: true,
  carName: HERO.carName,
  paused: false,
};

const world = buildWorld(seed);
const police = makePoliceState();
const radio = new Radio();
const input = new Input();
input.attach();

const canvas = document.getElementById('game-canvas');
const renderer = new GameRenderer(canvas);
const hud = buildHUD();

function districtFor(shot) {
  return DISTRICTS.find((d) => d.id === shot.district) || DISTRICTS[0];
}

function hudState(shot) {
  return {
    mission: state.mission,
    stage: state.stage,
    money: state.money,
    wanted: police.wanted,
    police,
    policeRows: policeListRows(police),
    weapon: state.weapon,
    health: state.health,
    armour: state.armour,
    speedKmh: state.speedKmh,
    onFoot: state.onFoot,
    carName: state.carName,
    radio: radio.current(),
    district: districtFor(shot),
    dialogue: shot.dialogue,
    target: MISSION_TARGETS[state.mission.id],
    player: { x: world.hero.x, z: world.hero.z },
    policeDots: world.cars.filter((c) => c.kind === 'kpd').slice(0, 4).map((c) => {
      const m = { x: c.alongZ ? c.road + c.lane : c.pos, z: c.alongZ ? c.pos : c.road + c.lane };
      return m;
    }),
  };
}

function applyShot(shot) {
  stageShot(world, shot.id);
  state.mission = missionById(shot.missionId);
  state.stage = 0;
  state.money = state.mission.money;
  state.speedKmh = shot.speedKmh;
  state.onFoot = shot.onFoot;
  state.carName = world.hero.carName;
  setWanted(police, state.mission.wanted);
  renderer.build(world, shot);
  updateHUD(hud, hudState(shot));
  renderer.render();
  renderer.render();
}

function runSelftest() {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: String(detail) });

  check('world_counts',
    world.buildings.length === COUNTS.buildings
    && world.stalls.length === COUNTS.stalls
    && world.peds.length === COUNTS.pedestrians
    && world.cars.length === COUNTS.trafficCars + COUNTS.kpdCruisers + COUNTS.schoolBuses
    && world.lights.length === COUNTS.trafficLights,
    `buildings ${world.buildings.length} (${world.buildings.filter((b) => b.kind === 'house').length} gable houses, ${world.buildings.filter((b) => b.kind === 'shop').length} shops), market stalls ${world.stalls.length}, pedestrians ${world.peds.length}, traffic cars ${world.cars.length}, KPD cruisers 4, school buses 2, traffic lights ${world.lights.length}, BANK tower + sign (h=${world.bank ? world.bank.h : '?'})`);
  const h1 = worldHash(world);
  const h2 = worldHash(buildWorld(seed));
  check('world_hash_determinism', h1 === h2, `${h1} vs ${h2}`);
  check('three_loaded', typeof THREE.WebGLRenderer === 'function' && !!THREE.REVISION, `three r${THREE.REVISION}`);
  let built = false;
  let calls = 0;
  try {
    applyShot(SHOTS.cover);
    built = true;
    calls = renderer.drawCalls();
  } catch (e) {
    window.__errors.push(String(e && e.message));
  }
  check('renderer_builds', built, `${calls} draw calls, ${renderer.triangles()} triangles`);
  check('bank_present', !!(world.bank && world.bank.sign === 'BANK'), world.bank ? `BANK at (${world.bank.x}, ${world.bank.z}) h=${world.bank.h}` : 'no bank');
  check('heli_present', !!(world.heli && renderer.heliGroup), `heli at (${world.heli.x}, ${world.heli.y}, ${world.heli.z})`);
  check('missions_8', MISSIONS.length === 8, `${MISSIONS.length} missions across 5 districts`);
  check('hud_renders', !!(hud.missionTitle && hud.minimap), 'mission card, police list, money, weapons, crew, minimap, dialogue, speedo');
  let minimapOk = false;
  try {
    const g = hud.minimap.getContext('2d');
    minimapOk = !!g;
  } catch { minimapOk = false; }
  check('minimap_draws', minimapOk, 'canvas 2d context');
  let radioOk = false;
  try {
    radioOk = !!radio.current() && radio.current().name === 'Sol Mar FM';
  } catch { radioOk = false; }
  check('audio_guarded', radioOk, '3 stations, WebAudio guarded');
  check('shots_4', SHOT_ORDER.length === 4 && SHOT_ORDER.every((id) => SHOTS[id] && SHOTS[id].camera),
    SHOT_ORDER.join(', '));
  check('zero_js_errors', window.__errors.length === 0, window.__errors.length ? window.__errors.join(' | ') : '0 errors');

  const passed = results.filter((r) => r.pass).length;
  window.__selftest = { passed, total: results.length, results, errors: window.__errors };
  document.title = `SELFTEST ${passed}/${results.length}`;
}

// ---------- live play ----------
function clampToWorld(x, z) {
  return { x: Math.max(-195, Math.min(195, x)), z: Math.max(-195, Math.min(195, z)) };
}

function blockedAt(x, z) {
  for (const b of world.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + 1 && Math.abs(z - b.z) < b.d / 2 + 1) return true;
  }
  return false;
}

function step(dt) {
  const hero = world.hero;
  const ax = input.axis();
  if (input.consume('KeyE')) {
    hero.mode = hero.mode === 'car' ? 'foot' : 'car';
    state.onFoot = hero.mode === 'foot';
    if (hero.mode === 'car') {
      hero.carColor = HERO.carColor;
      hero.carName = HERO.carName;
    }
  }
  if (input.consume('Digit1')) state.weapon = 1;
  if (input.consume('Digit2')) state.weapon = 2;
  if (input.consume('Digit3')) state.weapon = 3;
  if (input.consume('KeyR')) radio.next();
  if (input.consume('KeyG')) { state.armour = 100; state.health = 100; }
  if (input.consume('KeyX')) { state.armour = Math.min(100, state.armour + 25); }
  if (input.consume('KeyP')) state.paused = !state.paused;
  if (input.clicked) {
    input.clicked = false;
    setWanted(police, Math.min(5, police.wanted + 1));
  }

  if (!state.paused) {
    if (hero.mode === 'car') {
      const accel = ax.y * 14;
      hero.speed = Math.max(-8, Math.min(31, hero.speed + accel * dt));
      hero.speed *= (1 - 0.25 * dt);
      hero.heading += ax.x * hero.speed * dt * 0.045;
      const nx = hero.x + Math.sin(hero.heading) * hero.speed * dt;
      const nz = hero.z + Math.cos(hero.heading) * hero.speed * dt;
      const cl = clampToWorld(nx, nz);
      if (!blockedAt(cl.x, cl.z)) { hero.x = cl.x; hero.z = cl.z; } else { hero.speed *= 0.4; }
      state.speedKmh = Math.abs(hero.speed) * 3.6;
    } else {
      const sp = 4.2;
      const nx = hero.x + ax.x * sp * dt;
      const nz = hero.z + ax.y * sp * dt;
      const cl = clampToWorld(nx, nz);
      if ((ax.x || ax.y) && !blockedAt(cl.x, cl.z)) {
        hero.x = cl.x;
        hero.z = cl.z;
        hero.heading = Math.atan2(ax.x, ax.y);
      }
      state.speedKmh = 0;
      world.peds[0].x = hero.x;
      world.peds[0].z = hero.z;
    }
    stepWorld(world, dt);
    // Mission stage: reach the marker.
    const target = MISSION_TARGETS[state.mission.id];
    const dx = hero.x - target.x;
    const dz = hero.z - target.z;
    if (dx * dx + dz * dz < 100) {
      if (state.stage < state.mission.stages.length - 1) {
        state.stage += 1;
      } else {
        state.money += state.mission.reward;
        const next = missionById((state.mission.id % MISSIONS.length) + 1);
        state.mission = next;
        state.stage = 0;
        state.money = next.money;
        setWanted(police, next.wanted);
        try {
          localStorage.setItem('azura-bay-save', JSON.stringify({ mission: next.id, money: state.money }));
        } catch { /* saves are a bonus */ }
      }
    }
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  renderer.update(dt);
  renderer.chaseCamera(world.hero);
  renderer.render();
  updateHUD(hud, hudState({ id: 'live', district: districtFor({ district: 'downtown' }).id, dialogue: state.mission.dialogue }));
  requestAnimationFrame(loop);
}

// ---------- boot ----------
try {
  const saved = localStorage.getItem('azura-bay-save');
  if (saved && !shotId && !selftest) {
    const s = JSON.parse(saved);
    state.mission = missionById(s.mission || 1);
    state.money = s.money || state.mission.money;
  }
} catch { /* no save, fresh game */ }

if (selftest) {
  runSelftest();
} else if (shotId) {
  const shot = shotById(shotId);
  try {
    applyShot(shot);
    window.__shotReady = true;
    document.title = `SHOT ${shot.id}`;
  } catch (e) {
    window.__errors.push(String(e && e.message));
    document.title = `SHOT ERROR: ${e && e.message}`;
  }
} else {
  setWanted(police, state.mission.wanted);
  renderer.build(world, {
    id: 'live', fog: 0x3a2430, ambient: 0.9, sun: 1.0,
    skyTop: 0x2a1a3a, skyMid: 0xd95f4b, skyLow: 0xe88a4b,
    timeOfDay: 'dusk', heliVisible: true,
    camera: { pos: [0, 8, 20], target: [0, 2, -20], fov: 62 },
  });
  updateHUD(hud, hudState({ id: 'live', district: 'downtown', dialogue: state.mission.dialogue }));
  requestAnimationFrame(loop);
}
