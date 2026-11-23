// The story: eight jobs from the fixer Abuela Cleo, in order. Each mission is a list of
// steps; a step is one verb — go somewhere, steal a car, survive, race, hold a spot, escort
// a convoy, deliver in time, escape — and the update below runs whichever verb is current.
// Finishing a mission pays cash, raises standing in its district by one, and two of them
// recruit crew: Rook after the car theft, Vera after the street race.
import { EVENT_MISSION, EVENT_WIN } from './world.js';
import { CASINO, BANK, FIXER, GARAGE, SAFEHOUSE } from './config.js';

const MISSIONS = [
  {
    name: 'Errand Run', district: 'oldtown', reward: 300,
    brief: 'Cleo needs a parcel moved. Pick it up, drop it at the safehouse.',
    steps: [
      { kind: 'goto', x: 620, y: 620, label: 'Pick up the parcel' },
      { kind: 'goto', x: SAFEHOUSE.x, y: SAFEHOUSE.y, label: 'Drop it at the safehouse' },
    ],
  },
  {
    name: 'Hot Wheels', district: 'downtown', reward: 500, recruit: 'rook',
    brief: 'A parked ride on the avenue has Cleo\'s name on it. Take it, bring it to the garage.',
    steps: [
      { kind: 'steal', x: 1900, y: 850, label: 'Steal the parked car' },
      { kind: 'goto', x: GARAGE.x, y: GARAGE.y, label: 'Bring it to the garage' },
    ],
  },
  {
    name: 'Lose the Tail', district: 'hills', reward: 700,
    brief: 'Three stars and nowhere to hide. Stay rolling for 45 seconds and the heat gives up.',
    steps: [
      { kind: 'survive', duration: 45, label: 'Lose the tail — stay moving' },
    ],
  },
  {
    name: 'Street King', district: 'downtown', reward: 900, recruit: 'vera',
    brief: 'Three laps around Downtown against the ghost coupe. Beat it and Vera drives for you.',
    steps: [
      { kind: 'race', laps: 3, label: 'Beat the ghost coupe — 3 laps' },
    ],
  },
  {
    name: 'The Vault', district: 'downtown', reward: 1500,
    brief: 'The bank vault is open for twenty seconds. Hold the spot, then run for the safehouse.',
    steps: [
      { kind: 'goto', x: BANK.x, y: BANK.y, label: 'Reach the bank' },
      { kind: 'hold', x: BANK.x, y: BANK.y, duration: 20, label: 'Hold the vault — 20s' },
      { kind: 'goto', x: SAFEHOUSE.x, y: SAFEHOUSE.y, label: 'Escape to the safehouse' },
    ],
  },
  {
    name: 'Convoy Rescue', district: 'docks', reward: 1800,
    brief: 'Cleo\'s trucks are rolling to the Docks. Stay with the lead truck till it arrives.',
    steps: [
      { kind: 'goto', x: 500, y: 1900, label: 'Meet the convoy' },
      { kind: 'escort', label: 'Stay with the lead truck' },
    ],
  },
  {
    name: 'Smuggling Run', district: 'marina', reward: 2200,
    brief: 'A package waits at the Marina. Ninety seconds to get it across town.',
    steps: [
      { kind: 'goto', x: 2600, y: 1300, label: 'Pick up the package' },
      { kind: 'deliver', x: 2900, y: 2100, duration: 90, label: 'Deliver it — 90s' },
    ],
  },
  {
    name: 'The Casino Score', district: 'hills', reward: 5000,
    brief: 'The last job. Grab the casino cash, then lose five stars all the way home.',
    steps: [
      { kind: 'goto', x: CASINO.x, y: CASINO.y, label: 'Reach the casino' },
      { kind: 'hold', x: CASINO.x, y: CASINO.y, duration: 10, label: 'Grab the cash — 10s' },
      { kind: 'goto', x: SAFEHOUSE.x, y: SAFEHOUSE.y, label: 'Escape to the safehouse' },
    ],
  },
];

const RACE_WAYPOINTS = [
  { x: 1000, y: 950 },
  { x: 2200, y: 950 },
  { x: 2200, y: 1600 },
  { x: 1000, y: 1600 },
];

const CONVOY_ROUTE = [
  { x: 500, y: 1900 },
  { x: 900, y: 2200 },
  { x: 2400, y: 2200 },
];

function startMission(state) {
  const def = MISSIONS[state.missionIndex];
  if (!def) return;
  state.mission = { def, stepIndex: 0, timer: 0, failTimer: 0, data: {} };
  state.banner = `${def.name}: ${def.brief}`;
  state.bannerTimer = 4;
  const step = def.steps[0];
  if (step.kind === 'survive') state.heat = Math.max(state.heat, 65);
  if (step.kind === 'race') setupRace(state);
  if (step.kind === 'escort') setupConvoy(state);
  if (step.kind === 'steal') {
    let best = null;
    let bestD = 1e9;
    for (const car of state.cars) {
      if (car.kind !== 'parked') continue;
      const d = Math.hypot(car.x - step.x, car.y - step.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    state.mission.data.targetCar = best;
  }
}

function setupRace(state) {
  const wp = RACE_WAYPOINTS[0];
  // The player starts on the start line, in a car: take the nearest parked ride if on foot.
  const p = state.player;
  if (!p.inCar) {
    let best = null;
    let bestD = 1e9;
    for (const car of state.cars) {
      if (car.kind !== 'parked' && car.kind !== 'garage') continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (best) {
      best.kind = 'stolen';
      p.inCar = best;
      p.speed = 0;
    }
  }
  p.x = wp.x;
  p.y = wp.y + 40;
  p.angle = 0;
  if (p.inCar) {
    p.inCar.x = p.x;
    p.inCar.y = p.y;
    p.inCar.angle = 0;
    p.inCar.speed = 0;
  }
  state.ghost = {
    x: wp.x, y: wp.y + 40, angle: 0, speed: 0, waypoint: 0, laps: 0,
  };
  state.mission.data.playerWp = 0;
  state.mission.data.playerLaps = 0;
  state.mission.data.ghostLaps = 0;
  state.mission.data.timer = 240;
}

function setupConvoy(state) {
  state.convoy = CONVOY_ROUTE.slice(0, 1).map((at, i) => ({
    x: at.x - i * 70, y: at.y, angle: 0, speed: 0, waypoint: 0,
  }));
  state.convoy.push({ x: 430, y: 1900, angle: 0, speed: 0, waypoint: 0 });
  state.mission.data.failTimer = 0;
}

function finishMission(state) {
  const def = state.mission.def;
  state.cash += def.reward;
  state.missionsDone += 1;
  state.standing[def.district] = Math.min(5, (state.standing[def.district] || 0) + 1);
  if (def.recruit) {
    state.crew[def.recruit] = true;
    const name = def.recruit === 'rook' ? 'Rook' : 'Vera';
    state.banner = `${def.name} done — $${def.reward}. ${name} joined your crew.`;
  } else {
    state.banner = `${def.name} done — $${def.reward}.`;
  }
  state.bannerTimer = 4;
  state.mission = null;
  state.objective = null;
  state.ghost = null;
  state.convoy = [];
  state.missionIndex += 1;
  if (state.missionIndex >= MISSIONS.length) {
    state.won = true;
    return EVENT_WIN;
  }
  return EVENT_MISSION;
}

function failMission(state, why) {
  state.banner = `Failed: ${why}. Cleo gives you another shot.`;
  state.bannerTimer = 4;
  state.mission = null;
  state.objective = null;
  state.ghost = null;
  state.convoy = [];
}

/** One fixed step of the current mission. Returns EVENT_MISSION / EVENT_WIN (0 otherwise). */
export function updateMission(state, dt, random) {
  if (state.won) return 0;
  if (!state.mission) {
    if (state.missionIndex < MISSIONS.length) startMission(state);
    return 0;
  }
  const m = state.mission;
  const def = m.def;
  const step = def.steps[m.stepIndex];
  if (!step) return finishMission(state);
  const p = state.player;
  let done = false;

  if (step.kind === 'goto') {
    state.objective = { x: step.x, y: step.y, label: step.label };
    if (Math.hypot(p.x - step.x, p.y - step.y) < 80) done = true;
  } else if (step.kind === 'steal') {
    const car = m.data.targetCar;
    if (car) {
      state.objective = { x: car.x, y: car.y, label: step.label };
      if (p.inCar === car) done = true;
    } else done = true;
  } else if (step.kind === 'survive') {
    state.objective = { x: p.x, y: p.y, label: `${step.label} — ${Math.ceil(m.timer || step.duration)}s` };
    if (state.heat < 60) state.heat = 60;
    m.timer = (m.timer || step.duration) - dt;
    if (m.timer <= 0) done = true;
  } else if (step.kind === 'race') {
    m.data.timer -= dt;
    const ghost = state.ghost;
    // The ghost coupe follows the loop at a steady pace.
    const wp = RACE_WAYPOINTS[ghost.waypoint];
    const gdx = wp.x - ghost.x;
    const gdy = wp.y - ghost.y;
    const gd = Math.hypot(gdx, gdy);
    const want = Math.atan2(gdy, gdx);
    let diff = want - ghost.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ghost.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    ghost.speed = Math.min(430, ghost.speed + 300 * dt);
    ghost.x += Math.cos(ghost.angle) * ghost.speed * dt;
    ghost.y += Math.sin(ghost.angle) * ghost.speed * dt;
    if (gd < 80) {
      ghost.waypoint = (ghost.waypoint + 1) % RACE_WAYPOINTS.length;
      if (ghost.waypoint === 0) m.data.ghostLaps += 1;
    }
    // The player's laps, same waypoints.
    const pwp = RACE_WAYPOINTS[m.data.playerWp];
    if (Math.hypot(p.x - pwp.x, p.y - pwp.y) < 110) {
      m.data.playerWp = (m.data.playerWp + 1) % RACE_WAYPOINTS.length;
      if (m.data.playerWp === 0) m.data.playerLaps += 1;
    }
    state.objective = { x: pwp.x, y: pwp.y, label: `Lap ${m.data.playerLaps + 1}/3 — ghost ${m.data.ghostLaps}` };
    if (m.data.playerLaps >= step.laps) done = true;
    else if (m.data.ghostLaps >= step.laps) {
      failMission(state, 'the ghost coupe won the race');
      return 0;
    } else if (m.data.timer <= 0) {
      failMission(state, 'out of time on the race');
      return 0;
    }
  } else if (step.kind === 'hold') {
    state.objective = { x: step.x, y: step.y, label: `${step.label} — ${Math.ceil(m.timer || step.duration)}s` };
    if (step === def.steps[1] && def.name === 'The Vault') state.heat = Math.max(state.heat, 80);
    if (step === def.steps[1] && def.name === 'The Casino Score') state.heat = Math.max(state.heat, 95);
    if (Math.hypot(p.x - step.x, p.y - step.y) < 110) {
      m.timer = (m.timer || step.duration) - dt;
      if (m.timer <= 0) done = true;
    }
  } else if (step.kind === 'escort') {
    const lead = state.convoy[0];
    if (lead) {
      state.objective = { x: lead.x, y: lead.y, label: step.label };
      const wp = CONVOY_ROUTE[lead.waypoint];
      if (wp) {
        const dx = wp.x - lead.x;
        const dy = wp.y - lead.y;
        const d = Math.hypot(dx, dy);
        const want = Math.atan2(dy, dx);
        let diff = want - lead.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        lead.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
        lead.speed = Math.min(150, lead.speed + 120 * dt);
        lead.x += Math.cos(lead.angle) * lead.speed * dt;
        lead.y += Math.sin(lead.angle) * lead.speed * dt;
        if (d < 60) lead.waypoint += 1;
      }
      for (let i = 1; i < state.convoy.length; i += 1) {
        const f = state.convoy[i];
        const ahead = state.convoy[i - 1];
        const dx = ahead.x - f.x;
        const dy = ahead.y - f.y;
        const d = Math.hypot(dx, dy);
        if (d > 70) {
          f.angle = Math.atan2(dy, dx);
          f.x += Math.cos(f.angle) * Math.min(150, d) * dt;
          f.y += Math.sin(f.angle) * Math.min(150, d) * dt;
        }
      }
      if (lead.waypoint >= CONVOY_ROUTE.length) done = true;
      const dPlayer = Math.hypot(p.x - lead.x, p.y - lead.y);
      if (dPlayer > 520) {
        m.data.failTimer += dt;
        if (m.data.failTimer > 5) {
          failMission(state, 'you lost the convoy');
          return 0;
        }
      } else m.data.failTimer = 0;
    } else done = true;
  } else if (step.kind === 'deliver') {
    state.objective = { x: step.x, y: step.y, label: `${step.label} — ${Math.ceil(m.timer || step.duration)}s` };
    m.timer = (m.timer || step.duration) - dt;
    if (Math.hypot(p.x - step.x, p.y - step.y) < 80) done = true;
    else if (m.timer <= 0) {
      failMission(state, 'the delivery ran out of time');
      return 0;
    }
  }

  if (done) {
    m.stepIndex += 1;
    m.timer = 0;
    const next = def.steps[m.stepIndex];
    if (next) {
      if (next.kind === 'race') setupRace(state);
      if (next.kind === 'escort') setupConvoy(state);
      if (next.kind === 'survive') state.heat = Math.max(state.heat, 65);
      if (next.kind === 'steal') {
        let best = null;
        let bestD = 1e9;
        for (const car of state.cars) {
          if (car.kind !== 'parked') continue;
          const d = Math.hypot(car.x - next.x, car.y - next.y);
          if (d < bestD) { bestD = d; best = car; }
        }
        m.data.targetCar = best;
      }
    }
    if (m.stepIndex >= def.steps.length) return finishMission(state);
    return EVENT_MISSION;
  }
  return 0;
}

export { MISSIONS };
