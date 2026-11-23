// Story jobs from fixer Abuela Cleo, crew unlocks and district standing.
// Eight staged missions; each pays cash, raises standing in its district and
// unlocks the next. Failing a job retries it; getting busted or wasted blows it.
import { dist2 } from './random.js';
import { addHeat, makeCar } from './entities.js';

export const MISSIONS = [
  {
    id: 'errand', name: 'First Errand', fixer: 'Abuela Cleo',
    brief: 'Pick up the parcel at the Marina pier and deliver it to Caf\u00e9 Brasa before the clock runs out.',
    pay: 300, district: 'marina', timeLimit: 75,
    start: (s) => ({ kind: 'deliver', target: s.city.landmarks.pier, dest: s.city.landmarks.cafe, picked: false }),
  },
  {
    id: 'hotwheels', name: 'Hot Wheels', fixer: 'Abuela Cleo',
    brief: 'A gold Sol Coupe is parked by the Downtown bank. Take it — quietly if you can — and bring it to Cleo\u2019s Garage.',
    pay: 450, district: 'downtown', timeLimit: 120,
    start: (s) => {
      const car = makeCar('coupe', s.city.landmarks.bank.x + 60, s.city.landmarks.bank.y + 40, 0, 'parked');
      car.color = '#f1c40f';
      s.cars.push(car);
      return { kind: 'steal', carId: car.id, dest: s.city.landmarks.garage };
    },
  },
  {
    id: 'tail', name: 'Lose the Tail', fixer: 'Abuela Cleo',
    brief: 'The Azura PD is on to you. Get to 3 stars, then shake every cruiser until the radio goes quiet.',
    pay: 600, district: 'oldtown', timeLimit: 150,
    start: (s) => {
      addHeat(s, 45, 'mission heat');
      return { kind: 'loseheat', peak: 3 };
    },
  },
  {
    id: 'race', name: 'Street Kings', fixer: 'Rook',
    brief: 'Three laps of the Marina circuit against the island\u2019s fastest. Beat the ghost coupe to the line.',
    pay: 800, district: 'marina', timeLimit: 180,
    start: (s) => {
      const ghost = makeCar('coupe', s.player.x + 40, s.player.y, s.player.angle, 'traffic');
      ghost.color = '#8e44ad';
      ghost.top = 480;
      ghost.ghost = true;
      s.cars.push(ghost);
      const points = racePoints(s);
      return { kind: 'race', ghostId: ghost.id, points, lap: 0, next: 0, laps: 3 };
    },
  },
  {
    id: 'vault', name: 'The Vault', fixer: 'Abuela Cleo',
    brief: 'Hit the vault under Azura National Bank. Grab the cash, then get out of Downtown before the cordon closes.',
    pay: 1200, district: 'downtown', timeLimit: 150,
    start: (s) => ({ kind: 'rob', target: s.city.landmarks.bank, dest: s.city.landmarks.airstrip, grabbed: false, escape: false }),
  },
  {
    id: 'rescue', name: 'Crew Up', fixer: 'Vera',
    brief: 'Rook is in a police transport heading for the Docks. Ram it until it stops, then pick him up.',
    pay: 900, district: 'docks', timeLimit: 150,
    start: (s) => {
      const van = makeCar('van', s.player.x + 500, s.player.y + 200, 0, 'traffic');
      van.color = '#2c3e50';
      van.hp = 120;
      van.maxHp = 120;
      van.fleeing = true;
      s.cars.push(van);
      return { kind: 'rescue', vanId: van.id, freed: false };
    },
  },
  {
    id: 'smuggle', name: 'Harbor Lights', fixer: 'Vera',
    brief: 'Crates are waiting at the Docks. Run them to the Hills safehouse — fast, and do not get searched.',
    pay: 1100, district: 'hills', timeLimit: 110,
    start: (s) => ({ kind: 'deliver', target: s.city.landmarks.diner, dest: { x: 2400, y: 420, name: 'Hills Safehouse' }, picked: false }),
  },
  {
    id: 'azura', name: 'The Azura Job', fixer: 'Abuela Cleo',
    brief: 'The final score: Casino Solmar\u2019s take. Grab it, then run the gauntlet to the airstrip while every cruiser on the island comes for you.',
    pay: 2500, district: 'downtown', timeLimit: 240,
    start: (s) => {
      addHeat(s, 60, 'casino alarm');
      return { kind: 'rob', target: s.city.landmarks.casino, dest: s.city.landmarks.airstrip, grabbed: false, escape: false };
    },
  },
];

function racePoints(s) {
  const c = { x: 1600, y: 2680 };
  const rx = 900;
  const ry = 320;
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    pts.push({ x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * ry });
  }
  return pts;
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.mission = {
    index, def, data: def.start(state), timeLeft: def.timeLimit, failed: false, done: false,
  };
  state.missionObjective = objectiveText(state.mission);
  return true;
}

export function objectiveText(m) {
  const d = m.data;
  switch (d.kind) {
    case 'deliver': return d.picked ? `Deliver to ${d.dest.name}` : `Pick up at ${d.target.name}`;
    case 'steal': return 'Steal the gold coupe, bring it to the garage';
    case 'loseheat': return 'Reach 3 stars, then lose the heat';
    case 'race': return `Lap ${Math.min(d.lap + 1, d.laps)}/${d.laps} — beat the ghost coupe`;
    case 'rob': return d.grabbed ? `Escape to ${d.dest.name}` : `Reach ${d.target.name} and grab the take`;
    case 'rescue': return d.freed ? 'Pick up Rook' : 'Ram the transport until it stops';
    default: return '';
  }
}

export function missionTarget(state) {
  const m = state.mission;
  if (!m) return null;
  const d = m.data;
  switch (d.kind) {
    case 'deliver': return d.picked ? d.dest : d.target;
    case 'steal': {
      const car = state.cars.find((c) => c.id === d.carId);
      return car ? { x: car.x, y: car.y, name: 'Gold Coupe' } : d.dest;
    }
    case 'loseheat': return null;
    case 'race': return d.points[d.next];
    case 'rob': return d.grabbed ? d.dest : d.target;
    case 'rescue': {
      const van = state.cars.find((c) => c.id === d.vanId);
      return van ? { x: van.x, y: van.y, name: 'Transport' } : null;
    }
    default: return null;
  }
}

export function updateMission(state, dt) {
  const m = state.mission;
  if (!m || m.done || m.failed) return;
  m.timeLeft -= dt;
  if (m.timeLeft <= 0) {
    failMission(state, 'Out of time');
    return;
  }
  const p = state.player;
  const d = m.data;
  if (d.kind === 'deliver') {
    const t = d.picked ? d.dest : d.target;
    if (dist2(p.x, p.y, t.x, t.y) < 70 * 70) {
      if (!d.picked) {
        d.picked = true;
        state.toast = 'Parcel picked up — deliver it!';
      } else {
        completeMission(state);
      }
    }
  } else if (d.kind === 'steal') {
    const car = state.cars.find((c) => c.id === d.carId);
    if (car && p.carId === car.id) {
      d.driving = true;
    }
    if (d.driving && dist2(p.x, p.y, d.dest.x, d.dest.y) < 90 * 90) completeMission(state);
    if (!car) failMission(state, 'The coupe was lost');
  } else if (d.kind === 'loseheat') {
    if (state.wanted >= d.peak) d.peaked = true;
    if (d.peaked && state.wanted === 0) completeMission(state);
  } else if (d.kind === 'race') {
    const pt = d.points[d.next];
    if (dist2(p.x, p.y, pt.x, pt.y) < 80 * 80) {
      d.next += 1;
      if (d.next >= d.points.length) {
        d.next = 0;
        d.lap += 1;
        if (d.lap >= d.laps) completeMission(state);
      }
    }
    const ghost = state.cars.find((c) => c.id === d.ghostId);
    if (ghost) {
      const gp = d.points[d.next];
      const a = Math.atan2(gp.y - ghost.y, gp.x - ghost.x);
      ghost.angle += (a - ghost.angle) * Math.min(1, dt * 2);
      ghost.speed = Math.min(ghost.top, ghost.speed + 200 * dt);
      ghost.x += Math.cos(ghost.angle) * ghost.speed * dt;
      ghost.y += Math.sin(ghost.angle) * ghost.speed * dt;
    }
  } else if (d.kind === 'rob') {
    if (!d.grabbed && dist2(p.x, p.y, d.target.x, d.target.y) < 80 * 80) {
      d.grabbed = true;
      addHeat(state, 40, 'vault alarm');
      state.toast = 'Take grabbed — run!';
    } else if (d.grabbed && dist2(p.x, p.y, d.dest.x, d.dest.y) < 90 * 90) {
      completeMission(state);
    }
  } else if (d.kind === 'rescue') {
    const van = state.cars.find((c) => c.id === d.vanId);
    if (van) {
      if (van.hp <= 40 && !d.freed) {
        d.freed = true;
        van.speed = 0;
        van.parked = true;
        state.toast = 'Transport stopped — pick up Rook!';
      }
      if (!d.freed) {
        const a = Math.atan2(p.y - van.y, p.x - van.x);
        van.angle += (a - van.angle) * Math.min(1, dt);
        van.speed = Math.min(300, van.speed + 150 * dt);
        van.x += Math.cos(van.angle) * van.speed * dt;
        van.y += Math.sin(van.angle) * van.speed * dt;
      }
    }
    if (d.freed && dist2(p.x, p.y, van ? van.x : 0, van ? van.y : 0) < 60 * 60) {
      state.crew.rook = true;
      completeMission(state);
    }
  }
  state.missionObjective = objectiveText(m);
}

export function completeMission(state) {
  const m = state.mission;
  m.done = true;
  state.cash += m.def.pay;
  state.standing[m.def.district] = Math.min(5, (state.standing[m.def.district] || 0) + 1);
  state.jobsDone += 1;
  state.toast = `${m.def.name} complete — $${m.def.pay} earned`;
  if (m.def.id === 'rescue') state.crew.rook = true;
  if (m.def.id === 'smuggle') state.crew.vera = true;
  if (m.def.id === 'azura') state.gameWon = true;
  state.mission = null;
  state.missionObjective = '';
}

export function failMission(state, why) {
  const m = state.mission;
  if (!m) return;
  m.failed = true;
  state.toast = `Job blown — ${why}. Press J to retry.`;
  state.mission = null;
  state.missionObjective = '';
}
