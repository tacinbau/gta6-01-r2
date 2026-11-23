// Procedural radio: three stations, all synthesized with WebAudio — no audio files.
// Sol Mar FM (island pop), Kite FM (lo-fi bay), Vice FM (synthwave). Plus siren + engine hum.
const STATIONS = [
  { name: 'Sol Mar FM', bpm: 96, root: 48, scale: [0, 2, 4, 7, 9], wave: 'triangle', bass: 36 },
  { name: 'Kite FM', bpm: 72, root: 45, scale: [0, 3, 5, 7, 10], wave: 'sine', bass: 33 },
  { name: 'Vice FM', bpm: 112, root: 41, scale: [0, 2, 3, 7, 8], wave: 'sawtooth', bass: 29 },
];

export function createAudio() {
  const api = { station: 0, enabled: false, ctx: null, master: null, step: 0, nextTime: 0, siren: null, engine: null };
  function ensure() {
    if (api.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      api.ctx = new AC();
      api.master = api.ctx.createGain();
      api.master.gain.value = 0.16;
      api.master.connect(api.ctx.destination);
      // Engine hum: low sawtooth through a low-pass, gain follows speed.
      api.engine = api.ctx.createOscillator();
      api.engine.type = 'sawtooth'; api.engine.frequency.value = 55;
      const eg = api.ctx.createGain(); eg.gain.value = 0.0;
      const ef = api.ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 320;
      api.engine.connect(ef); ef.connect(eg); eg.connect(api.master);
      api.engine.start();
      api.engineGain = eg;
      // Siren: two-tone triangle, quiet.
      api.siren = api.ctx.createOscillator();
      api.siren.type = 'triangle'; api.siren.frequency.value = 660;
      const sg = api.ctx.createGain(); sg.gain.value = 0.0;
      api.siren.connect(sg); sg.connect(api.master); api.siren.start();
      api.sirenGain = sg;
      api.nextTime = api.ctx.currentTime + 0.1;
      return true;
    } catch { return false; }
  }
  function note(freq, when, dur, type, vol) {
    const o = api.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = api.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(api.master);
    o.start(when); o.stop(when + dur + 0.05);
  }
  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  api.unlock = () => { if (ensure() && api.ctx.state === 'suspended') api.ctx.resume().catch(() => {}); api.enabled = true; };
  api.setStation = (i) => { api.station = ((i % 3) + 3) % 3; api.step = 0; };
  api.tick = (speed01, wanted) => {
    if (!api.ctx || !api.enabled || api.ctx.state !== 'running') return;
    const st = STATIONS[api.station];
    const spb = 60 / st.bpm / 2; // eighth notes
    while (api.nextTime < api.ctx.currentTime + 0.25) {
      const s = api.step;
      // Bass on beats 0 and 4.
      if (s % 8 === 0 || s % 8 === 4) note(midi(st.bass), api.nextTime, spb * 1.8, 'sine', 0.5);
      // Melody: pentatonic walk, seeded by step (deterministic pattern, not random).
      const deg = [0, 2, 1, 3, 2, 4, 3, 1][s % 8];
      if (s % 2 === 0) note(midi(st.root + 12 + st.scale[deg % st.scale.length]), api.nextTime, spb * 0.9, st.wave, 0.22);
      // Hat tick.
      if (s % 2 === 1) note(6000, api.nextTime, 0.03, 'square', 0.04);
      api.step++;
      api.nextTime += spb;
    }
    if (api.engineGain) api.engineGain.gain.value = 0.05 + speed01 * 0.1;
    if (api.engine) api.engine.frequency.value = 55 + speed01 * 90;
    if (api.sirenGain) {
      api.sirenGain.gain.value = wanted > 0 ? 0.05 : 0.0;
      if (wanted > 0) api.siren.frequency.value = Math.floor(api.ctx.currentTime * 2) % 2 ? 660 : 880;
    }
  };
  return api;
}
