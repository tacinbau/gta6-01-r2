// Drawing only: the world's state and the current screen in, pixels out. The camera follows
// the player across the 3200x2400 island; the HUD, minimap and panels are drawn in screen
// space. Flat shapes and canvas text, no images, no network.
import { BANK, CARS, CASINO, DISTRICTS, FIXER, FONT, GARAGE, MARINA_BASIN, PALETTE, ROADS_X, ROADS_Y, ROAD_W, SAFEHOUSE, UPGRADES, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_GARAGE = 'garage';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const VIEW_W = 1280;
const VIEW_H = 720;

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  return ((h * 1274126177) | 0) >>> 0;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.ox = (canvas.width - VIEW_W * view.scale) / 2;
    view.oy = (canvas.height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function rrect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  /** A tree with a soft shadow: palms get fronds, round trees a lumpy canopy. */
  function drawTree(x, y, r, color, isPalm) {
    context.fillStyle = PALETTE.shadow;
    context.beginPath();
    context.ellipse(x + 3, y + 4, r, r * 0.7, 0, 0, Math.PI * 2);
    context.fill();
    if (isPalm) {
      context.fillStyle = PALETTE.trunk;
      context.fillRect(x - 2, y - 2, 4, 10);
      circle(x, y - 4, r, color);
      circle(x - r * 0.55, y + 3, r * 0.55, '#4a8a44');
      circle(x + r * 0.55, y + 3, r * 0.55, '#4a8a44');
    } else {
      circle(x, y, r, color);
      circle(x - r * 0.4, y - r * 0.25, r * 0.6, color);
      circle(x + r * 0.35, y - r * 0.3, r * 0.55, color);
      circle(x, y - r * 0.35, r * 0.35, 'rgba(255,255,255,0.18)');
    }
  }

  /** A moored boat: hull with a shadow, cabin, and a mast. */
  function drawBoat(boat) {
    context.save();
    context.translate(boat.x, boat.y);
    context.rotate(boat.angle);
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.beginPath();
    context.ellipse(2, 3, boat.len / 2, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = boat.color;
    rrect(-boat.len / 2, -7, boat.len, 14, 7);
    context.fill();
    context.fillStyle = 'rgba(20,28,40,0.8)';
    rrect(-boat.len / 4, -4, boat.len / 2, 8, 3);
    context.fill();
    context.strokeStyle = '#6a4a2a';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(0, -20);
    context.stroke();
    context.lineWidth = 1;
    context.restore();
  }

  function drawCarShape(x, y, angle, color, isPolice, time) {
    // Soft shadow in world space, so it stays put when the car turns.
    context.fillStyle = PALETTE.shadow;
    context.beginPath();
    context.ellipse(x + 3, y + 5, 24, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    // Wheels.
    context.fillStyle = '#16181c';
    context.fillRect(-17, -13, 10, 5);
    context.fillRect(7, -13, 10, 5);
    context.fillRect(-17, 8, 10, 5);
    context.fillRect(7, 8, 10, 5);
    // Body with rounded corners.
    context.fillStyle = color;
    rrect(-22, -11, 44, 22, 6);
    context.fill();
    // Roof and glass.
    context.fillStyle = 'rgba(0,0,0,0.22)';
    rrect(-8, -9, 16, 18, 4);
    context.fill();
    context.fillStyle = 'rgba(20,28,40,0.85)';
    rrect(8, -8, 7, 16, 2);
    context.fill();
    context.fillStyle = 'rgba(20,28,40,0.7)';
    rrect(-16, -8, 6, 16, 2);
    context.fill();
    // Headlights and taillights.
    context.fillStyle = '#ffe9a0';
    context.fillRect(20, -9, 3, 4);
    context.fillRect(20, 5, 3, 4);
    context.fillStyle = '#e5534b';
    context.fillRect(-23, -9, 3, 4);
    context.fillRect(-23, 5, 3, 4);
    if (isPolice) {
      // White body stripe and a flashing light bar on the roof.
      context.fillStyle = '#f2f0e8';
      context.fillRect(-2, -11, 8, 22);
      const blink = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = blink ? '#ff5a50' : '#5a9aff';
      context.fillRect(-4, -6, 8, 5);
      context.fillStyle = blink ? '#5a9aff' : '#ff5a50';
      context.fillRect(-4, 1, 8, 5);
    }
    context.restore();
  }

  function drawWorld(world, state, cam) {
    const { buildings, palms, groundPatches, speckles, sandSpeckles, waves, parks, plaza, roundabout, streetlights, signs, boats } = world;
    const t = state.time;
    // Water around the island, with a sand beach and grass inside.
    context.fillStyle = PALETTE.water;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.waterDeep;
    context.fillRect(0, 0, WORLD.width, 26);
    context.fillRect(0, WORLD.height - 26, WORLD.width, 26);
    context.fillRect(0, 0, 26, WORLD.height);
    context.fillRect(WORLD.width - 26, 0, 26, WORLD.height);
    // Gentle wave arcs just off the sand.
    context.strokeStyle = 'rgba(242,240,232,0.35)';
    context.lineWidth = 2;
    for (const w of waves) {
      context.beginPath();
      context.arc(w.x, w.y, w.r, 0.15 * Math.PI, 0.85 * Math.PI);
      context.stroke();
    }
    context.lineWidth = 1;
    context.fillStyle = PALETTE.sand;
    context.fillRect(50, 50, WORLD.width - 100, WORLD.height - 100);
    for (const s of sandSpeckles) {
      context.fillStyle = s.color;
      context.fillRect(s.x, s.y, 3, 3);
    }
    context.fillStyle = PALETTE.grass;
    context.fillRect(150, 150, WORLD.width - 300, WORLD.height - 300);
    // Varied ground: dry patches and grass speckles, never one flat fill.
    for (const patch of groundPatches) {
      context.fillStyle = patch.color;
      context.globalAlpha = 0.5;
      context.beginPath();
      context.ellipse(patch.x, patch.y, patch.rx, patch.ry, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const s of speckles) {
      context.fillStyle = s.color;
      context.fillRect(s.x, s.y, 3, 3);
    }
    // District washes.
    for (const d of DISTRICTS) {
      context.fillStyle = d.tint;
      context.globalAlpha = 0.16;
      context.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      context.globalAlpha = 1;
    }
    // Parks: paths, trees, bushes.
    for (const park of parks) {
      for (const path of park.paths) {
        context.fillStyle = PALETTE.parkPath;
        context.fillRect(path.x, path.y, path.w, path.h);
      }
      for (const tree of park.trees) drawTree(tree.x, tree.y, tree.r, tree.color, false);
      for (const bush of park.bushes) {
        circle(bush.x, bush.y, bush.r, PALETTE.bush);
        circle(bush.x - bush.r * 0.3, bush.y - bush.r * 0.3, bush.r * 0.55, '#3f7a3a');
      }
    }
    // Sidewalks with curbs, then the asphalt, edge lines and centre dashes.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_W / 2 - 18, 150, ROAD_W + 36, WORLD.height - 300);
    for (const ry of ROADS_Y) context.fillRect(150, ry - ROAD_W / 2 - 18, WORLD.width - 300, ROAD_W + 36);
    context.fillStyle = PALETTE.curb;
    for (const rx of ROADS_X) {
      context.fillRect(rx - ROAD_W / 2 - 18, 150, 3, WORLD.height - 300);
      context.fillRect(rx + ROAD_W / 2 + 15, 150, 3, WORLD.height - 300);
    }
    for (const ry of ROADS_Y) {
      context.fillRect(150, ry - ROAD_W / 2 - 18, WORLD.width - 300, 3);
      context.fillRect(150, ry + ROAD_W / 2 + 15, WORLD.width - 300, 3);
    }
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_W / 2, 150, ROAD_W, WORLD.height - 300);
    for (const ry of ROADS_Y) context.fillRect(150, ry - ROAD_W / 2, WORLD.width - 300, ROAD_W);
    context.fillStyle = PALETTE.roadEdge;
    for (const rx of ROADS_X) {
      context.fillRect(rx - ROAD_W / 2 + 5, 150, 2, WORLD.height - 300);
      context.fillRect(rx + ROAD_W / 2 - 7, 150, 2, WORLD.height - 300);
    }
    for (const ry of ROADS_Y) {
      context.fillRect(150, ry - ROAD_W / 2 + 5, WORLD.width - 300, 2);
      context.fillRect(150, ry + ROAD_W / 2 - 7, WORLD.width - 300, 2);
    }
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = 170; y < WORLD.height - 170; y += 64) context.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROADS_Y) {
      for (let x = 170; x < WORLD.width - 170; x += 64) context.fillRect(x, ry - 2, 30, 4);
    }
    // Crosswalks at every intersection: stripes across the road on two approaches.
    context.fillStyle = PALETTE.crosswalk;
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = 0; i < 5; i += 1) {
          context.fillRect(rx - ROAD_W / 2 + 8 + i * 20, ry - ROAD_W / 2 - 26, 10, 14);
          context.fillRect(rx - ROAD_W / 2 - 26, ry - ROAD_W / 2 + 8 + i * 20, 14, 10);
        }
      }
    }
    // The roundabout: a paved ring with a grass island and a tree in the middle.
    context.fillStyle = PALETTE.sidewalk;
    context.beginPath();
    context.arc(roundabout.x, roundabout.y, roundabout.r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.road;
    context.beginPath();
    context.arc(roundabout.x, roundabout.y, roundabout.r - 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.grass;
    context.beginPath();
    context.arc(roundabout.x, roundabout.y, 26, 0, Math.PI * 2);
    context.fill();
    drawTree(roundabout.x, roundabout.y, 16, '#3f7a3a', false);
    // The plaza: a paved square with tile joints, benches and corner trees.
    context.fillStyle = PALETTE.plaza;
    context.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
    context.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let gx = plaza.x + 40; gx < plaza.x + plaza.w; gx += 40) {
      context.beginPath();
      context.moveTo(gx, plaza.y);
      context.lineTo(gx, plaza.y + plaza.h);
      context.stroke();
    }
    for (let gy = plaza.y + 40; gy < plaza.y + plaza.h; gy += 40) {
      context.beginPath();
      context.moveTo(plaza.x, gy);
      context.lineTo(plaza.x + plaza.w, gy);
      context.stroke();
    }
    for (const bench of plaza.benches) {
      context.fillStyle = '#7a5a3a';
      context.fillRect(bench.x, bench.y, bench.w, bench.h);
    }
    for (const tree of plaza.trees) drawTree(tree.x, tree.y, tree.r, tree.color, false);
    // The marina basin: water, docks, moored boats.
    context.fillStyle = PALETTE.water;
    context.fillRect(MARINA_BASIN.x, MARINA_BASIN.y, MARINA_BASIN.w, MARINA_BASIN.h);
    context.fillStyle = PALETTE.waterDeep;
    context.fillRect(MARINA_BASIN.x, MARINA_BASIN.y, MARINA_BASIN.w, 8);
    for (const boat of boats) {
      if (boat.dock) {
        context.fillStyle = PALETTE.dock;
        context.fillRect(boat.x, boat.y, boat.len, 14);
        continue;
      }
      drawBoat(boat);
    }
    // Buildings: soft shadow, varied roof, parapet edge, rooftop clutter — no window grids.
    for (const b of buildings) {
      context.fillStyle = PALETTE.shadow;
      for (const part of b.parts) {
        rrect(part.x + 6, part.y + 8, part.w, part.h, 4);
        context.fill();
      }
      for (const part of b.parts) {
        context.fillStyle = b.roof;
        rrect(part.x, part.y, part.w, part.h, 4);
        context.fill();
        context.strokeStyle = PALETTE.parapet;
        context.lineWidth = 3;
        rrect(part.x + 4, part.y + 4, part.w - 8, part.h - 8, 3);
        context.stroke();
        context.lineWidth = 1;
      }
      for (const f of b.features) {
        if (f.type === 'ac') {
          context.fillStyle = '#9a9a92';
          context.fillRect(f.x, f.y, f.w, f.h);
          context.fillStyle = '#6a6a62';
          context.fillRect(f.x + 2, f.y + 2, f.w - 4, 2);
        } else if (f.type === 'vent') {
          circle(f.x + f.w / 2, f.y + f.h / 2, Math.min(f.w, f.h) / 2, '#5a5a52');
        } else {
          context.fillStyle = PALETTE.skylight;
          context.fillRect(f.x, f.y, f.w, f.h);
          context.fillStyle = 'rgba(255,255,255,0.5)';
          context.fillRect(f.x, f.y, f.w, 2);
        }
      }
    }
    // Trees and bushes.
    for (const palm of palms) {
      if (palm.kind === 'bush') {
        circle(palm.x, palm.y, palm.r, PALETTE.bush);
        circle(palm.x - palm.r * 0.3, palm.y - palm.r * 0.3, palm.r * 0.55, '#3f7a3a');
      } else {
        drawTree(palm.x, palm.y, palm.r, palm.color, palm.kind === 'palm');
      }
    }
    // Streetlights and signs.
    for (const light of streetlights) {
      circle(light.x, light.y, 2, '#2a2a30');
      circle(light.x, light.y, 1.5, '#d8d8c8');
    }
    for (const sign of signs) {
      context.fillStyle = '#2a2a30';
      context.fillRect(sign.x - 1, sign.y - 1, 2, 12);
      context.fillStyle = sign.color;
      context.fillRect(sign.x - 7, sign.y - 9, 14, 9);
    }
    // District names, faded on the ground.
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const d of DISTRICTS) {
      const cx = (d.x0 + d.x1) / 2;
      const cy = (d.y0 + d.y1) / 2;
      text(d.name.toUpperCase(), cx, cy, 44, 'rgba(255,255,255,0.20)', 'center', 'middle');
    }
    // Garage and landmark plaques.
    context.fillStyle = '#22262e';
    context.fillRect(GARAGE.x - 60, GARAGE.y - 40, 120, 80);
    text('GARAGE', GARAGE.x, GARAGE.y + 5, 20, PALETTE.gold, 'center', 'middle');
    const plaques = [
      { x: BANK.x, y: BANK.y, label: 'BANK', color: '#f2c94c' },
      { x: CASINO.x, y: CASINO.y, label: 'CASINO', color: '#c94fb5' },
      { x: FIXER.x, y: FIXER.y, label: 'CLEO', color: '#e5534b' },
      { x: SAFEHOUSE.x, y: SAFEHOUSE.y, label: 'SAFEHOUSE', color: '#7ac94f' },
    ];
    for (const plaque of plaques) {
      context.fillStyle = 'rgba(16,18,24,0.85)';
      context.fillRect(plaque.x - 44, plaque.y - 13, 88, 26);
      context.strokeStyle = plaque.color;
      context.lineWidth = 2;
      context.strokeRect(plaque.x - 44, plaque.y - 13, 88, 26);
      context.lineWidth = 1;
      text(plaque.label, plaque.x, plaque.y, 13, plaque.color, 'center', 'middle');
    }
    // Roadblocks.
    for (const block of state.roadblocks) {
      context.save();
      context.translate(block.x, block.y);
      context.rotate(block.angle);
      context.fillStyle = '#e5534b';
      context.fillRect(-60, -8, 120, 16);
      context.fillStyle = '#f2f0e8';
      for (let x = -60; x < 60; x += 24) context.fillRect(x, -8, 12, 16);
      context.restore();
    }
    // Convoy trucks and the ghost coupe.
    for (const truck of state.convoy) drawCarShape(truck.x, truck.y, truck.angle, '#c9a13b', false, t);
    if (state.ghost) drawCarShape(state.ghost.x, state.ghost.y, state.ghost.angle, '#22262e', false, t);
    // Traffic, parked and garage cars.
    for (const car of state.cars) {
      if (car.kind === 'wreck') {
        context.save();
        context.translate(car.x, car.y);
        context.rotate(car.angle);
        context.fillStyle = '#333';
        rrect(-22, -11, 44, 22, 6);
        context.fill();
        context.fillStyle = 'rgba(0,0,0,0.4)';
        rrect(-8, -9, 16, 18, 4);
        context.fill();
        context.restore();
        continue;
      }
      drawCarShape(car.x, car.y, car.angle, car.color, false, t);
    }
    // Cruisers.
    for (const cop of state.cruisers) {
      if (cop.dead) continue;
      drawCarShape(cop.x, cop.y, cop.angle, PALETTE.police, true, t);
    }
    // Pedestrians, with a shadow and a facing tick.
    for (const ped of state.peds) {
      context.fillStyle = PALETTE.shadow;
      context.beginPath();
      context.ellipse(ped.x + 2, ped.y + 3, 8, 5, 0, 0, Math.PI * 2);
      context.fill();
      circle(ped.x, ped.y, 7, ped.color);
      circle(ped.x, ped.y - 4, 4, '#d8b48a');
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.moveTo(ped.x, ped.y);
      context.lineTo(ped.x + Math.cos(ped.angle) * 10, ped.y + Math.sin(ped.angle) * 10);
      context.stroke();
    }
    // The player: on foot a person, in a car the car itself with a marker.
    const p = state.player;
    if (p.inCar) {
      drawCarShape(p.x, p.y, p.angle, p.inCar.color, false, t);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, 30, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth = 1;
    } else {
      context.fillStyle = PALETTE.shadow;
      context.beginPath();
      context.ellipse(p.x + 2, p.y + 3, 14, 8, 0, 0, Math.PI * 2);
      context.fill();
      circle(p.x, p.y, 13, '#e8b13c');
      circle(p.x, p.y - 5, 6, '#d8b48a');
      // Aim line for the held weapon.
      const wx = p.x + Math.cos(p.aimAngle) * 60;
      const wy = p.y + Math.sin(p.aimAngle) * 60;
      context.strokeStyle = 'rgba(242,240,232,0.6)';
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(wx, wy);
      context.stroke();
      circle(wx, wy, 3, PALETTE.gold);
    }
    // Objective marker.
    if (state.objective) {
      const o = state.objective;
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(o.x, o.y, 26 + 6 * Math.sin(t * 4), 0, Math.PI * 2);
      context.stroke();
      context.lineWidth = 1;
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(o.x, o.y - 40);
      context.lineTo(o.x - 10, o.y - 22);
      context.lineTo(o.x + 10, o.y - 22);
      context.closePath();
      context.fill();
    }
    // Time of day wash.
    if (state.timeOfDay === 2) {
      context.fillStyle = PALETTE.night;
      context.fillRect(cam.x - 700, cam.y - 400, 1400, 800);
    } else if (state.timeOfDay === 1) {
      context.fillStyle = PALETTE.dusk;
      context.fillRect(cam.x - 700, cam.y - 400, 1400, 800);
    }
    // Lights over the wash: the heli and its spotlight, streetlight pools, the player's
    // headlight cone, and a few lit windows on the rooftops at night.
    if (state.heli) {
      const h = state.heli;
      context.fillStyle = 'rgba(240,230,140,0.12)';
      context.beginPath();
      context.moveTo(h.x, h.y);
      context.lineTo(state.player.x - 90, state.player.y + 60);
      context.lineTo(state.player.x + 90, state.player.y + 60);
      context.closePath();
      context.fill();
      circle(h.x, h.y, 26, '#22262e');
      context.strokeStyle = '#f2f0e8';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(h.x - 34, h.y);
      context.lineTo(h.x + 34, h.y);
      context.stroke();
      context.lineWidth = 1;
    }
    if (state.timeOfDay > 0) {
      for (const light of streetlights) {
        if (Math.abs(light.x - cam.x) > 700 || Math.abs(light.y - cam.y) > 400) continue;
        context.fillStyle = PALETTE.glowWarm;
        context.beginPath();
        context.arc(light.x, light.y, 16, 0, Math.PI * 2);
        context.fill();
      }
      if (p.inCar) {
        context.fillStyle = 'rgba(240,230,140,0.14)';
        context.beginPath();
        context.moveTo(p.x, p.y);
        const a = p.angle;
        context.lineTo(p.x + Math.cos(a - 0.28) * 260, p.y + Math.sin(a - 0.28) * 260);
        context.lineTo(p.x + Math.cos(a + 0.28) * 260, p.y + Math.sin(a + 0.28) * 260);
        context.closePath();
        context.fill();
      }
      if (state.timeOfDay === 2) {
        for (const b of buildings) {
          if (Math.abs(b.x + b.w / 2 - cam.x) > 700 || Math.abs(b.y + b.h / 2 - cam.y) > 400) continue;
          for (let i = 0; i < 3; i += 1) {
            if (hash2(Math.round(b.x) + i * 57, Math.round(b.y) + i * 31) % 2 === 0) {
              context.fillStyle = 'rgba(255,200,90,0.75)';
              const wx = b.x + 14 + ((hash2(Math.round(b.x) + i * 13, 7) % 60) / 60) * Math.max(1, b.w - 28);
              const wy = b.y + 14 + ((hash2(Math.round(b.y) + i * 17, 11) % 60) / 60) * Math.max(1, b.h - 28);
              context.fillRect(wx, wy, 5, 5);
            }
          }
        }
      }
    }
  }

  function drawMinimap(state, cam) {
    const mw = 220;
    const mh = 165;
    const mx = VIEW_W - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = 'rgba(10,12,16,0.75)';
    context.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    context.fillStyle = '#3d7ea6';
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = '#6f9e5e';
    context.fillRect(mx + 150 * sx, my + 150 * sy, (WORLD.width - 300) * sx, (WORLD.height - 300) * sy);
    context.fillStyle = '#3d7ea6';
    context.fillRect(mx + MARINA_BASIN.x * sx, my + MARINA_BASIN.y * sy, MARINA_BASIN.w * sx, MARINA_BASIN.h * sy);
    context.fillStyle = '#3a3a42';
    for (const rx of ROADS_X) context.fillRect(mx + rx * sx - 1, my, 2, mh);
    for (const ry of ROADS_Y) context.fillRect(mx, my + ry * sy - 1, mw, 2);
    if (state.objective) {
      circle(mx + state.objective.x * sx, my + state.objective.y * sy, 4, PALETTE.gold);
    }
    for (const cop of state.cruisers) {
      if (!cop.dead) circle(mx + cop.x * sx, my + cop.y * sy, 3, '#e5534b');
    }
    if (state.heli) circle(mx + state.heli.x * sx, my + state.heli.y * sy, 4, '#e5534b');
    circle(mx + state.player.x * sx, my + state.player.y * sy, 4, '#ffffff');
    // Viewport box.
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.strokeRect(mx + (cam.x - 640) * sx, my + (cam.y - 360) * sy, 1280 * sx, 720 * sy);
  }

  function drawHud(state, world, cam) {
    const p = state.player;
    const stars = Math.min(5, Math.floor(state.heat / 20));
    // Cash and district.
    context.fillStyle = PALETTE.panel;
    context.fillRect(12, 12, 210, 64);
    text(`$${state.cash}`, 24, 40, 30, '#5ee08a', 'left', 'top');
    const district = world.districtAt(p.x, p.y);
    text(district.name, 24, 66, 16, PALETTE.muted, 'left', 'top');
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text('★', 240 + i * 26, 40, 28, i < stars ? PALETTE.gold : 'rgba(255,255,255,0.25)', 'left', 'top');
    }
    // Mission banner.
    if (state.bannerTimer > 0 && state.banner) {
      const w = Math.min(760, 40 + state.banner.length * 9);
      context.fillStyle = PALETTE.panel;
      context.fillRect((VIEW_W - w) / 2, 12, w, 52);
      text(state.banner, VIEW_W / 2, 38, 19, PALETTE.text, 'center', 'top');
    }
    // Objective label under the banner.
    if (state.objective) {
      text(state.objective.label, VIEW_W / 2, 78, 18, PALETTE.gold, 'center', 'top');
    }
    drawMinimap(state, cam);
    // Weapon slots.
    const weapons = ['Fists', 'Pistol', 'SMG'];
    context.fillStyle = PALETTE.panel;
    context.fillRect(12, VIEW_H - 64, 300, 44);
    for (let i = 0; i < 3; i += 1) {
      const ammo = state.ammo[i] === Infinity ? '∞' : String(state.ammo[i]);
      text(`${i + 1} ${weapons[i]} ${ammo}`, 24 + i * 100, VIEW_H - 34, 17, i === state.weapon ? PALETTE.gold : PALETTE.muted, 'left', 'top');
    }
    // Health, speed, radio.
    text(`Health ${Math.max(0, Math.round(p.health))}`, 330, VIEW_H - 34, 17, p.health > 40 ? PALETTE.text : PALETTE.red, 'left', 'top');
    if (p.inCar) {
      text(`${Math.round(Math.abs(p.speed) * 0.22)} mph`, VIEW_W - 240, VIEW_H - 34, 17, PALETTE.text, 'left', 'top');
    }
    text(`Radio: ${state.radioName || 'Sol Mar FM'}`, VIEW_W - 240, VIEW_H - 60, 15, PALETTE.muted, 'left', 'top');
    text('WASD drive / walk   E enter car   Click shoot   1-3 weapons   R radio   G garage   P pause', VIEW_W / 2, VIEW_H - 24, 13, PALETTE.muted, 'center', 'top');
    // Off-screen objective arrow.
    if (state.objective) {
      const o = state.objective;
      const dx = o.x - cam.x;
      const dy = o.y - cam.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 560) {
        const ax = VIEW_W / 2 + (dx / dist) * 420;
        const ay = VIEW_H / 2 + (dy / dist) * 260;
        const ang = Math.atan2(dy, dx);
        context.save();
        context.translate(ax, ay);
        context.rotate(ang);
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.moveTo(18, 0);
        context.lineTo(-10, -12);
        context.lineTo(-10, 12);
        context.closePath();
        context.fill();
        context.restore();
        text(`${Math.round(dist / 50) * 50}m`, ax, ay + 26, 15, PALETTE.gold, 'center', 'top');
      }
    }
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 32 + 70;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    text(title, VIEW_W / 2, y + 62, 44, PALETTE.text, 'center', 'top');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 128 + i * 32, 20, PALETTE.muted, 'center', 'top');
    }
    text(prompt, VIEW_W / 2, y + height - 44, 22, PALETTE.gold, 'center', 'top');
  }

  function drawGarage(state, world, garage) {
    context.fillStyle = 'rgba(8,10,14,0.72)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    const width = 760;
    const height = 560;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    text('AZURA GARAGE', VIEW_W / 2, y + 44, 36, PALETTE.text, 'center', 'top');
    text(`Cash $${state.cash}   Downtown standing ${state.standing.downtown}/5 — ${world.garageDiscount()}% off`, VIEW_W / 2, y + 88, 18, PALETTE.muted, 'center', 'top');
    let rowY = y + 130;
    CARS.forEach((car, i) => {
      const owned = state.ownedCars.includes(car.id);
      const price = Math.round(car.price * (1 - world.garageDiscount() / 100));
      const sel = garage.selected === i;
      const up = state.upgrades[car.id];
      const upText = up ? `  Engine ${up.engine}/3  Tires ${up.tires}/3  Armor ${up.armor}/3` : '';
      text(`${sel ? '>' : ' '} ${i + 1} ${car.name} — top ${car.top}${owned ? '  OWNED' + upText : `  $${price}`}`, x + 40, rowY, 20, sel ? PALETTE.gold : PALETTE.text, 'left', 'top');
      rowY += 34;
    });
    text('1-5 select a car (buy it if you can afford it) — Z engine, X tires, C armor for the selected car', VIEW_W / 2, y + height - 96, 17, PALETTE.muted, 'center', 'top');
    text('G or Esc to leave the garage', VIEW_W / 2, y + height - 60, 18, PALETTE.gold, 'center', 'top');
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(world, state, screen, best, garage) {
    const p = state.player;
    const cam = {
      x: Math.max(640, Math.min(WORLD.width - 640, p.x)),
      y: Math.max(360, Math.min(WORLD.height - 360, p.y)),
    };
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.ox - cam.x * view.scale + (VIEW_W / 2) * view.scale, view.oy - cam.y * view.scale + (VIEW_H / 2) * view.scale);
    drawWorld(world, state, cam);
    context.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(8,10,14,0.55)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('AZURA BAY', [
        'A sun-soaked island. Eight jobs. One fixer: Abuela Cleo.',
        'Steal cars, lose the tail, win the street race, take the casino.',
        'WASD drive and walk — E enter a car — mouse to aim, click to shoot.',
        `Missions done: ${state.missionsDone} of 8.`,
      ], 'Press Space or click to start');
      return;
    }
    drawHud(state, world, cam);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The island waits for you.'], 'Press P to keep playing');
    } else if (screen === SCREEN_GARAGE) {
      drawGarage(state, world, garage);
    } else if (screen === SCREEN_OVER) {
      drawPanel(state.overKind === 'busted' ? 'Busted' : 'Wasted', [
        `Cash $${state.cash} — missions done ${state.missionsDone} of 8.`,
        'The hospital and the fine both cost $200.',
      ], 'Press Space to get back out there');
    } else if (screen === SCREEN_WIN) {
      drawPanel('AZURA BAY IS YOURS', [
        'The Casino Score is done. Cleo is proud. The island is yours.',
        `Cash $${state.cash} — all 8 missions done.`,
      ], 'Press Space to keep cruising');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
