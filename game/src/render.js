// All drawing: the island, the cars, the people, the police, the HUD with
// its minimap, and every menu. One canvas, plain 2D, no assets.
import { WORLD, DISTRICTS, VIEW_W, VIEW_H, WEAPONS, RADIO } from './config.js';
import { clamp, lerp } from './random.js';
import { districtAt } from './world.js';
import { missionTarget } from './missions.js';

function skyTint(timeOfDay) {
  // returns {overlay, alpha} for the time of day
  if (timeOfDay >= 7 && timeOfDay < 17) return { color: '#ffd27d', alpha: 0 };
  if (timeOfDay >= 17 && timeOfDay < 19.5) return { color: '#ff7b39', alpha: 0.24 };
  if (timeOfDay >= 19.5 || timeOfDay < 5.5) return { color: '#0a1030', alpha: 0.42 };
  return { color: '#ffb347', alpha: 0.14 };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0, zoom: 0.9 };

  function updateCamera(state) {
    cam.x = clamp(state.player.x - VIEW_W / 2 / cam.zoom, -100, WORLD.size - VIEW_W / cam.zoom + 100);
    cam.y = clamp(state.player.y - VIEW_H / 2 / cam.zoom, -100, WORLD.size - VIEW_H / cam.zoom + 100);
  }

  function worldToScreen(x, y) {
    return { x: (x - cam.x) * cam.zoom, y: (y - cam.y) * cam.zoom };
  }

  function drawWorld(state) {
    const city = state.city;
    // ground: grass, then sand, then water
    ctx.fillStyle = '#69a84f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const sand = worldToScreen(0, WORLD.size - WORLD.beach);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, sand.y, VIEW_W, VIEW_H - sand.y);
    const water = worldToScreen(0, WORLD.size - WORLD.beach + 40);
    ctx.fillStyle = '#2e86ab';
    ctx.fillRect(0, water.y, VIEW_W, VIEW_H - water.y);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 8; i += 1) {
      const wy = water.y + 14 + i * 9;
      const off = (state.time * 20 + i * 130) % 260;
      ctx.fillRect(off - 130, wy, 90, 2);
    }
    // roads
    const s = WORLD.roadSpacing;
    const w = WORLD.roadWidth;
    ctx.fillStyle = '#3a3a44';
    for (let x = 0; x <= WORLD.size; x += s) {
      const p = worldToScreen(x, 0);
      ctx.fillRect(p.x, 0, w * cam.zoom, VIEW_H);
    }
    for (let y = 0; y <= WORLD.size; y += s) {
      const p = worldToScreen(0, y);
      ctx.fillRect(0, p.y, VIEW_W, w * cam.zoom);
    }
    // centre dashes
    ctx.fillStyle = '#f7d154';
    for (let x = 0; x <= WORLD.size; x += s) {
      for (let y = 0; y < WORLD.size; y += 60) {
        const p = worldToScreen(x + w / 2, y);
        if (p.x > -10 && p.x < VIEW_W + 10) ctx.fillRect(p.x - 1, p.y, 3, 18);
      }
    }
    for (let y = 0; y <= WORLD.size; y += s) {
      for (let x = 0; x < WORLD.size; x += 60) {
        const p = worldToScreen(x, y + w / 2);
        if (p.y > -10 && p.y < VIEW_H + 10) ctx.fillRect(p.x, p.y - 1, 18, 3);
      }
    }
    // pavement for the whole block, then its buildings on top
    ctx.fillStyle = '#7d8a96';
    const s2 = WORLD.roadSpacing;
    for (let bx = 0; bx < WORLD.size / s2; bx += 1) {
      for (let by = 0; by < WORLD.size / s2; by += 1) {
        const bx0 = bx * s2 + WORLD.roadWidth;
        const by0 = by * s2 + WORLD.roadWidth;
        if (by0 > WORLD.size - WORLD.beach - 40) continue;
        const bp = worldToScreen(bx0, by0);
        const bw2 = (s2 - WORLD.roadWidth) * cam.zoom;
        if (bp.x > VIEW_W + 40 || bp.y > VIEW_H + 40 || bp.x + bw2 < -40 || bp.y + bw2 < -40) continue;
        ctx.fillRect(bp.x, bp.y, bw2, bw2);
      }
    }
    // buildings with a fake height edge
    for (const b of city.buildings) {
      const p = worldToScreen(b.x, b.y);
      const bw = b.w * cam.zoom;
      const bh = b.h * cam.zoom;
      if (p.x > VIEW_W + 40 || p.y > VIEW_H + 40 || p.x + bw < -40 || p.y + bh < -40) continue;
      const h = b.height * 5 * cam.zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(p.x + 5, p.y + 5 + h, bw, bh);
      ctx.fillStyle = b.color;
      ctx.fillRect(p.x, p.y, bw, bh);
      ctx.fillStyle = b.roof;
      ctx.fillRect(p.x, p.y, bw, bh * 0.28);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let wy = p.y + bh * 0.35; wy < p.y + bh - 4; wy += 9) {
        for (let wx = p.x + 5; wx < p.x + bw - 6; wx += 11) {
          if ((wx * 7 + wy * 13) % 5 === 0) ctx.fillRect(wx, wy, 4, 5);
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(p.x, p.y, bw, bh);
    }
    // trees and palms
    for (const t of city.trees) {
      const p = worldToScreen(t.x, t.y);
      if (p.x < -20 || p.x > VIEW_W + 20 || p.y < -20 || p.y > VIEW_H + 20) continue;
      ctx.fillStyle = t.palm ? '#2f9e44' : '#40916c';
      ctx.beginPath();
      ctx.arc(p.x, p.y, (t.palm ? 10 : 8) * cam.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // street lamps
    ctx.fillStyle = '#f1c40f';
    for (const l of city.lamps) {
      const p = worldToScreen(l.x, l.y);
      if (p.x < 0 || p.x > VIEW_W || p.y < 0 || p.y > VIEW_H) continue;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    // landmarks
    ctx.font = `bold ${11 * cam.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    for (const key of Object.keys(city.landmarks)) {
      const lm = city.landmarks[key];
      const p = worldToScreen(lm.x, lm.y);
      if (p.x < -60 || p.x > VIEW_W + 60 || p.y < -60 || p.y > VIEW_H + 60) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p.x - 46, p.y - 22, 92, 16);
      ctx.fillStyle = '#ffe66d';
      ctx.fillText(lm.name.toUpperCase(), p.x, p.y - 10);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // roadblocks
    for (const rb of state.roadblocks) {
      const p = worldToScreen(rb.x, rb.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rb.angle);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-46, -8, 92, 16);
      ctx.fillStyle = '#ffffff';
      for (let i = -40; i < 46; i += 16) ctx.fillRect(i, -8, 8, 16);
      ctx.restore();
    }
  }

  function drawCarShape(car, isPlayer) {
    const p = worldToScreen(car.x, car.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.angle);
    const L = 46 * cam.zoom;
    const W = 22 * cam.zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-L / 2 + 3, -W / 2 + 3, L, W);
    ctx.fillStyle = car.color;
    roundRect(-L / 2, -W / 2, L, W, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-L * 0.18, -W / 2 + 2, L * 0.32, W - 4);
    ctx.fillStyle = '#dfe9f3';
    ctx.fillRect(L * 0.22, -W / 2 + 3, 7, W - 6);
    if (car.owner === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-L * 0.05, -W / 2 + 2, L * 0.2, 3);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-L * 0.32, -W / 2 - 2, 5, 4);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(-L * 0.32, W / 2 - 2, 5, 4);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffe66d';
      ctx.lineWidth = 2;
      ctx.strokeRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6);
    }
    ctx.restore();
    // damage smoke
    if (car.hp < 45) {
      ctx.fillStyle = 'rgba(80,80,80,0.6)';
      ctx.beginPath();
      ctx.arc(p.x + (Math.random() - 0.5) * 10, p.y - 12, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPed(ped) {
    const p = worldToScreen(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state, input) {
    const p = state.player;
    if (p.carId) return;
    const s = worldToScreen(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 9, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, 0, 12 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(2, -4, 12, 8);
    ctx.restore();
    // aim line + muzzle flash
    const aim = Math.atan2(input.mouseY - s.y, input.mouseX - s.x);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(aim) * 46, s.y + Math.sin(aim) * 46);
    ctx.stroke();
    if (state.muzzle > 0) {
      ctx.fillStyle = '#ffe66d';
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(aim) * 30, s.y + Math.sin(aim) * 30, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHeli(state) {
    if (!state.heli.active) return;
    const h = state.heli;
    const p = worldToScreen(h.x, h.y);
    // spotlight
    const pp = worldToScreen(state.player.x, state.player.y);
    const grad = ctx.createRadialGradient(pp.x, pp.y, 10, pp.x, pp.y, 130);
    grad.addColorStop(0, 'rgba(255,255,180,0.35)');
    grad.addColorStop(1, 'rgba(255,255,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(h.angle || 0);
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    const r = (h.rotor || 0) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(Math.cos(r) * -34, Math.sin(r) * -8);
    ctx.lineTo(Math.cos(r) * 34, Math.sin(r) * 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawBullets(state) {
    ctx.fillStyle = '#ffe66d';
    for (const b of state.bullets) {
      const p = worldToScreen(b.x, b.y);
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(worldToScreen(pt.x, pt.y).x, worldToScreen(pt.x, pt.y).y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawObjectiveArrow(state) {
    const target = missionTarget(state);
    if (!target) return;
    const t = worldToScreen(target.x, target.y);
    const onScreen = t.x > 30 && t.x < VIEW_W - 30 && t.y > 30 && t.y < VIEW_H - 30;
    const p = state.player;
    if (onScreen) {
      ctx.fillStyle = '#ffe66d';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 26, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', t.x, t.y - 22);
      // marker label
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const label = target.name || 'Objective';
      ctx.fillRect(t.x - ctx.measureText(label).width / 2 - 6, t.y - 52, ctx.measureText(label).width + 12, 16);
      ctx.fillStyle = '#ffe66d';
      ctx.fillText(label, t.x, t.y - 40);
      return;
    }
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const a = Math.atan2(t.y - cy, t.x - cx);
    const ex = cx + Math.cos(a) * (VIEW_W / 2 - 40);
    const ey = cy + Math.sin(a) * (VIEW_H / 2 - 40);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMinimap(state) {
    const mw = 210;
    const mh = 132;
    const mx = VIEW_W - mw - 16;
    const my = VIEW_H - mh - 16;
    const sc = mw / WORLD.size;
    ctx.fillStyle = 'rgba(10,14,28,0.78)';
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(mx, my + mh - 8, mw, 8);
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 2;
    const s = WORLD.roadSpacing * sc;
    for (let x = 0; x <= WORLD.size; x += WORLD.roadSpacing) {
      ctx.beginPath();
      ctx.moveTo(mx + x * sc, my);
      ctx.lineTo(mx + x * sc, my + mh);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.size; y += WORLD.roadSpacing) {
      ctx.beginPath();
      ctx.moveTo(mx, my + y * sc);
      ctx.lineTo(mx + mw, my + y * sc);
      ctx.stroke();
    }
    // districts
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.color + '55';
      ctx.fillRect(mx + d.x * sc, my + d.y * sc, d.w * sc, d.h * sc);
    }
    const target = missionTarget(state);
    if (target) {
      ctx.fillStyle = '#ffe66d';
      ctx.beginPath();
      ctx.arc(mx + target.x * sc, my + target.y * sc, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.owner === 'police') {
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(mx + car.x * sc - 2, my + car.y * sc - 2, 4, 4);
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sc, my + state.player.y * sc, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffe66d';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(districtAt(state.player.x, state.player.y).name.toUpperCase(), mx, my - 10);
  }

  function drawHud(state) {
    // cash + health
    ctx.fillStyle = 'rgba(10,14,28,0.72)';
    ctx.fillRect(14, 12, 250, 64);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${state.cash}`, 26, 38);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(26, 48, 150, 10);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(26, 48, 150 * clamp(state.player.health / 100, 0, 1), 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`HP ${Math.max(0, Math.round(state.player.health))}`, 184, 57);
    // wanted stars
    ctx.fillStyle = 'rgba(10,14,28,0.72)';
    ctx.fillRect(VIEW_W - 210, 12, 196, 44);
    ctx.font = 'bold 26px sans-serif';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? '#ffe66d' : 'rgba(255,255,255,0.25)';
      ctx.fillText('\u2605', VIEW_W - 196 + i * 38, 44);
    }
    // weapon slots
    ctx.fillStyle = 'rgba(10,14,28,0.72)';
    ctx.fillRect(14, VIEW_H - 58, 260, 44);
    WEAPONS.forEach((w, i) => {
      const owned = state.weapons.includes(w.id);
      ctx.fillStyle = state.player.weapon === w.id ? '#ffe66d' : owned ? '#ffffff' : 'rgba(255,255,255,0.3)';
      ctx.font = 'bold 13px sans-serif';
      const ammo = w.ammo === Infinity ? '\u221e' : String(state.ammo[w.id] || 0);
      ctx.fillText(`${i + 1} ${w.name} ${owned ? ammo : '—'}`, 26 + i * 86, VIEW_H - 30);
    });
    // mission banner
    if (state.mission) {
      ctx.fillStyle = 'rgba(10,14,28,0.78)';
      const tw = ctx.measureText(state.missionObjective).width;
      ctx.fillRect(VIEW_W / 2 - tw / 2 - 90, 12, tw + 180, 52);
      ctx.fillStyle = '#ffe66d';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.mission.def.name.toUpperCase(), VIEW_W / 2, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px sans-serif';
      ctx.fillText(state.missionObjective, VIEW_W / 2, 50);
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${Math.ceil(state.mission.timeLeft)}s`, VIEW_W / 2 + tw / 2 + 62, 32);
      ctx.textAlign = 'left';
    }
    // radio + crew
    ctx.fillStyle = 'rgba(10,14,28,0.72)';
    ctx.fillRect(14, 88, 250, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(state.radioOn ? RADIO[state.radio].name : 'Radio off (R)', 24, 107);
    if (state.crewActive) {
      ctx.fillStyle = 'rgba(10,14,28,0.72)';
      ctx.fillRect(14, 124, 250, 24);
      ctx.fillStyle = '#ffe66d';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Crew: ${state.crewActive === 'rook' ? 'Rook driving' : 'Vera on comms'}`, 24, 140);
    }
    // toast
    if (state.toast && state.toastTime > 0) {
      ctx.fillStyle = 'rgba(10,14,28,0.85)';
      const tw = ctx.measureText(state.toast).width;
      ctx.fillRect(VIEW_W / 2 - tw / 2 - 12, VIEW_H - 110, tw + 24, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.toast, VIEW_W / 2, VIEW_H - 90);
      ctx.textAlign = 'left';
    }
    // controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px sans-serif';
    ctx.fillText('WASD drive/walk · E enter car · J jobs · 1-3 weapons · R radio · F save · P pause', 14, VIEW_H - 66);
  }

  function drawMenu(state, kind) {
    ctx.fillStyle = 'rgba(8,10,24,0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    if (kind === 'title') {
      ctx.fillStyle = '#ffe66d';
      ctx.font = 'bold 92px sans-serif';
      ctx.fillText('AZURA BAY', VIEW_W / 2, 190);
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px sans-serif';
      ctx.fillText('An open-world crime story on an invented island', VIEW_W / 2, 232);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#f4845f';
      ctx.fillText('Eight jobs. A crew. A city that remembers.', VIEW_W / 2, 262);
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px sans-serif';
      const lines = [
        'You are a new face in Azura Bay. Abuela Cleo has work for you.',
        '',
        'WASD / Arrows — walk and drive · E — steal / enter a car · J — take a job',
        'Mouse — aim · Click — shoot · 1/2/3 — weapons · R — radio · F — save · P — pause',
        '',
        'Press ENTER to start  ·  Press C to continue your save',
      ];
      lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 330 + i * 26));
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px sans-serif';
      ctx.fillText('A complete original game in plain HTML5 Canvas. No Rockstar assets, no network.', VIEW_W / 2, 620);
    } else if (kind === 'pause') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('PAUSED', VIEW_W / 2, 300);
      ctx.font = '16px sans-serif';
      ctx.fillText('P to resume · F to save · G for garage · Tab for crew', VIEW_W / 2, 340);
    } else if (kind === 'busted') {
      ctx.fillStyle = '#4cc9f0';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText('BUSTED', VIEW_W / 2, 300);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.fillText('The Azura PD took you in. You woke up at Azura General, $200 lighter.', VIEW_W / 2, 340);
      ctx.fillText('Press ENTER to get back out there', VIEW_W / 2, 372);
    } else if (kind === 'wasted') {
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText('WASTED', VIEW_W / 2, 300);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.fillText('You woke up at Azura General, $200 lighter.', VIEW_W / 2, 340);
      ctx.fillText('Press ENTER to get back out there', VIEW_W / 2, 372);
    } else if (kind === 'won') {
      ctx.fillStyle = '#ffe66d';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText('THE AZURA JOB — DONE', VIEW_W / 2, 280);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.fillText('You pulled the final score and flew out of Azura Bay a legend.', VIEW_W / 2, 322);
      ctx.fillText(`Jobs done: ${state.jobsDone} · Cash: $${state.cash}`, VIEW_W / 2, 352);
      ctx.fillText('Press ENTER to keep playing the city', VIEW_W / 2, 392);
    }
    ctx.textAlign = 'left';
  }

  function drawGarage(state) {
    ctx.fillStyle = 'rgba(8,10,24,0.88)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLEO\u2019S GARAGE', VIEW_W / 2, 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Cash: $${state.cash}  ·  Press 1-5 to buy a car, U/I/O to upgrade engine / tires / armor, G to leave`, VIEW_W / 2, 126);
    const models = [
      { id: 'sedan', name: 'Marina Sedan', top: 380, accel: 300, grip: 0.94, price: 0 },
      { id: 'coupe', name: 'Sol Coupe', top: 470, accel: 360, grip: 0.95, price: 1200 },
      { id: 'muscle', name: 'Brasa Muscle', top: 430, accel: 420, grip: 0.9, price: 1800 },
      { id: 'sport', name: 'Azura GT', top: 540, accel: 430, grip: 0.96, price: 3500 },
      { id: 'van', name: 'Docks Van', top: 330, accel: 260, grip: 0.93, price: 900 },
    ];
    models.forEach((m, i) => {
      const y = 170 + i * 74;
      const owned = state.garage.owned.includes(m.id);
      ctx.fillStyle = state.garage.current === m.id ? 'rgba(255,230,109,0.2)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(240, y, 800, 62);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${m.name}`, 260, y + 26);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#cccccc';
      ctx.fillText(`Top ${m.top} · Accel ${m.accel} · Grip ${m.grip}`, 260, y + 48);
      ctx.fillStyle = owned ? '#2ecc71' : '#ffe66d';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(owned ? (state.garage.current === m.id ? 'IN USE' : 'OWNED') : `$${m.price}`, 900, y + 34);
    });
    const up = state.garage.upgrades;
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Upgrades on current car — Engine Lv${up.engine} (U) · Tires Lv${up.tires} (I) · Armor Lv${up.armor} (O)`, 240, 570);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText('Standing raises discounts: each district star is 5% off here.', 240, 596);
    ctx.textAlign = 'left';
  }

  function drawCrew(state) {
    ctx.fillStyle = 'rgba(8,10,24,0.88)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOUR CREW', VIEW_W / 2, 110);
    const rows = [
      { id: 'rook', name: 'Rook', role: 'Getaway driver', bonus: 'Top speed +12%, sharper steering', unlocked: state.crew.rook },
      { id: 'vera', name: 'Vera', role: 'Hacker', bonus: 'Wanted cools 40% faster, roadblocks arrive late', unlocked: state.crew.vera },
      { id: null, name: 'Solo', role: 'Just you', bonus: 'No bonus, no backup', unlocked: true },
    ];
    rows.forEach((r, i) => {
      const y = 180 + i * 110;
      ctx.fillStyle = state.crewActive === r.id ? 'rgba(255,230,109,0.2)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(300, y, 680, 88);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${r.name} — ${r.role}`, 330, y + 34);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = r.unlocked ? '#2ecc71' : '#e74c3c';
      ctx.fillText(r.unlocked ? r.bonus : 'Locked — finish the crew jobs to recruit', 330, y + 62);
    });
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press 1-3 to pick who rides with you · Tab to close', VIEW_W / 2, 540);
    ctx.textAlign = 'left';
  }

  function drawJobs(state) {
    ctx.fillStyle = 'rgba(8,10,24,0.88)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JOBS — ABUELA CLEO', VIEW_W / 2, 90);
    const { MISSIONS } = state;
    MISSIONS.forEach((m, i) => {
      const y = 130 + i * 62;
      const done = i < state.jobsDone;
      const available = i === state.jobsDone;
      ctx.fillStyle = available ? 'rgba(255,230,109,0.18)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(220, y, 840, 52);
      ctx.fillStyle = done ? '#2ecc71' : available ? '#ffffff' : 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${m.name} — $${m.pay}`, 240, y + 22);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(m.brief, 240, y + 42);
      ctx.fillStyle = done ? '#2ecc71' : available ? '#ffe66d' : '#888888';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(done ? 'DONE' : available ? 'AVAILABLE' : 'LOCKED', 920, y + 28);
    });
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press 1-8 to start a job · J to close', VIEW_W / 2, 660);
    ctx.textAlign = 'left';
  }

  function render(state, input, screen) {
    updateCamera(state);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawWorld(state);
    for (const car of state.cars) {
      if (car.owner === 'police' || car.owner === 'player' || car.owner === 'parked' || car.owner === 'traffic') {
        drawCarShape(car, car.id === state.player.carId);
      }
    }
    for (const ped of state.peds) drawPed(ped);
    drawBullets(state);
    drawHeli(state);
    drawPlayer(state, input);
    drawObjectiveArrow(state);
    // time-of-day tint
    const tint = skyTint(state.timeOfDay);
    if (tint.alpha > 0) {
      ctx.fillStyle = tint.color;
      ctx.globalAlpha = tint.alpha;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (screen === 'play') {
      drawHud(state);
      drawMinimap(state);
    } else if (screen === 'title') drawMenu(state, 'title');
    else if (screen === 'pause') drawMenu(state, 'pause');
    else if (screen === 'busted') drawMenu(state, 'busted');
    else if (screen === 'wasted') drawMenu(state, 'wasted');
    else if (screen === 'won') drawMenu(state, 'won');
    else if (screen === 'garage') drawGarage(state);
    else if (screen === 'crew') drawCrew(state);
    else if (screen === 'jobs') drawJobs(state);
  }

  return { render, updateCamera };
}
