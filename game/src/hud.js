// Azura Bay HUD: DOM overlay on top of the WebGL canvas — mission card,
// KPD response list, money + stars, weapon slots, crew cards, street minimap,
// dialogue box, speedometer. Rank-1-style layout, no overlaps, no clipping.
import { WEAPONS, CREW } from './config.js';
import { wantedLabel } from './police.js';

const AVENUES = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
const STREETS = [-120, -80, -40, 0, 40, 80, 120];

export function buildHUD() {
  return {
    missionTitle: document.getElementById('hud-mission-title'),
    missionStage: document.getElementById('hud-mission-stage'),
    missionObjective: document.getElementById('hud-mission-objective'),
    missionNext: document.getElementById('hud-mission-next'),
    missionBar: document.getElementById('hud-mission-bar'),
    policeList: document.getElementById('hud-police-list'),
    policeCount: document.getElementById('hud-police-count'),
    money: document.getElementById('hud-money'),
    stars: document.getElementById('hud-stars'),
    wantedLabel: document.getElementById('hud-wanted-label'),
    rank: document.getElementById('hud-rank'),
    weapons: document.getElementById('hud-weapons'),
    crew: document.getElementById('hud-crew'),
    minimap: document.getElementById('hud-minimap'),
    districtName: document.getElementById('hud-district-name'),
    districtSub: document.getElementById('hud-district-sub'),
    health: document.getElementById('hud-health'),
    armour: document.getElementById('hud-armour'),
    dialogueSpeaker: document.getElementById('hud-dialogue-speaker'),
    dialogueText: document.getElementById('hud-dialogue-text'),
    speedName: document.getElementById('hud-speed-name'),
    speedValue: document.getElementById('hud-speed-value'),
    speedMode: document.getElementById('hud-speed-mode'),
    radio: document.getElementById('hud-radio'),
  };
}

export function updateHUD(el, state) {
  if (!el.missionTitle) return;
  const m = state.mission;
  el.missionTitle.textContent = `MISSION ${m.id} · ${m.name}`;
  el.missionStage.textContent = `STAGE ${state.stage + 1}/${m.stages.length} · ${m.stages[state.stage]}`;
  el.missionObjective.textContent = m.objective;
  el.missionNext.textContent = `NEXT ${m.next}`;
  el.missionBar.style.width = `${((state.stage + 1) / m.stages.length) * 100}%`;

  el.policeCount.textContent = `${state.policeRows.length} UNITS`;
  el.policeList.innerHTML = state.policeRows
    .map((r) => `<div class="police-row"><span>${r.name}</span><span class="police-status">${r.status}</span><span class="police-dist">${r.distance} m</span></div>`)
    .join('');

  el.money.textContent = `$${state.money.toLocaleString('en-US')}`;
  el.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  el.wantedLabel.textContent = wantedLabel(state.police);
  el.rank.textContent = 'RANK 1 ROOKIE 0 / 1,500 RP';

  el.weapons.innerHTML = WEAPONS.map((w) => (
    `<div class="weapon${w.slot === state.weapon ? ' active' : ''}"><div class="weapon-slot">${w.slot}</div><div class="weapon-name">${w.name}</div><div class="weapon-ammo">${w.ammo}</div></div>`
  )).join('');

  el.crew.innerHTML = CREW.map((c) => (
    `<div class="crew-card"><div class="crew-name">${c.card}</div><div class="crew-role">${c.name} · ${c.role}</div><div class="crew-key">${c.key}</div></div>`
  )).join('');

  el.districtName.textContent = state.district.name;
  el.districtSub.textContent = state.district.sub;
  el.health.style.width = `${state.health}%`;
  el.armour.style.width = `${state.armour}%`;

  el.dialogueSpeaker.textContent = state.dialogue.speaker;
  el.dialogueText.textContent = state.dialogue.text;

  el.speedName.textContent = state.onFoot ? 'ON FOOT' : state.carName;
  el.speedValue.textContent = String(Math.round(state.speedKmh));
  el.speedMode.textContent = state.onFoot ? '' : '100% CONDITION';
  el.radio.textContent = `♪ ${state.radio.name} — ${state.radio.genre}`;

  drawMinimap(el.minimap, state);
}

function drawMinimap(canvas, state) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const toX = (x) => ((x + 200) / 400) * W;
  const toY = (z) => ((z + 200) / 400) * H;
  g.fillStyle = '#14181f';
  g.fillRect(0, 0, W, H);
  // Sea on the right edge.
  g.fillStyle = '#1c4a6b';
  g.fillRect(toX(150), 0, W - toX(150), H);
  // Streets.
  g.strokeStyle = '#5a6270';
  g.lineWidth = 2;
  for (const ax of AVENUES) {
    g.beginPath(); g.moveTo(toX(ax), 0); g.lineTo(toX(ax), H); g.stroke();
  }
  for (const sz of STREETS) {
    g.beginPath(); g.moveTo(0, toY(sz)); g.lineTo(W, toY(sz)); g.stroke();
  }
  // Mission marker.
  g.fillStyle = '#ffd92b';
  g.beginPath(); g.arc(toX(state.target.x), toY(state.target.z), 4, 0, Math.PI * 2); g.fill();
  // Police dots.
  g.fillStyle = '#ff4040';
  for (const p of state.policeDots || []) {
    g.beginPath(); g.arc(toX(p.x), toY(p.z), 2.5, 0, Math.PI * 2); g.fill();
  }
  // Player arrow.
  const px = toX(state.player.x);
  const py = toY(state.player.z);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(px, py - 6); g.lineTo(px + 5, py + 5); g.lineTo(px - 5, py + 5); g.closePath();
  g.fill();
  g.strokeStyle = '#ffd92b';
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(px, py, 8, 0, Math.PI * 2); g.stroke();
}
