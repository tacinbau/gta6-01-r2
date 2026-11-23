// Staged screenshots + self-test. Shots are frozen at sim time t = 2.0 s:
// traffic lights read RED, traffic sits where the frame wants it, the heli is in view.
import { buildWorld, hashWorld, ROADS } from './world.js';
import { CITY } from './config.js';

export const SHOTS = {
  cover: { tod: 'dusk', mission: 3, money: 7270, stars: 2, label: 'Night market' },
  city: { tod: 'day', mission: 5, money: 18450, stars: 5, label: 'Beach chase' },
  mission: { tod: 'dusk', mission: 4, money: 500, stars: 2, label: 'Bank job' },
  night: { tod: 'night', mission: 0, money: 500, stars: 4, label: 'Night heli' },
};

function roadById(id) { return ROADS.find((r) => r.id === id); }

export function stageShot(world, name) {
  const shot = SHOTS[name] || SHOTS.cover;
  const p = world.player;
  world.time = 2.0;
  p.mission = shot.mission;
  p.missionProgress = name === 'mission' ? 0.55 : 0.1;
  p.money = shot.money;
  p.stars = shot.stars;
  p.health = 100; p.armour = 50; p.rp = 0; p.rank = 1;

  const boulevard = roadById('boulevard');
  const strip = roadById('strip');
  if (name === 'cover') {
    // Hero on foot in the market aisle, close to the camera so the red shirt reads,
    // facing WEST toward the camera — clear of the stalls.
    p.x = -138; p.z = -58; p.heading = -Math.PI / 2; p.speed = 0; p.onFoot = true;
    // Heli parked far behind the camera — the cover is about the market, not the heli.
    world.heli.x = -260; world.heli.z = -260; world.heli.y = 55; world.heli.fixed = true;
    return { tod: shot.tod, camera: { pos: [-165, 6, -60], look: [-100, 2, -60] } };
  }
  if (name === 'city') {
    p.x = 60; p.z = 40; p.heading = Math.PI / 2; p.speed = 31.1; p.onFoot = false;
    p.car = { name: 'RUKAN PELO GT', color: 0xe06a2a, condition: 100 };
    // Pack the boulevard: bus + KPD + traffic ahead and behind the hero.
    const cars = world.cars;
    const put = (car, road, s, speed) => { car.road = road; car.s = s; car.speed = speed; };
    let i = 0;
    const ahead = [262, 278, 296, 318, 342, 368, 392];
    const behind = [150, 178, 205, 228];
    for (const s of ahead) put(cars[i++], 'boulevard', s, 12);
    for (const s of behind) put(cars[i++], 'boulevard', s, 11);
    put(cars[i++], 'boulevard', 275, 9); // school bus ahead (type stays bus)
    put(cars[i++], 'boulevard', 232, 15); // KPD in pursuit
    put(cars[i++], 'boulevard', 305, 15); // KPD ahead
    // Heli low over the boulevard so it stays inside the frame (FOV 65, look tilted up).
    // Further ahead now, so the (slimmer) spotlight cone does not fill the left sky.
    world.heli.x = 110; world.heli.z = 10; world.heli.y = 34; world.heli.fixed = true;
    return { tod: shot.tod, camera: { pos: [42, 6, 40], look: [80, 4, 40] } };
  }
  if (name === 'mission') {
    p.x = 40; p.z = -18; p.heading = Math.PI; p.speed = 8.06; p.onFoot = false;
    p.car = { name: 'SOL COUPE', color: 0x2a5ae0, condition: 100 };
    // Downtown strip busy: traffic + parked cars both sides + a KPD cruiser.
    const cars = world.cars;
    const put = (car, road, s, lane, speed) => { car.road = road; car.s = s; car.lane = lane; car.speed = speed; };
    let i = 0;
    for (const s of [60, 88, 120, 150, 195, 225, 250]) put(cars[i++], 'strip', s, i % 2 ? -3.4 : 3.4, 10);
    for (const s of [100, 140, 175, 210]) put(cars[i++], 'strip', s, i % 2 ? -6.4 : 6.4, 0.5); // parked
    put(cars[i++], 'strip', 130, -3.4, 13); // KPD
    world.heli.x = 120; world.heli.z = -160; world.heli.y = 60; world.heli.fixed = true;
    // Camera further back and higher, so the blue coupe sits above the dialogue box.
    return { tod: shot.tod, camera: { pos: [40, 7, 2], look: [54, 10, -118] } };
  }
  // night — hero on foot on the downtown strip, heading north between the towers;
  // heli low ahead so it and its spotlight cone stay in frame.
  p.x = 40; p.z = 30; p.heading = Math.PI; p.speed = 0; p.onFoot = true;
  p.district = 'downtown';
  const cars = world.cars;
  const put = (car, road, s, lane, speed) => { car.road = road; car.s = s; car.lane = lane; car.speed = speed; };
  let i = 0;
  for (const s of [100, 130, 210, 260]) put(cars[i++], 'strip', s, i % 2 ? -3.4 : 3.4, 8);
  for (const s of [150, 180]) put(cars[i++], 'strip', s, i % 2 ? -6.6 : 6.6, 0.5); // parked, ahead
  for (const s of [214, 218]) put(cars[i++], 'strip', s, i % 2 ? -6.6 : 6.6, 0.5); // parked, flanking the hero
  world.heli.x = 45; world.heli.z = -20; world.heli.y = 30; world.heli.fixed = true;
  return { tod: shot.tod, camera: { pos: [40, 3.4, 38], look: [40, 2, -60] } };
}

// 12 self-test checks. Returns {passed, total, results[]} and writes them to the DOM.
export function runSelfTest(game, world) {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: String(detail ?? '') });
  const s = world.stats;
  check('buildings >= 100', s.buildings >= 100, s.buildings);
  check('gable houses >= 10', s.houses >= 10, s.houses);
  check('shops >= 8', s.shops >= 8, s.shops);
  check('market stalls >= 10', s.stalls >= 10, s.stalls);
  check('pedestrians >= 100', s.peds >= 100, s.peds);
  check('traffic cars >= 30', s.cars >= 30, s.cars);
  check('KPD cruisers >= 2', s.kpd >= 2, s.kpd);
  check('school bus present', s.bus >= 1, s.bus);
  check('traffic lights >= 4', s.lights >= 4, s.lights);
  const bank = world.buildings.find((b) => b.kind === 'bank');
  check('BANK tower + sign', !!bank && bank.sign === 'BANK' && bank.h >= 40, bank ? `h=${bank.h}` : 'missing');
  const h1 = hashWorld(buildWorld(CITY.seed));
  const h2 = hashWorld(buildWorld(CITY.seed));
  check('determinism (world hash)', h1 === h2, `${h1} vs ${h2}`);
  const calls = game.renderer.info.render.calls;
  const errs = (window.__errors || []).length;
  check('rendered, zero JS errors', calls > 0 && errs === 0, `draw calls=${calls} errors=${errs}`);
  const passed = results.filter((r) => r.pass).length;
  const text = results.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.name} — ${r.detail}`).join('\n');
  const el = document.getElementById('selftest');
  if (el) el.textContent = `SELFTEST ${passed}/${results.length}\n${text}`;
  document.title = `SELFTEST ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`;
  window.__selftest = { passed, total: results.length, results };
  return { passed, total: results.length, results };
}
