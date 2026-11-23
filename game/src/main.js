// Boot and the one loop: input is read once per frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, garage, over and win.
// Actions are taken once per frame and handed to the first simulation step only, so a press
// is never lost and never counted twice.
//
// ?seed=N fixes the city. ?shot=cover|city|mission|night (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
// ?selftest=1 runs nine headless checks and sets window.__selftest with the results.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { EVENT_BUSTED, EVENT_MISSION, EVENT_WASTED, EVENT_WIN, createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_GARAGE, ACTION_PAUSE, ACTION_RADIO, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_GARAGE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Nine headless checks over a fresh world; the results land on window.__selftest. */
function runSelftest() {
  const checks = [];
  function check(name, fn) {
    try {
      checks.push({ name, pass: !!fn() });
    } catch (error) {
      checks.push({ name, pass: false, error: String(error && error.message ? error.message : error) });
    }
  }
  const test = createWorld(createRandom(7));
  const s = test.state;
  const idle = { axes: { x: 0, y: 0 }, aimX: s.player.x + 100, aimY: s.player.y, firing: false, actions: 0 };
  check('city builds', () => test.buildings.length > 50);
  check('traffic spawns', () => s.cars.filter((c) => c.kind === 'traffic').length >= 20);
  check('pedestrians spawn', () => s.peds.length >= 30);
  check('600 steps clean', () => {
    for (let i = 0; i < 600; i += 1) test.step(STEP, idle);
    return Number.isFinite(s.player.x) && Number.isFinite(s.player.y) && s.player.health > 0;
  });
  check('mission starts', () => s.mission !== null && s.mission.def.name === 'Errand Run');
  check('police spawn at heat', () => {
    s.heat = 65;
    for (let i = 0; i < 120; i += 1) test.step(STEP, idle);
    return s.cruisers.length >= 1;
  });
  check('mission advances', () => {
    const before = s.missionIndex;
    const target = s.objective;
    if (!target) return false;
    s.player.x = target.x;
    s.player.y = target.y;
    for (let i = 0; i < 30; i += 1) test.step(STEP, idle);
    return s.missionIndex > before || (s.mission && s.mission.stepIndex > 0);
  });
  check('renderer paints', () => {
    renderer.draw(test, s, SCREEN_PLAY, 0, { selected: 0 });
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 997) if (data[i] > 0) lit += 1;
    return lit > 0;
  });
  check('save/load round-trip', () => {
    s.cash = 1234;
    if (!test.save()) return false;
    s.cash = 0;
    if (!test.load()) return false;
    return s.cash === 1234;
  });
  window.__selftest = { pass: checks.every((c) => c.pass), checks };
  // Paint one frame so the page is not blank behind the result.
  renderer.draw(test, s, SCREEN_PLAY, 0, { selected: 0 });
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, world.state, scene.screen, scene.best, { selected: 0 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let overKind = '';
  let garage = { selected: 0 };
  let best = readSave();
  let accumulator = 0;
  let last = performance.now();
  let prevDown = false;

  function announce(message) {
    status.textContent = message;
  }

  function camera() {
    const p = world.state.player;
    return {
      x: Math.max(640, Math.min(3200 - 640, p.x)),
      y: Math.max(360, Math.min(2400 - 360, p.y)),
    };
  }

  function aimWorld() {
    const pointer = input.pointer();
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const ox = (rect.width - 1280 * scale) / 2;
    const oy = (rect.height - 720 * scale) / 2;
    const cam = camera();
    return {
      x: cam.x + (pointer.x - ox) / scale - 640,
      y: cam.y + (pointer.y - oy) / scale - 360,
    };
  }

  function startGame() {
    const save = readSave();
    if (save) {
      world.load();
      announce(`Welcome back. Mission ${world.state.missionIndex + 1} of 8.`);
    } else {
      world.reset();
      announce('Azura Bay. Cleo is waiting — find her in Old Town.');
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
  }

  function endRun(kind) {
    overKind = kind;
    screen = SCREEN_OVER;
    announce(kind === 'busted' ? 'Busted. The fine took $200.' : 'Wasted. The hospital took $200.');
  }

  function nearGarage() {
    const p = world.state.player;
    return Math.hypot(p.x - 1650, p.y - 1525) < 150;
  }

  // Garage keys are read here, not by the shared input: 1-5 buy/select a car, Z/X/C buy an
  // upgrade for the selected car, G or Esc leaves.
  window.addEventListener('keydown', (event) => {
    if (screen !== SCREEN_GARAGE) return;
    if (event.code === 'Escape' || event.code === 'KeyG') {
      screen = SCREEN_PLAY;
      return;
    }
    const num = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(event.code);
    if (num >= 0) {
      garage.selected = num;
      const defs = ['corto', 'brisa', 'toro', 'vela', 'cometa'];
      if (world.buyCar(defs[num])) audio.blip(990);
      return;
    }
    const defs = ['corto', 'brisa', 'toro', 'vela', 'cometa'];
    const defId = defs[garage.selected];
    if (event.code === 'KeyZ' && world.buyUpgrade(defId, 'engine')) audio.blip(990);
    else if (event.code === 'KeyX' && world.buyUpgrade(defId, 'tires')) audio.blip(990);
    else if (event.code === 'KeyC' && world.buyUpgrade(defId, 'armor')) audio.blip(990);
  });
  window.addEventListener('keydown', () => audio.unlock());
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function step(actions) {
    const pointer = input.pointer();
    const aim = aimWorld();
    const firing = pointer.down && (world.state.weapon === 2 || !prevDown);
    prevDown = pointer.down;
    const axes = input.axes();
    const events = world.step(STEP, { axes, aimX: aim.x, aimY: aim.y, firing, actions });
    if (events & 32) audio.gunshot();
    if (events & 16) audio.crash();
    if (events & EVENT_MISSION) {
      world.save();
      announce(world.state.banner || 'Mission done.');
    }
    if (events & EVENT_WIN) {
      world.save();
      screen = SCREEN_WIN;
      announce('Azura Bay is yours. All eight missions done.');
    } else if (events & EVENT_BUSTED) {
      endRun('busted');
    } else if (events & EVENT_WASTED) {
      endRun('wasted');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        startGame();
      } else {
        // The island idles behind the title: traffic rolls, nothing can hurt the player.
        world.step(STEP, { axes: { x: 0, y: 0 }, aimX: 0, aimY: 0, firing: false, actions: 0 });
      }
      world.state.radioName = audio.stationName();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        world.save();
        announce('Paused.');
      } else if (actions & ACTION_GARAGE && nearGarage()) {
        screen = SCREEN_GARAGE;
        announce('Azura Garage.');
      } else if (actions & ACTION_RADIO) {
        const name = audio.nextStation();
        world.state.radioName = name;
        world.state.banner = `Radio: ${name}`;
        world.state.bannerTimer = 2;
      }
      if (screen === SCREEN_PLAY) {
        let first = true;
        while (accumulator >= STEP) {
          step(first ? actions : 0);
          first = false;
          accumulator -= STEP;
          if (screen !== SCREEN_PLAY) break;
        }
        const p = world.state.player;
        const speed01 = p.inCar ? Math.min(1, Math.abs(p.speed) / 500) : 0;
        audio.update(speed01, Math.floor(world.state.heat / 20));
        // The light turns with the clock: day, then dusk, then night, then day again.
        const cycle = (world.state.time % 600) / 600;
        world.state.timeOfDay = cycle < 0.55 ? 0 : cycle < 0.75 ? 1 : 2;
        world.state.radioName = audio.stationName();
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      accumulator = 0;
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
      accumulator = 0;
    } else {
      accumulator = 0;
    }
    world.state.overKind = overKind;
    renderer.draw(world, world.state, screen, best ? best.missionsDone : 0, garage);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Paused.');
    }
  });

  announce('Azura Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (selftest) runSelftest();
else if (shot) runShot(shot);
else runGame();
