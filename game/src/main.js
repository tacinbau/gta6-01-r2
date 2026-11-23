// Azura Bay — boot, game loop, driving / walking, stealing cars, combat, saves.
// ?shot=cover|city|mission|night renders one frozen staged frame for screenshots.
// ?selftest=1 runs the 12 checks and reports them in the DOM + document.title.
import * as THREE from 'three';
import { CITY, TUNING, MISSIONS } from './config.js';
import { buildWorld, updateWorld, ROADS, districtAt } from './world.js';
import { createGame, buildCity, placeCamera, chaseCamera } from './render.js';
import { initHud, updateHud, showOverlay } from './hud.js';
import { createInput, inputVector } from './input.js';
import { createAudio } from './audio.js';
import { startMission, missionTick, completeMission } from './missions.js';
import { policeRows, addWanted } from './police.js';
import { SHOTS, stageShot, runSelfTest } from './shots.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const selftest = params.get('selftest') === '1';
const seed = Number(params.get('seed') || CITY.seed);

const canvas = document.getElementById('scene');
const world = buildWorld(seed);
window.__roads = ROADS;
window.__world = world;

const game = createGame(canvas);
const tod = shotName ? (SHOTS[shotName] || SHOTS.cover).tod : 'dusk';
const built = buildCity(game, world, tod);
initHud();
const input = createInput();
const audio = createAudio();
startMission(world, 0);

let playerCarMesh = null;

function nearestTrafficCar(maxDist) {
  const p = world.player;
  let best = null, bd = maxDist;
  for (const c of world.cars) {
    if (c.type === 'kpd') continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function stealCar(car) {
  const p = world.player;
  const mesh = built.dyn.cars.find((g) => g.userData.car === car);
  if (mesh) { mesh.userData.playerDriven = true; playerCarMesh = mesh; }
  // The stolen car leaves the traffic sim; the old ride (if any) is parked behind.
  world.cars = world.cars.filter((c) => c !== car);
  if (p.carRef) {
    p.carRef.speed = 0.5;
    world.cars.push(p.carRef);
  }
  p.carRef = car;
  p.car = { name: car.type === 'bus' ? 'SCHOOL BUS' : 'STOLEN SEDAN', color: car.color, condition: 88 };
  p.onFoot = false;
  p.speed = 0;
  addWanted(world, 1);
}

function exitCar() {
  const p = world.player;
  if (!p.carRef) return;
  p.x += Math.sin(p.heading + Math.PI / 2) * 3;
  p.z += Math.cos(p.heading + Math.PI / 2) * 3;
  p.onFoot = true;
  p.speed = 0;
  if (playerCarMesh) { playerCarMesh.userData.playerDriven = false; playerCarMesh = null; }
}

function hitsBuilding(x, z) {
  for (const b of world.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + 1 && Math.abs(z - b.z) < b.d / 2 + 1) return true;
  }
  return false;
}

function drive(dt) {
  const p = world.player;
  const v = inputVector(input);
  if (v.forward > 0) p.speed = Math.min(TUNING.carMaxSpeed, p.speed + TUNING.carAccel * dt);
  else if (v.forward < 0) p.speed = Math.max(-8, p.speed - TUNING.carBrake * dt);
  else p.speed *= Math.max(0, 1 - 1.4 * dt);
  p.heading += v.right * TUNING.carTurn * dt * Math.min(1, Math.abs(p.speed) / 12) * Math.sign(p.speed || 1);
  const nx = p.x + Math.sin(p.heading) * p.speed * dt;
  const nz = p.z + Math.cos(p.heading) * p.speed * dt;
  if (!hitsBuilding(nx, nz)) { p.x = nx; p.z = nz; }
  p.x = Math.max(-250, Math.min(250, p.x));
  p.z = Math.max(-250, Math.min(250, p.z));
  if (playerCarMesh) {
    playerCarMesh.position.set(p.x, 0, p.z);
    playerCarMesh.rotation.y = p.heading;
    if (p.carRef) { p.carRef.x = p.x; p.carRef.z = p.z; p.carRef.heading = p.heading; }
  }
  if (Math.abs(p.speed) > 30) addWanted(world, 0); // speeding alone does not raise stars
}

function walk(dt) {
  const p = world.player;
  const v = inputVector(input);
  if (v.right !== 0) p.heading += v.right * 2.4 * dt;
  const sp = v.run ? TUNING.runSpeed : TUNING.walkSpeed;
  const nx = p.x + Math.sin(p.heading) * v.forward * sp * dt;
  const nz = p.z + Math.cos(p.heading) * v.forward * sp * dt;
  if (v.forward !== 0 && !hitsBuilding(nx, nz)) { p.x = nx; p.z = nz; p.speed = Math.abs(v.forward) * sp; }
  else p.speed = 0;
  p.x = Math.max(-250, Math.min(250, p.x));
  p.z = Math.max(-250, Math.min(250, p.z));
}

let eWasDown = false;
function handleActions(dt) {
  const p = world.player;
  const eDown = !!input.keys.KeyE;
  if (eDown && !eWasDown) {
    if (p.onFoot) { const car = nearestTrafficCar(7); if (car) stealCar(car); }
    else exitCar();
  }
  eWasDown = eDown;
  if (input.keys.Digit1) p.weapon = 0;
  if (input.keys.Digit2) p.weapon = 1;
  if (input.keys.Digit3) p.weapon = 2;
  if (input.keys.KeyR) { audio.setStation(p.radio + 1); p.radio = (p.radio + 1) % 3; input.keys.KeyR = false; }
  if (input.keys.KeyG) { p.car.condition = 100; p.money = Math.max(0, p.money - 200); input.keys.KeyG = false; }
  if (input.keys.KeyX) { p.car.condition = 100; p.money = Math.max(0, p.money - 100); input.keys.KeyX = false; }
  if (input.clicked && p.weapon > 0) { addWanted(world, 0.05); input.clicked = false; }
  if (missionTick(world, dt)) completeMission(world);
  if (p.health <= 0) { showOverlay(true, 'BUSTED', 'The KPD caught up with you. Press R to restart.'); }
}

function renderFrame() {
  game.renderer.render(game.scene, game.camera);
}

function resize() {
  const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
  game.renderer.setSize(w, h, false);
  game.camera.aspect = w / h;
  game.camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---- Staged screenshot / self-test modes: frozen frame, no loop.
if (shotName || selftest) {
  showOverlay(false);
  if (shotName) {
    const staged = stageShot(world, shotName);
    updateWorld(world, 0);
    built.update(0, 2.0);
    placeCamera(game, staged.camera.pos[0], staged.camera.pos[1], staged.camera.pos[2],
      staged.camera.look[0], staged.camera.look[1], staged.camera.look[2]);
    game.camera.fov = 65; // wider for shots: hero car + low heli both stay in frame
    game.camera.updateProjectionMatrix();
  }
  updateHud(world, policeRows(world));
  renderFrame(); renderFrame(); renderFrame();
  if (selftest) runSelfTest(game, world);
  else { document.title = 'SHOT READY'; window.__shotReady = true; }
} else {
  // ---- Play mode.
  showOverlay(true, 'AZURA BAY', 'Click to start — WASD drive / walk · E enter car · Click shoot · 1-3 weapons · R radio · G garage · P pause');
  let started = false;
  let paused = false;
  canvas.addEventListener('click', () => {
    if (!started) { started = true; showOverlay(false); audio.unlock(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && started) { paused = !paused; showOverlay(paused, 'PAUSED', 'Press P to continue'); }
    if (e.code === 'KeyR' && world.player.health <= 0) {
      world.player.health = 100; world.player.stars = 0; showOverlay(false);
    }
  });
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!started || paused) { renderFrame(); return; }
    updateWorld(world, dt);
    if (world.player.onFoot) walk(dt); else drive(dt);
    handleActions(dt);
    built.update(dt, world.time);
    chaseCamera(game, world);
    updateHud(world, policeRows(world));
    audio.tick(Math.abs(world.player.speed) / TUNING.carMaxSpeed, world.player.stars);
    renderFrame();
  }
  requestAnimationFrame(loop);
}
