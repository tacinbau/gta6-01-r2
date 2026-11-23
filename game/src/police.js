// KPD police response: wanted stars, pursuing units, roadblocks, AIR ONE.
// Pure logic — render.js draws what this reports, hud.js lists it.
import { POLICE_UNITS } from './config.js';

export function makePoliceState() {
  return {
    wanted: 0,
    units: POLICE_UNITS.map((name, i) => ({
      name,
      status: 'STANDBY',
      distance: 300 + i * 17,
    })),
    foot: 0,
    airOne: false,
    roadblocks: 0,
  };
}

export function setWanted(police, stars) {
  police.wanted = Math.max(0, Math.min(5, stars));
  police.airOne = police.wanted >= 4;
  police.roadblocks = police.wanted >= 3 ? police.wanted - 2 : 0;
  police.units.forEach((u, i) => {
    if (police.wanted === 0) {
      u.status = 'STANDBY';
      u.distance = 300 + i * 17;
    } else if (i < police.wanted) {
      u.status = 'IN PURSUIT';
      u.distance = 11 + i * 29;
    } else {
      u.status = 'EN ROUTE';
      u.distance = 120 + i * 40;
    }
  });
  police.foot = police.wanted >= 2 ? 2 : 0;
  return police;
}

export function policeListRows(police) {
  const rows = police.units.map((u) => ({ name: u.name, status: u.status, distance: u.distance }));
  if (police.foot > 0) rows.push({ name: `FOOT ×${police.foot}`, status: 'IN PURSUIT', distance: 41 });
  if (police.airOne) rows.push({ name: 'AIR ONE', status: 'OVERHEAD', distance: 50 });
  return rows;
}

export function wantedLabel(police) {
  if (police.wanted === 0) return 'CLEAR';
  if (police.airOne) return 'AIR UNIT DEPLOYED';
  return 'UNITS RESPONDING';
}
