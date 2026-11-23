// HUD: DOM overlay — mission card, KPD response, money/stars, weapons, crew,
// district + minimap + health/armour, dialogue, speedometer, radio. No canvas text.
import { DISTRICTS, MISSIONS, CREW, WEAPONS } from './config.js';
import { districtAt } from './world.js';

let els = null;
let minimap = null;

export function initHud() {
  els = {
    missionName: document.getElementById('mission-name'),
    missionStage: document.getElementById('mission-stage'),
    missionObjective: document.getElementById('mission-objective'),
    missionNext: document.getElementById('mission-next'),
    missionBar: document.getElementById('mission-bar'),
    kpdList: document.getElementById('kpd-list'),
    kpdCount: document.getElementById('kpd-count'),
    money: document.getElementById('money'),
    stars: document.getElementById('stars'),
    responding: document.getElementById('responding'),
    rank: document.getElementById('rank'),
    districtName: document.getElementById('district-name'),
    districtSub: document.getElementById('district-sub'),
    healthBar: document.getElementById('health-bar'),
    armourBar: document.getElementById('armour-bar'),
    healthNum: document.getElementById('health-num'),
    armourNum: document.getElementById('armour-num'),
    speaker: document.getElementById('dialogue-speaker'),
    dialogue: document.getElementById('dialogue-text'),
    vehicleName: document.getElementById('vehicle-name'),
    vehicleCond: document.getElementById('vehicle-cond'),
    speed: document.getElementById('speed'),
    radio: document.getElementById('radio'),
    hint: document.getElementById('hint'),
    overlay: document.getElementById('overlay'),
  };
  minimap = document.getElementById('minimap');
  // Weapon slots + crew cards are static content.
  document.querySelectorAll('.weapon').forEach((el, i) => {
    const w = WEAPONS[i];
    el.querySelector('.w-slot').textContent = w.slot;
    el.querySelector('.w-name').textContent = w.name;
    el.querySelector('.w-ammo').textContent = w.ammo;
  });
  document.querySelectorAll('.crew').forEach((el, i) => {
    const c = CREW[i];
    el.querySelector('.c-name').textContent = c.name;
    el.querySelector('.c-who').textContent = c.who;
    el.querySelector('.c-key').textContent = c.key;
  });
}

export function updateHud(world, policeRows, clockText) {
  if (!els) return;
  const p = world.player;
  const m = MISSIONS[p.mission] || MISSIONS[0];
  els.missionName.textContent = `MISSION ${m.id} · ${m.name}`;
  els.missionStage.textContent = m.stage;
  els.missionObjective.textContent = m.objective;
  els.missionNext.textContent = `NEXT ${m.next}`;
  els.missionBar.style.width = `${Math.min(100, p.missionProgress * 100)}%`;
  els.kpdCount.textContent = `${policeRows.length} UNITS`;
  els.kpdList.innerHTML = policeRows.map((r) =>
    `<div class="kpd-row"><span>${r.name}</span><span class="kpd-status">${r.status}</span><span>${r.dist} m</span></div>`).join('');
  els.money.textContent = `$${p.money.toLocaleString('en-US')}`;
  els.stars.textContent = '★'.repeat(Math.round(p.stars)) + '☆'.repeat(Math.max(0, 5 - Math.round(p.stars)));
  els.responding.textContent = p.stars >= 4 ? 'AIR UNIT DEPLOYED' : p.stars > 0 ? 'UNITS RESPONDING' : 'ALL QUIET';
  els.rank.textContent = `RANK ${p.rank} ROOKIE ${p.rp.toLocaleString('en-US')} / 1,500 RP`;
  const d = world.player.district
    ? DISTRICTS.find((x) => x.id === world.player.district) || districtAt(p.x, p.z)
    : districtAt(p.x, p.z);
  els.districtName.textContent = d.name;
  els.districtSub.textContent = d.sub;
  els.healthBar.style.width = `${p.health}%`;
  els.armourBar.style.width = `${p.armour}%`;
  els.healthNum.textContent = `HEALTH ${Math.round(p.health)}`;
  els.armourNum.textContent = `ARMOUR ${Math.round(p.armour)}`;
  els.speaker.textContent = m.speaker;
  els.dialogue.textContent = m.line;
  els.vehicleName.textContent = p.onFoot ? 'ON FOOT' : p.car.name;
  els.vehicleCond.textContent = p.onFoot ? '' : `${p.car.condition}% CONDITION`;
  els.speed.textContent = p.onFoot ? '—' : String(Math.round(p.speed * 3.6));
  els.radio.textContent = `♪ ${['Sol Mar FM — Island Pop', 'Kite FM — Lo-Fi Bay', 'Vice FM — Synthwave'][p.radio]}`;
  drawMinimap(world);
}

function drawMinimap(world) {
  if (!minimap) return;
  const ctx = minimap.getContext('2d');
  const W = minimap.width, H = minimap.height;
  const S = W / 560;
  const X = (x) => (x + 280) * S, Z = (z) => (z + 280) * S;
  ctx.fillStyle = '#1c2733'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 1;
  for (let i = 0; i <= 14; i++) {
    ctx.beginPath(); ctx.moveTo(i * 40 * S, 0); ctx.lineTo(i * 40 * S, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 40 * S); ctx.lineTo(W, i * 40 * S); ctx.stroke();
  }
  ctx.strokeStyle = '#7a8a9a'; ctx.lineWidth = 3;
  // Roads: drawn from the world data via the DOM-free road list.
  const roads = window.__roads || [];
  for (const r of roads) {
    ctx.beginPath(); ctx.moveTo(X(r.x1), Z(r.z1)); ctx.lineTo(X(r.x2), Z(r.z2)); ctx.stroke();
  }
  // Sea (east edge).
  ctx.fillStyle = '#2a6a9a'; ctx.fillRect(X(210), 0, W - X(210), H);
  // Mission marker.
  const m = MISSIONS[world.player.mission] || MISSIONS[0];
  const md = DISTRICTS.find((d) => d.id === m.district) || DISTRICTS[0];
  ctx.fillStyle = '#ffd83c';
  ctx.beginPath(); ctx.arc(X(md.center[0]), Z(md.center[1]), 5, 0, Math.PI * 2); ctx.fill();
  // Police dots.
  ctx.fillStyle = '#ff4a4a';
  for (const c of world.cars) {
    if (c.type !== 'kpd') continue;
    ctx.beginPath(); ctx.arc(X(c.x), Z(c.z), 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = world.player;
  ctx.save();
  ctx.translate(X(p.x), Z(p.z)); ctx.rotate(-p.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function showOverlay(show, title, sub) {
  if (!els) return;
  els.overlay.style.display = show ? 'flex' : 'none';
  if (title) document.getElementById('overlay-title').textContent = title;
  if (sub) document.getElementById('overlay-sub').textContent = sub;
}
