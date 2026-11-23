// Missions: 8 jobs with a tiny state machine — start, progress, complete, reward.
// Objectives are counters the game loop bumps (reach a place, wreck a car, survive).
import { MISSIONS } from './config.js';

export function startMission(world, index) {
  const p = world.player;
  p.mission = Math.max(0, Math.min(MISSIONS.length - 1, index));
  p.missionProgress = 0;
  const m = MISSIONS[p.mission];
  p.stars = Math.max(p.stars, m.wanted);
  return m;
}

export function missionTick(world, dt) {
  const p = world.player;
  const m = MISSIONS[p.mission];
  // Progress creeps while the player stays in the mission district and moving.
  const d = Math.hypot(p.x - districtCenter(m)[0], p.z - districtCenter(m)[1]);
  if (d < 90 && p.speed > 1) p.missionProgress = Math.min(1, p.missionProgress + dt * 0.02);
  return p.missionProgress >= 1;
}

export function completeMission(world) {
  const p = world.player;
  const m = MISSIONS[p.mission];
  p.money += m.reward;
  p.rp += 150;
  p.missionProgress = 0;
  p.mission = (p.mission + 1) % MISSIONS.length;
  return MISSIONS[p.mission];
}

export function districtCenter(m) {
  const centers = { pasaru: [-120, -60], strand: [150, 40], downtown: [40, -90], port: [-160, 130], hillcrest: [120, -170] };
  return centers[m.district] || [0, 0];
}
