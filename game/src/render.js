// Azura Bay renderer: Three.js low-poly city, chase cam, staged shots.
// Everything is built from the deterministic world data — no loaded assets,
// no network, only procedural canvas textures.
import * as THREE from 'three';
import { COUNTS } from './config.js';

// ---------- procedural canvas textures ----------
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

function windowsTexture(litRatio, night) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#20242e';
    g.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = ((r * 7 + c * 13) % 10) / 10 < litRatio;
        g.fillStyle = lit ? (night ? '#ffd97a' : '#cfe4ff') : '#12151d';
        g.fillRect(8 + c * 20, 8 + r * 20, 12, 12);
      }
    }
  });
}

function awningTexture(stripe) {
  const hex = `#${stripe.toString(16).padStart(6, '0')}`;
  return canvasTexture(128, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 === 0 ? hex : '#f2ead8';
      g.fillRect(i * 16, 0, 16, h);
    }
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(0, h - 8, w, 8);
  });
}

function roadTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#33363d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8c832';
    for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 3, y + 8, 6, 32);
    g.fillStyle = '#c8c8c8';
    g.fillRect(4, 0, 3, h);
    g.fillRect(w - 7, 0, 3, h);
  });
}

function sidewalkTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#8a8578';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6f6a5e';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
    }
  });
}

function signTexture(text, fg = '#ffd92b', bg = '#1a1a22') {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 4;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = fg;
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function skyTexture(top, mid, low) {
  const toHex = (c) => `#${c.toString(16).padStart(6, '0')}`;
  return canvasTexture(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, toHex(top));
    grad.addColorStop(0.55, toHex(mid));
    grad.addColorStop(1, toHex(low));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function cloudTexture() {
  return canvasTexture(128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const blobs = [[40, 40, 26], [64, 32, 30], [90, 42, 24], [55, 48, 22]];
    for (const [x, y, r] of blobs) {
      const grad = g.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  });
}

// ---------- renderer ----------
export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(1280, 720, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 1200);
    this.clock = 0;
    this.built = null;
    this.textures = {};
  }

  build(world, shot) {
    // Tear down the previous scene.
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(shot.fog, 130, 460);
    this.world = world;
    this.shot = shot;
    const night = shot.timeOfDay === 'night';

    // Lights: ambient + sun/moon directional with shadows.
    this.scene.add(new THREE.AmbientLight(0xffffff, shot.ambient));
    const sun = new THREE.DirectionalLight(shot.timeOfDay === 'sunset' ? 0xffc98a : 0xfff2d9, shot.sun);
    const hero = world.hero;
    sun.position.set(hero.x + 60, 90, hero.z + 40);
    sun.target.position.set(hero.x, 0, hero.z);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -160;
    sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160;
    sun.shadow.camera.bottom = -160;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // Warm stall lamps in the market (cover + night): a few real point lights.
    this.lamps = [];
    if (shot.id === 'cover' || shot.id === 'night') {
      const lampSpots = shot.id === 'cover'
        ? [[-110, 5, 46], [-110, 5, 10], [-110, 5, -22], [-118, 5, 30], [-110, 4, 58]]
        : [[-110, 5, 20], [0, 5, -20], [35, 5, -60]];
      for (const [x, y, z] of lampSpots) {
        const pl = new THREE.PointLight(0xff9a3a, 220, 42, 1.6);
        pl.position.set(x, y, z);
        this.scene.add(pl);
        this.lamps.push(pl);
      }
    }

    this.buildSky(shot, night);
    this.buildGround(shot, night);
    this.buildBuildings(night);
    this.buildStalls();
    this.buildPeds();
    this.buildCars();
    this.buildHeroCar();
    this.buildLights();
    this.buildHeli();
    this.buildProps();
    this.buildPalms();
    this.applyCamera(shot);
    this.built = true;
  }

  buildSky(shot, night) {
    const skyGeo = new THREE.SphereGeometry(520, 16, 12);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTexture(shot.skyTop, shot.skyMid, shot.skyLow),
      side: THREE.BackSide,
      fog: false,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Stars (night + dusk).
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 320; i++) {
      const a = (i * 2.39996) % (Math.PI * 2);
      const e = 0.25 + ((i * 0.731) % 1) * 1.1;
      const r = 480;
      starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
    this.scene.add(stars);

    // Moon.
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0xf2ead8, fog: false }),
    );
    moon.position.set(-180, 190, -380);
    moon.lookAt(0, 0, 0);
    this.scene.add(moon);

    // Clouds.
    const cloudTex = cloudTexture();
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const cl = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 34),
        new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false, fog: false }),
      );
      cl.position.set(-260 + i * 80, 150 + (i % 3) * 22, -300 + (i % 2) * 90);
      cl.lookAt(0, 60, 0);
      this.scene.add(cl);
      this.clouds.push(cl);
    }
  }

  buildGround(shot, night) {
    const baseColor = night ? 0x232830 : shot.timeOfDay === 'sunset' ? 0x6b5a42 : 0x5a5044;
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshLambertMaterial({ color: baseColor }),
    );
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    this.scene.add(base);

    // Roads: avenues (along z) + streets (along x) + beach road.
    const roadTex = roadTexture();
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    const mkRoad = (w, l, x, z) => {
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(w / 14, l / 40);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, l),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.05, z);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    for (const ax of [-160, -120, -80, -40, 0, 40, 80, 120, 160]) mkRoad(14, 380, ax, 0);
    for (const sz of [-120, -80, -40, 0, 40, 80, 120]) mkRoad(380, 14, 0, sz);
    mkRoad(380, 14, 0, 130); // Strand Blvd

    // Sidewalks flanking the downtown avenue + market edge.
    const walkTex = sidewalkTexture();
    walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;
    const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
    for (const sx of [-9.5, 9.5]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(4, 300), walkMat);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(sx, 0.06, -20);
      sw.receiveShadow = true;
      this.scene.add(sw);
    }

    // Sand + sea (east of the beach road).
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 34),
      new THREE.MeshLambertMaterial({ color: 0xd9bd7a }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.04, 156);
    sand.receiveShadow = true;
    this.scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 90),
      new THREE.MeshLambertMaterial({ color: night ? 0x0a2438 : 0x2a6a9a }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, 218);
    this.scene.add(sea);
  }

  buildBuildings(night) {
    const world = this.world;
    const winTex = windowsTexture(night ? 0.55 : 0.35, night);
    const winMat = new THREE.MeshBasicMaterial({ map: winTex });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const matCache = new Map();
    const matFor = (color) => {
      if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
      return matCache.get(color);
    };
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b4a3a });
    const roofMat2 = new THREE.MeshLambertMaterial({ color: 0x4a5a6b });

    for (const b of world.buildings) {
      const body = new THREE.Mesh(boxGeo, matFor(b.color));
      body.scale.set(b.w, b.h, b.d);
      body.position.set(b.x, b.h / 2, b.z);
      body.rotation.y = b.rot || 0;
      body.castShadow = true;
      body.receiveShadow = true;
      this.scene.add(body);

      if (b.kind === 'tower') {
        // Lit-window faces on the two long sides.
        for (const s of [-1, 1]) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.92, b.h * 0.9), winMat);
          win.position.set(b.x, b.h * 0.48, b.z + s * (b.d / 2 + 0.06));
          if (s < 0) win.rotation.y = Math.PI;
          this.scene.add(win);
        }
        // Roof cap + antenna on the BANK tower.
        const cap = new THREE.Mesh(boxGeo, matFor(0x2a2f3a));
        cap.scale.set(b.w * 0.9, 1.2, b.d * 0.9);
        cap.position.set(b.x, b.h + 0.6, b.z);
        this.scene.add(cap);
        if (b.sign === 'BANK') {
          const signTex = signTexture('BANK', '#ffd92b', '#14141e');
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(15, 3.4),
            new THREE.MeshBasicMaterial({ map: signTex }),
          );
          // South face of the BANK tower — faces the mission camera dead on.
          sign.position.set(b.x, 30, b.z + b.d / 2 + 0.12);
          this.scene.add(sign);
          const antenna = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
            new THREE.MeshLambertMaterial({ color: 0xd9382b }),
          );
          antenna.position.set(b.x + 6, b.h + 5, b.z - 4);
          this.scene.add(antenna);
        }
      } else {
        // One group per house/shop so the roof, windows, sign and awning all
        // rotate together — every face a camera can see carries windows.
        const g = new THREE.Group();
        g.position.set(b.x, 0, b.z);
        g.rotation.y = b.rot || 0;
        body.position.set(0, b.h / 2, 0);
        body.rotation.y = 0;
        g.add(body);
        // Gable roof: two sloped slabs meeting at the ridge.
        const slopeLen = Math.sqrt((b.d / 2) ** 2 + 2.2 ** 2) + 0.6;
        const angle = Math.atan2(2.2, b.d / 2);
        for (const s of [-1, 1]) {
          const slab = new THREE.Mesh(boxGeo, s < 0 ? roofMat : roofMat2);
          slab.scale.set(b.w + 0.8, 0.35, slopeLen);
          slab.position.set(0, b.h + 1.05, s * b.d / 4);
          slab.rotation.x = s * angle;
          slab.castShadow = true;
          g.add(slab);
        }
        // Lit windows on the front and both sides.
        const winFront = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.7, 1.6), winMat);
        winFront.position.set(0, b.h * 0.55, b.d / 2 + 0.06);
        g.add(winFront);
        for (const s of [-1, 1]) {
          const winSide = new THREE.Mesh(new THREE.PlaneGeometry(b.d * 0.6, 1.6), winMat);
          winSide.position.set(s * (b.w / 2 + 0.06), b.h * 0.55, 0);
          winSide.rotation.y = s * Math.PI / 2;
          g.add(winSide);
        }
        // Shop sign + awning on the street face.
        if (b.sign) {
          const signTex = signTexture(b.sign, '#ffffff', '#22222e');
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(7, b.w * 0.8), 1.7),
            new THREE.MeshBasicMaterial({ map: signTex }),
          );
          sign.position.set(0, b.h - 0.9, b.d / 2 + 0.08);
          g.add(sign);
          const awn = new THREE.Mesh(
            new THREE.PlaneGeometry(b.w * 0.8, 2.2),
            new THREE.MeshLambertMaterial({ map: awningTexture(b.awning || 0xd9382b), side: THREE.DoubleSide }),
          );
          awn.position.set(0, 3.1, b.d / 2 + 1.1);
          awn.rotation.x = -0.5;
          g.add(awn);
        }
        this.scene.add(g);
      }
    }
  }

  buildStalls() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
    const postMat = new THREE.MeshLambertMaterial({ color: 0x4a3822 });
    for (const s of this.world.stalls) {
      const table = new THREE.Mesh(boxGeo, woodMat);
      table.scale.set(s.w, 1.1, s.d);
      table.position.set(s.x, 0.55, s.z);
      table.castShadow = true;
      this.scene.add(table);
      // Goods: small colored crates on the table.
      const goodsMat = new THREE.MeshLambertMaterial({ color: s.goods });
      for (let i = 0; i < 3; i++) {
        const g = new THREE.Mesh(boxGeo, goodsMat);
        g.scale.set(1.1, 0.7, 0.9);
        g.position.set(s.x - 1.6 + i * 1.6, 1.45, s.z + (i % 2 === 0 ? -0.8 : 0.8));
        this.scene.add(g);
      }
      // Striped awning on 4 posts.
      const awn = new THREE.Mesh(
        new THREE.PlaneGeometry(s.w + 1, s.d + 1.4),
        new THREE.MeshLambertMaterial({ map: awningTexture(s.awning), side: THREE.DoubleSide }),
      );
      awn.rotation.x = -Math.PI / 2 + 0.12;
      awn.position.set(s.x, s.h, s.z);
      awn.castShadow = true;
      this.scene.add(awn);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const post = new THREE.Mesh(boxGeo, postMat);
        post.scale.set(0.18, s.h, 0.18);
        post.position.set(s.x + dx * (s.w / 2), s.h / 2, s.z + dz * (s.d / 2));
        this.scene.add(post);
      }
      // Stall sign.
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.85),
        new THREE.MeshBasicMaterial({ map: signTexture(s.sign, '#ffffff', '#22222e') }),
      );
      sign.position.set(s.x, s.h - 0.4, s.z + s.d / 2 + 0.75);
      this.scene.add(sign);
    }
  }

  buildPeds() {
    const world = this.world;
    const n = world.peds.length;
    const torsoGeo = new THREE.BoxGeometry(0.62, 0.72, 0.36);
    const headGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const legGeo = new THREE.BoxGeometry(0.5, 0.62, 0.3);
    this.pedTorso = new THREE.InstancedMesh(torsoGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.pedHead = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.pedLegs = new THREE.InstancedMesh(legGeo, new THREE.MeshLambertMaterial({ color: 0x2a2a33 }), n);
    this.pedTorso.castShadow = true;
    this.pedTorso.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pedHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pedLegs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    world.peds.forEach((p, i) => {
      this.pedTorso.setColorAt(i, c.setHex(p.shirt));
      this.pedHead.setColorAt(i, c.setHex(p.skin));
    });
    this.pedTorso.instanceColor.needsUpdate = true;
    this.pedHead.instanceColor.needsUpdate = true;
    this.scene.add(this.pedTorso);
    this.scene.add(this.pedHead);
    this.scene.add(this.pedLegs);
    this.updatePeds();
  }

  updatePeds() {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    this.world.peds.forEach((p, i) => {
      const bob = Math.abs(Math.sin(p.phase)) * 0.06;
      const swing = Math.sin(p.phase) * 0.28;
      const heading = p.axis === 'z' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      // Torso.
      e.set(0, heading, 0);
      q.setFromEuler(e);
      m.compose(v.set(p.x, 1.05 + bob, p.z), q, s);
      this.pedTorso.setMatrixAt(i, m);
      // Head.
      m.compose(v.set(p.x, 1.58 + bob, p.z), q, s);
      this.pedHead.setMatrixAt(i, m);
      // Legs, swinging.
      e.set(swing, heading, 0);
      q.setFromEuler(e);
      m.compose(v.set(p.x, 0.62, p.z), q, s);
      this.pedLegs.setMatrixAt(i, m);
    });
    this.pedTorso.instanceMatrix.needsUpdate = true;
    this.pedHead.instanceMatrix.needsUpdate = true;
    this.pedLegs.instanceMatrix.needsUpdate = true;
  }

  buildCars() {
    const world = this.world;
    const cars = world.cars;
    const n = cars.length;
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.75, 4.4);
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.65, 2.2);
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    this.carBody = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.carCabin = new THREE.InstancedMesh(cabinGeo, new THREE.MeshLambertMaterial({ color: 0x181c24 }), n);
    this.carWheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }), n * 4);
    this.carBody.castShadow = true;
    this.carBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.carCabin.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.carWheels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    cars.forEach((car, i) => this.carBody.setColorAt(i, c.setHex(car.color)));
    this.carBody.instanceColor.needsUpdate = true;
    this.scene.add(this.carBody);
    this.scene.add(this.carCabin);
    this.scene.add(this.carWheels);
    // KPD light bars + headlights (individual meshes, few).
    this.kpdBars = [];
    cars.forEach((car, i) => {
      if (car.kind !== 'kpd') return;
      const bar = new THREE.Group();
      const red = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xff2020 }),
      );
      red.position.x = -0.45;
      const blue = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x2050ff }),
      );
      blue.position.x = 0.45;
      bar.add(red);
      bar.add(blue);
      bar.userData = { red, blue, carIndex: i };
      this.scene.add(bar);
      this.kpdBars.push(bar);
    });
    this.updateCars();
  }

  carMatrix(car) {
    const x = car.alongZ ? car.road + car.lane : car.pos;
    const z = car.alongZ ? car.pos : car.road + car.lane;
    const heading = car.alongZ ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    return { x, z, heading };
  }

  updateCars() {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    this.world.cars.forEach((car, i) => {
      const { x, z, heading } = this.carMatrix(car);
      const len = car.kind === 'bus' ? 2.1 : 1;
      e.set(0, heading, 0);
      q.setFromEuler(e);
      m.compose(v.set(x, 0.62, z), q, new THREE.Vector3(1, 1, len));
      this.carBody.setMatrixAt(i, m);
      m.compose(v.set(x, 1.28, z - (car.alongZ ? 0.2 : 0) * 0), q, new THREE.Vector3(1, 1, len * 0.9));
      this.carCabin.setMatrixAt(i, m);
      // Wheels.
      const wheelOffsets = [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]];
      wheelOffsets.forEach(([dx, dz], w) => {
        const wx = x + dx * Math.cos(heading) + dz * Math.sin(heading) * len;
        const wz = z - dx * Math.sin(heading) + dz * Math.cos(heading) * len;
        e.set(0, heading, Math.PI / 2);
        q.setFromEuler(e);
        m.compose(v.set(wx, 0.38, wz), q, s);
        this.carWheels.setMatrixAt(i * 4 + w, m);
      });
      // KPD light bar follows its car.
      const bar = this.kpdBars.find((b) => b.userData.carIndex === i);
      if (bar) {
        bar.position.set(x, 1.62, z);
        bar.rotation.y = heading;
      }
    });
    this.carBody.instanceMatrix.needsUpdate = true;
    this.carCabin.instanceMatrix.needsUpdate = true;
    this.carWheels.instanceMatrix.needsUpdate = true;
  }

  // The hero's own car: bright orange coupe, always visible when driving.
  // (In r2f the player was invisible in the driving shots until this was added.)
  buildHeroCar() {
    const car = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.8, 4.5),
      new THREE.MeshLambertMaterial({ color: this.world.hero.carColor }),
    );
    body.position.y = 0.62;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.7, 2.3),
      new THREE.MeshLambertMaterial({ color: 0x181c24 }),
    );
    cabin.position.set(0, 1.32, -0.2);
    car.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [dx, dz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(dx, 0.4, dz);
      car.add(w);
    }
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
    for (const s of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.12), lampMat);
      lamp.position.set(s * 0.65, 0.72, 2.26);
      car.add(lamp);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.12), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      tail.position.set(s * 0.65, 0.72, -2.26);
      car.add(tail);
    }
    this.heroCar = car;
    this.scene.add(car);
    this.updateHeroCar();
  }

  updateHeroCar() {
    const hero = this.world.hero;
    this.heroCar.visible = hero.mode === 'car';
    this.heroCar.position.set(hero.x, 0, hero.z);
    this.heroCar.rotation.y = hero.heading;
    const bodyMat = this.heroCar.children[0].material;
    if (bodyMat.color.getHex() !== hero.carColor) bodyMat.color.setHex(hero.carColor);
  }

  buildLights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 6.5, 8);
    const headGeo = new THREE.BoxGeometry(0.7, 1.9, 0.7);
    const lampGeo = new THREE.SphereGeometry(0.22, 8, 8);
    this.trafficLamps = [];
    for (const l of this.world.lights) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(l.x, 3.25, l.z);
      pole.castShadow = true;
      this.scene.add(pole);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(l.x, 6.2, l.z);
      this.scene.add(head);
      const lamps = {};
      const offsets = { red: 0.6, amber: 0, green: -0.6 };
      for (const [name, dy] of Object.entries(offsets)) {
        const lamp = new THREE.Mesh(
          lampGeo,
          new THREE.MeshBasicMaterial({ color: name === l.state ? (name === 'red' ? 0xff2020 : name === 'amber' ? 0xffb020 : 0x20d060) : 0x333333 }),
        );
        lamp.position.set(l.x, 6.2 + dy, l.z + 0.38);
        this.scene.add(lamp);
        lamps[name] = lamp;
      }
      this.trafficLamps.push({ light: l, lamps });
    }
  }

  buildHeli() {
    const heli = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 5.2), bodyMat);
    body.castShadow = true;
    heli.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 4.6), bodyMat);
    tail.position.set(0, 0.3, -4.4);
    heli.add(tail);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.1, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x9ac8e8 }),
    );
    glass.position.set(0, 0.2, 2.2);
    heli.add(glass);
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    this.rotor.position.y = 1.25;
    heli.add(this.rotor);
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const s of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.4), skidMat);
      skid.position.set(s * 1.4, -1.15, 0);
      heli.add(skid);
    }
    // Spotlight cone down to the road: narrow at the heli, wide at the
    // ground (apex up). Slim and faint — never a giant white pyramid.
    const coneGeo = new THREE.ConeGeometry(6.5, 46, 20, 1, true);
    this.cone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfff2c8, transparent: true, opacity: 0.2,
        side: THREE.DoubleSide, depthWrite: false, fog: false,
      }),
    );
    this.cone.position.y = -24;
    heli.add(this.cone);
    const spot = new THREE.PointLight(0xfff2c8, 180, 60, 1.5);
    spot.position.y = -6;
    heli.add(spot);
    // Red navigation beacon so the heli body reads at night.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    beacon.position.set(0, -1.3, 2.4);
    heli.add(beacon);
    this.heliBeacon = beacon;
    this.heliGroup = heli;
    this.scene.add(heli);
    // Warm light pool on the road under the heli.
    this.spotPool = new THREE.Mesh(
      new THREE.CircleGeometry(10, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    this.spotPool.rotation.x = -Math.PI / 2;
    this.scene.add(this.spotPool);
    this.updateHeli();
  }

  updateHeli() {
    const h = this.world.heli;
    this.heliGroup.position.set(h.x, h.y, h.z);
    this.heliGroup.rotation.y = h.angle;
    this.rotor.rotation.y = h.rotor;
    this.heliGroup.visible = this.shot.heliVisible;
    this.cone.visible = this.shot.heliVisible;
    this.spotPool.visible = this.shot.heliVisible;
    this.spotPool.position.set(h.x, 0.08, h.z);
  }

  buildProps() {
    const world = this.world;
    const kinds = ['crate', 'barrel', 'basket', 'planter'];
    const geos = {
      crate: new THREE.BoxGeometry(1, 1, 1),
      barrel: new THREE.CylinderGeometry(0.55, 0.55, 1.2, 10),
      basket: new THREE.BoxGeometry(0.9, 0.6, 0.9),
      planter: new THREE.BoxGeometry(1.3, 0.7, 0.7),
    };
    this.propMeshes = {};
    for (const kind of kinds) {
      const list = world.props.filter((p) => p.kind === kind);
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geos[kind], new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
      im.castShadow = true;
      const m = new THREE.Matrix4();
      const c = new THREE.Color();
      list.forEach((p, i) => {
        m.makeScale(p.s, p.s, p.s);
        m.setPosition(p.x, kind === 'barrel' ? 0.6 * p.s : 0.5 * p.s, p.z);
        im.setMatrixAt(i, m);
        im.setColorAt(i, c.setHex(p.color));
      });
      im.instanceColor.needsUpdate = true;
      this.scene.add(im);
      this.propMeshes[kind] = im;
    }
  }

  buildPalms() {
    const world = this.world;
    const n = world.palms.length;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1, 7);
    const frondGeo = new THREE.PlaneGeometry(3.4, 1.1);
    this.palmTrunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4a2a }), n);
    this.palmFronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshLambertMaterial({ color: 0x2f7a3a, side: THREE.DoubleSide }), n * 5);
    this.palmTrunk.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    world.palms.forEach((p, i) => {
      e.set(p.lean, 0, 0);
      q.setFromEuler(e);
      m.compose(v.set(p.x, p.h / 2, p.z), q, new THREE.Vector3(1, p.h, 1));
      this.palmTrunk.setMatrixAt(i, m);
      for (let f = 0; f < 5; f++) {
        const a = (f / 5) * Math.PI * 2;
        e.set(-0.5, a, 0);
        q.setFromEuler(e);
        m.compose(
          v.set(p.x + Math.cos(a) * 1.4, p.h + 0.4, p.z + Math.sin(a) * 1.4),
          q,
          new THREE.Vector3(1, 1, 1),
        );
        this.palmFronds.setMatrixAt(i * 5 + f, m);
      }
    });
    this.palmTrunk.instanceMatrix.needsUpdate = true;
    this.palmFronds.instanceMatrix.needsUpdate = true;
    this.scene.add(this.palmTrunk);
    this.scene.add(this.palmFronds);
  }

  applyCamera(shot) {
    this.camera.position.set(shot.camera.pos[0], shot.camera.pos[1], shot.camera.pos[2]);
    this.camera.lookAt(shot.camera.target[0], shot.camera.target[1], shot.camera.target[2]);
    this.camera.fov = shot.camera.fov;
    this.camera.updateProjectionMatrix();
  }

  // Chase camera for live play: behind the hero, above the car when driving.
  chaseCamera(hero) {
    const back = hero.mode === 'car' ? 11 : 6;
    const height = hero.mode === 'car' ? 5.5 : 4;
    const hx = hero.x - Math.sin(hero.heading) * back;
    const hz = hero.z - Math.cos(hero.heading) * back;
    this.camera.position.set(hx, height, hz);
    this.camera.lookAt(hero.x + Math.sin(hero.heading) * 8, 1.8, hero.z + Math.cos(hero.heading) * 8);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.clock += dt;
    const t = this.clock;
    // Rotor spin + heli bob.
    if (this.heliGroup) {
      this.rotor.rotation.y += dt * 22;
      this.heliGroup.position.y = this.world.heli.y + Math.sin(t * 0.8) * 1.2;
    }
    // KPD light-bar flash + heli beacon blink.
    for (const bar of this.kpdBars || []) {
      const on = Math.floor(t * 4) % 2 === 0;
      bar.userData.red.visible = on;
      bar.userData.blue.visible = !on;
    }
    if (this.heliBeacon) this.heliBeacon.visible = Math.floor(t * 2) % 2 === 0;
    // Clouds drift.
    for (const cl of this.clouds || []) {
      cl.position.x += dt * 1.5;
      if (cl.position.x > 320) cl.position.x = -320;
    }
    // Traffic-light lamps follow state.
    for (const { light, lamps } of this.trafficLamps || []) {
      for (const [name, lamp] of Object.entries(lamps)) {
        const active = light.state === name;
        lamp.material.color.setHex(active ? (name === 'red' ? 0xff2020 : name === 'amber' ? 0xffb020 : 0x20d060) : 0x333333);
      }
    }
    this.updatePeds();
    this.updateCars();
    this.updateHeroCar();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  drawCalls() {
    return this.renderer.info.render.calls;
  }

  triangles() {
    return this.renderer.info.render.triangles;
  }
}
