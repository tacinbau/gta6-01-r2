// All sound is made, never loaded: a WebAudio engine hum, three procedural radio stations
// (a seeded note sequencer per station), gunshots, sirens and blips. Audio starts only after
// the player's first gesture; in a headless run with no audio device every call is a no-op.
import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let radioOn = true;
  let nextNoteAt = 0;
  let step = 0;
  let seed = 12345;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** A tiny deterministic picker so the radio melody repeats per station. */
  function pick() {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) % 1000) / 1000;
  }

  function note(freq, at, dur, type, vol) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function radioTick(now) {
    if (!radioOn) return;
    const st = RADIO[station];
    const beat = 60 / st.bpm;
    while (nextNoteAt < now + 0.15) {
      const at = Math.max(nextNoteAt, now);
      const deg = st.scale[Math.floor(pick() * st.scale.length)];
      const oct = pick() < 0.25 ? 2 : 1;
      const freq = st.root * oct * Math.pow(2, deg / 12);
      note(freq, at, beat * 0.9, 'triangle', 0.16);
      if (step % 4 === 0) note(st.root / 2, at, beat * 1.8, 'sine', 0.2);
      if (step % 8 === 4) note(st.root * 1.5, at, beat * 0.5, 'square', 0.05);
      nextNoteAt += beat / 2;
      step += 1;
    }
  }

  return {
    /** Call from any user gesture; safe to call repeatedly. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    /** Engine hum follows speed 0..1; the siren wails while the wanted level is 2 or more. */
    update(speed01, wanted) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (engineOsc) {
        engineOsc.frequency.value = 45 + speed01 * 110;
        engineGain.gain.value = 0.02 + speed01 * 0.05;
      }
      if (sirenOsc) {
        const wail = wanted >= 2;
        sirenGain.gain.value = wail ? 0.035 : 0;
        if (wail) sirenOsc.frequency.value = 650 + 250 * Math.sin(now * 2.4);
      }
      if (nextNoteAt === 0) nextNoteAt = now + 0.1;
      radioTick(now);
    },
    nextStation() {
      station = (station + 1) % RADIO.length;
      seed = 12345 + station * 777;
      step = 0;
      return RADIO[station].name;
    },
    toggleRadio() {
      radioOn = !radioOn;
      return radioOn;
    },
    stationName() {
      return RADIO[station].name;
    },
    gunshot() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.09);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(gain);
      gain.connect(master);
      src.start(now);
    },
    blip(freq) {
      if (!ensure()) return;
      note(freq || 880, ctx.currentTime, 0.12, 'sine', 0.25);
    },
    crash() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.25);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.7;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      src.connect(gain);
      gain.connect(master);
      src.start(now);
    },
  };
}
