// Three.js renderer: low-poly Azura Bay, chase camera, dusk/day/night skies.
// All textures are procedural canvases drawn with the seeded RNG — no network, no assets.
import * as THREE from 'three';
import { makeRng } from './random.js';
import { CITY, DISTRICTS, TUNING } from './config.js';
import { ROADS, trafficLightState } from './world.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowsTexture(rng, base, floors) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // Floor bands every 3 floors — the tower reads as stacked slabs, not a flat slab.
    for (let f = 0; f < floors; f += 3) {
      const y = (f / floors) * h;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, w, 5);
    }
    for (let f = 0; f < floors; f++) {
      for (let col = 0; col < 6; col++) {
        const lit = rng.chance(0.55);
        g.fillStyle = lit ? '#ffd98a' : 'rgba(20,26,34,0.9)';
        g.fillRect(10 + col * 19, 12 + f * (h - 20) / floors, 12, 9);
      }
    }
  });
}

function awningTexture(c1, c2) {
  return canvasTexture(128, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, h); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 8, w, 8);
  });
}

function signTexture(text, fg, bg) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function groundTexture() {
  return canvasTexture(1024, 1024, (g, w, h) => {
    const S = 1024 / 560; const X = (x) => (x + 280) * S; const Z = (z) => (z + 280) * S;
    g.fillStyle = '#6a6a5e'; g.fillRect(0, 0, w, h); // dry ground
    g.fillStyle = '#c9b078'; g.fillRect(X(185), 0, w - X(185), h); // sand strip (east)
    g.fillStyle = '#8a6f4a'; g.fillRect(X(-168), Z(-92), 96 * S, 64 * S); // market plaza dirt
    for (const r of ROADS) { // asphalt + sidewalks
      g.strokeStyle = '#9a9a92'; g.lineWidth = 20 * S; g.lineCap = 'round';
      g.beginPath(); g.moveTo(X(r.x1), Z(r.z1)); g.lineTo(X(r.x2), Z(r.z2)); g.stroke();
      g.strokeStyle = '#3c3c40'; g.lineWidth = 14 * S;
      g.beginPath(); g.moveTo(X(r.x1), Z(r.z1)); g.lineTo(X(r.x2), Z(r.z2)); g.stroke();
      g.strokeStyle = '#e8c83c'; g.lineWidth = 1.5 * S; g.setLineDash([4 * S, 6 * S]);
      g.beginPath(); g.moveTo(X(r.x1), Z(r.z1)); g.lineTo(X(r.x2), Z(r.z2)); g.stroke();
      g.setLineDash([]);
    }
  });
}

// Triangular-prism gable roof (ridge along z).
function gableRoofGeometry(w, d, rh) {
  const hw = w / 2, hd = d / 2;
  const v = [
    // front gable (z = +hd)
    -hw, 0, hd, hw, 0, hd, 0, rh, hd,
    // back gable (z = -hd)
    hw, 0, -hd, -hw, 0, -hd, 0, rh, -hd,
    // left slope
    -hw, 0, -hd, -hw, 0, hd, 0, rh, hd, -hw, 0, -hd, 0, rh, hd, 0, rh, -hd,
    // right slope
    hw, 0, hd, hw, 0, -hd, 0, rh, -hd, hw, 0, hd, 0, rh, -hd, 0, rh, hd,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createGame(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1280 / 720, 0.5, 1500);
  return { renderer, scene, camera };
}

export function buildCity(game, world, tod) {
  const { scene } = game;
  const rng = makeRng(world.seed + 77);
  const dusk = tod === 'dusk', night = tod === 'night';
  scene.fog = new THREE.Fog(night ? 0x0a0e1e : dusk ? 0x3a2438 : 0x9fc4e0, 160, 620);
  scene.background = new THREE.Color(night ? 0x0a0e1e : dusk ? 0x3a2438 : 0x87b8dd);

  // ---- Lights.
  const sun = new THREE.DirectionalLight(night ? 0x8fa8ff : dusk ? 0xff9a5a : 0xfff2d8, night ? 0.55 : dusk ? 1.1 : 1.6);
  sun.position.set(night ? -80 : 140, night ? 120 : 90, night ? 60 : -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(night ? 0x24305a : dusk ? 0x8a5a70 : 0xbfd9ee, 0x3a3230, night ? 0.5 : 0.75));

  // ---- Sky dome: dusk gradient + stars + moon + clouds.
  const skyGeo = new THREE.SphereGeometry(780, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(night ? 0x05070f : dusk ? 0x2a1a3a : 0x3f7ec0) },
      mid: { value: new THREE.Color(night ? 0x101a33 : dusk ? 0x8a3a4a : 0x8fc0e8) },
      bot: { value: new THREE.Color(night ? 0x1a2440 : dusk ? 0xe07840 : 0xf0d8a0) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;' +
      'void main(){ float y = normalize(vP).y; vec3 c = y > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, y)) : mix(bot, mid, smoothstep(-0.05, 0.25, y)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 420; i++) {
    const a = rng.range(0, Math.PI * 2), e = rng.range(0.15, 1.4), r = 740;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: night ? 0.9 : dusk ? 0.45 : 0.12, fog: false })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(26, 32), new THREE.MeshBasicMaterial({ color: 0xf4ecd8, fog: false }));
  moon.position.set(-260, 300, -560); moon.lookAt(0, 0, 0);
  moon.visible = tod !== 'day'; // no moon in the daytime chase shot
  scene.add(moon);
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ color: night ? 0x8a90a8 : 0xf0e8e0, transparent: true, opacity: night ? 0.35 : 0.6, fog: false }));
    cloud.scale.set(rng.range(40, 90), rng.range(6, 10), rng.range(18, 30));
    cloud.position.set(rng.range(-500, 500), rng.range(180, 260), rng.range(-500, 200));
    scene.add(cloud);
  }

  // ---- Ground + sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 560),
    new THREE.MeshStandardMaterial({ color: 0x2a7ab0, roughness: 0.35, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(340, -0.4, 0); scene.add(sea);

  const dyn = { peds: [], cars: [], kpdBars: [], lightHeads: [], heliRotor: null, heli: null, cone: null, wheels: [] };

  // ---- Buildings.
  for (const b of world.buildings) {
    const group = new THREE.Group();
    if (b.kind === 'tower' || b.kind === 'bank') {
      const tex = windowsTexture(makeRng(world.seed + Math.round(b.x) * 7 + Math.round(b.z)), '#5a6068', b.floors);
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: night ? 0.5 : dusk ? 0.32 : 0.06, roughness: 0.85 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      box.position.y = b.h / 2; box.castShadow = true; box.receiveShadow = true; group.add(box);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, 2, b.d * 0.7),
        new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.9 }));
      crown.position.y = b.h + 1; group.add(crown);
      if (b.kind === 'bank') {
        // Big yellow BANK sign on the WEST face — it faces the strip road and the camera.
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 5),
          new THREE.MeshBasicMaterial({ map: signTexture('BANK', '#ffd83c', '#1a1a1a') }));
        sign.position.set(-(b.w / 2 + 0.2), b.h * 0.35, 0); sign.rotation.y = -Math.PI / 2; group.add(sign);
        const sign2 = sign.clone(); sign2.scale.set(0.6, 0.6, 0.6);
        sign2.position.set(0, b.h * 0.5, b.d / 2 + 0.2); sign2.rotation.y = 0; group.add(sign2);
      }
    } else {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d),
        new THREE.MeshStandardMaterial({ color: b.tint, roughness: 0.9 }));
      wall.position.y = b.h / 2; wall.castShadow = true; wall.receiveShadow = true; group.add(wall);
      const roof = new THREE.Mesh(gableRoofGeometry(b.w + 0.6, b.d + 0.6, b.h * 0.45),
        new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 0.9 }));
      roof.position.y = b.h; roof.castShadow = true; group.add(roof);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.6, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x2a2e34, emissive: 0xffd98a, emissiveIntensity: night ? 0.9 : dusk ? 0.5 : 0.05 }));
      win.position.set(0, b.h * 0.55, b.d / 2 + 0.05); group.add(win);
      if (b.kind === 'shop' && b.sign) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(9, b.w * 0.85), 2),
          new THREE.MeshBasicMaterial({ map: signTexture(b.sign, '#ffffff', '#22242a') }));
        s.position.set(0, b.h + 0.4, b.d / 2 + 0.3); group.add(s);
        const awn = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.9, 2.4),
          new THREE.MeshStandardMaterial({ map: awningTexture('#' + b.awning.toString(16).padStart(6, '0'), '#f0ead8'), side: THREE.DoubleSide, roughness: 0.9 }));
        awn.position.set(0, b.h * 0.62, b.d / 2 + 1.1); awn.rotation.x = -0.5; group.add(awn);
      }
    }
    group.position.set(b.x, 0, b.z);
    scene.add(group);
  }

  // ---- Market stalls + props.
  for (const s of world.stalls) {
    const g = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.5, s.d), new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.95 }));
    table.position.y = 1; table.castShadow = true; g.add(table);
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(s.w + 1.5, s.d + 1.5),
      new THREE.MeshStandardMaterial({ map: awningTexture('#' + s.awning.toString(16).padStart(6, '0'), '#f0ead8'), side: THREE.DoubleSide, roughness: 0.9 }));
    awn.position.y = 2.6; awn.rotation.x = -Math.PI / 2 + 0.25; g.add(awn);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), new THREE.MeshStandardMaterial({ color: 0x5a4a34 }));
      leg.position.set(lx * (s.w / 2 - 0.3), 1.3, lz * (s.d / 2 - 0.3)); g.add(leg);
    }
    const goods = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.8, 0.4, s.d * 0.7),
      new THREE.MeshStandardMaterial({ color: s.goods === 'fish' ? 0x7ab0c0 : s.goods === 'fruit' ? 0xe08a3c : s.goods === 'cloth' ? 0xc05a8a : 0xd0b060, roughness: 0.9 }));
    goods.position.y = 1.45; g.add(goods);
    g.position.set(s.x, 0, s.z); scene.add(g);
  }
  for (const p of world.props) {
    let m;
    if (p.kind === 'crate') m = new THREE.Mesh(new THREE.BoxGeometry(1.6 * p.s, 1.6 * p.s, 1.6 * p.s), new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 0.95 }));
    else if (p.kind === 'barrel') m = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * p.s, 0.7 * p.s, 1.5 * p.s, 10), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }));
    else if (p.kind === 'basket') m = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * p.s, 0.6 * p.s, 0.7 * p.s, 10), new THREE.MeshStandardMaterial({ color: 0xb09a5a, roughness: 0.95 }));
    else m = new THREE.Mesh(new THREE.BoxGeometry(1.4 * p.s, 1 * p.s, 1.4 * p.s), new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 0.95 }));
    m.position.set(p.x, (p.kind === 'crate' ? 0.8 : p.kind === 'barrel' ? 0.75 : 0.35) * p.s, p.z);
    m.rotation.y = p.rot; m.castShadow = true; scene.add(m);
  }

  // ---- Palms + streetlamps + traffic lights.
  for (const palm of world.palms) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, palm.h, 7), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }));
    trunk.position.y = palm.h / 2; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 1.1), new THREE.MeshStandardMaterial({ color: 0x3a8a4a, roughness: 1 }));
      frond.position.y = palm.h; frond.rotation.y = (i / 6) * Math.PI * 2; frond.rotation.z = 0.5;
      frond.translateX(1.8); g.add(frond);
    }
    g.position.set(palm.x, 0, palm.z); scene.add(g);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.8 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe8a0 });
  for (const lamp of world.streetlamps) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), lampMat);
    pole.position.set(lamp.x, 3.5, lamp.z); scene.add(pole);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glowMat);
    glow.position.set(lamp.x, 7, lamp.z); scene.add(glow);
  }
  for (const light of world.lights) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.5, 6), lampMat);
    pole.position.y = 3.25; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 0.2), lampMat);
    arm.position.set(-1.2, 6.4, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7), lampMat);
    head.position.set(-2.4, 5.6, 0); g.add(head);
    const lamps = {};
    [['red', 6.15, 0xff2a2a], ['amber', 5.6, 0xffb02a], ['green', 5.05, 0x2aff5a]].forEach(([name, y, color]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
      m.position.set(-2.4, y, 0.4); m.userData.lampColor = color; g.add(m); lamps[name] = m;
    });
    g.position.set(light.x, 0, light.z);
    scene.add(g);
    dyn.lightHeads.push({ lamps, light });
  }

  // ---- Cars.
  for (const car of world.cars) {
    const g = new THREE.Group();
    const isBus = car.type === 'bus', isKpd = car.type === 'kpd';
    const len = isBus ? 9 : 4.4, wid = isBus ? 2.6 : 2, hgt = isBus ? 2.6 : 1.1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, hgt, len),
      new THREE.MeshStandardMaterial({ color: car.color, roughness: 0.5, metalness: 0.35 }));
    body.position.y = 0.75; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.85, isBus ? 1.1 : 0.7, len * (isBus ? 0.9 : 0.5)),
      new THREE.MeshStandardMaterial({ color: 0x1a222e, roughness: 0.25, metalness: 0.5 }));
    cabin.position.set(0, hgt + (isBus ? 0.4 : 0.25), isBus ? 0 : -0.3); g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 });
    for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); dyn.wheels.push(w);
    }
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    hl.position.set(0, 0.75, len / 2 + 0.05); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tl.position.set(0, 0.75, -len / 2 - 0.05); g.add(tl);
    if (isKpd) {
      const bar = new THREE.Group();
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      r.position.x = -0.4; const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
      b.position.x = 0.4; bar.add(r); bar.add(b);
      bar.position.set(0, hgt + 0.75, 0); g.add(bar);
      dyn.kpdBars.push({ r, b });
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ color: 0xf0f0f0 }));
      door.position.set(wid / 2 + 0.02, 0.8, 0); door.rotation.y = Math.PI / 2; g.add(door);
    }
    g.userData.car = car;
    scene.add(g);
    dyn.cars.push(g);
  }

  // ---- Pedestrians (blocky, shirt-colored, swinging limbs).
  for (const ped of world.peds) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62 * ped.scale, 0.85, 0.36),
      new THREE.MeshStandardMaterial({ color: ped.shirt, roughness: 0.9 }));
    body.position.y = 1.15; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: ped.skin, roughness: 0.9 }));
    head.position.y = 1.85; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2a2e }));
    legL.position.set(-0.16, 0.38, 0); legL.geometry.translate(0, -0.32, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), new THREE.MeshStandardMaterial({ color: ped.shirt }));
    armL.position.set(-0.42, 1.45, 0); armL.geometry.translate(0, -0.3, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
    g.position.set(ped.x, 0, ped.z);
    g.userData.ped = ped; g.userData.legL = legL; g.userData.legR = legR; g.userData.armL = armL; g.userData.armR = armR;
    scene.add(g);
    dyn.peds.push(g);
  }

  // ---- Heli + spotlight cone.
  const heli = new THREE.Group();
  const hbody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 2.2), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.5, metalness: 0.4 }));
  hbody.castShadow = true; heli.add(hbody);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a1e }));
  tail.position.set(-3.4, 0.3, 0); heli.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  rotor.position.y = 1.1; heli.add(rotor);
  dyn.heliRotor = rotor; dyn.heli = heli;
  heli.position.set(world.heli.x, world.heli.y, world.heli.z);
  scene.add(heli);
  // Spotlight cone: apex up at the heli, base down on the ground. Height is scaled
  // to the heli's altitude every frame, so the beam always reaches the street.
  const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 30, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  dyn.cone = cone; scene.add(cone);

  // ---- Hero (the player): red-shirted pedestrian + own car. update() shows one
  // of them at the player position; a stolen traffic car shows its own mesh instead.
  const heroPed = new THREE.Group();
  const hBody = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xe03030, roughness: 0.9 }));
  hBody.position.y = 1.15; hBody.castShadow = true; heroPed.add(hBody);
  const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.9 }));
  hHead.position.y = 1.88; heroPed.add(hHead);
  const hLegL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2a2e }));
  hLegL.position.set(-0.16, 0.38, 0); hLegL.geometry.translate(0, -0.32, 0); heroPed.add(hLegL);
  const hLegR = hLegL.clone(); hLegR.position.x = 0.16; heroPed.add(hLegR);
  heroPed.visible = false; scene.add(heroPed); dyn.heroPed = heroPed;
  dyn.heroLegL = hLegL; dyn.heroLegR = hLegR;
  const heroCar = new THREE.Group();
  const heroBodyMat = new THREE.MeshStandardMaterial({ color: world.player.car.color, roughness: 0.5, metalness: 0.35 });
  const heroBody = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 4.4), heroBodyMat);
  heroBody.position.y = 0.75; heroBody.castShadow = true; heroCar.add(heroBody);
  const heroCabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a222e, roughness: 0.25, metalness: 0.5 }));
  heroCabin.position.set(0, 1.45, -0.3); heroCar.add(heroCabin);
  const heroWheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const heroWheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 });
  for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const w = new THREE.Mesh(heroWheelGeo, heroWheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); heroCar.add(w);
  }
  const heroHl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  heroHl.position.set(0, 0.75, 2.25); heroCar.add(heroHl);
  heroCar.visible = false; scene.add(heroCar); dyn.heroCar = heroCar; dyn.heroBodyMat = heroBodyMat;

  return { ...game, dyn, update(dt, t) {
    // Hero: pedestrian when on foot, own car when driving (a stolen car shows
    // its own traffic mesh instead, so the hero car hides then).
    const p = world.player;
    const stolen = !!p.carRef;
    dyn.heroPed.visible = p.onFoot;
    dyn.heroCar.visible = !p.onFoot && !stolen;
    if (p.onFoot) {
      dyn.heroPed.position.set(p.x, 0, p.z);
      dyn.heroPed.rotation.y = p.heading;
      const s = Math.sin(t * 8) * (p.speed > 0.5 ? 0.5 : 0);
      dyn.heroLegL.rotation.x = s; dyn.heroLegR.rotation.x = -s;
    } else if (!stolen) {
      dyn.heroCar.position.set(p.x, 0, p.z);
      dyn.heroCar.rotation.y = p.heading;
      dyn.heroBodyMat.color.setHex(p.car.color);
    }
    // Cars follow the sim (except the one the player is driving — main.js moves it).
    for (const g of dyn.cars) {
      if (g.userData.playerDriven) continue;
      const c = g.userData.car;
      g.position.set(c.x, 0, c.z);
      g.rotation.y = c.heading;
    }
    // Peds walk with swing.
    for (const g of dyn.peds) {
      const p = g.userData.ped;
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.heading;
      const s = Math.sin(p.phase) * 0.55;
      g.userData.legL.rotation.x = s; g.userData.legR.rotation.x = -s;
      g.userData.armL.rotation.x = -s * 0.7; g.userData.armR.rotation.x = s * 0.7;
    }
    // Heli orbit + rotor + spotlight cone from the heli down to the street.
    dyn.heli.position.set(world.heli.x, world.heli.y, world.heli.z);
    dyn.heliRotor.rotation.y += dt * 22;
    dyn.cone.scale.y = world.heli.y / 30;
    dyn.cone.position.set(world.heli.x, world.heli.y / 2, world.heli.z);
    // KPD light bars flash red/blue.
    const on = Math.floor(t * 4) % 2 === 0;
    for (const bar of dyn.kpdBars) {
      bar.r.material.color.setHex(on ? 0xff2a2a : 0x551111);
      bar.b.material.color.setHex(on ? 0x112255 : 0x2a6aff);
    }
    // Traffic lights follow the sim clock.
    for (const lh of dyn.lightHeads) {
      const state = trafficLightState(lh.light, t);
      for (const [name, mesh] of Object.entries(lh.lamps)) {
        mesh.material.color.setHex(name === state ? mesh.userData.lampColor : 0x1a1a1a);
      }
    }
  } };
}

export function placeCamera(game, px, py, pz, lx, ly, lz) {
  game.camera.position.set(px, py, pz);
  game.camera.lookAt(lx, ly, lz);
  game.camera.updateProjectionMatrix();
}

// Chase camera: behind the player (on foot: close; driving: further back, higher).
export function chaseCamera(game, world) {
  const p = world.player;
  const back = p.onFoot ? 7 : 11;
  const up = p.onFoot ? 3.2 : 4.6;
  const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
  const cx = p.x - hx * back, cz = p.z - hz * back;
  placeCamera(game, cx, up, cz, p.x + hx * 10, 1.6, p.z + hz * 10);
}
