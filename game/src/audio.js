// Procedural sound: engine hum, gunshots, sirens and three synth radio
// stations, all generated with WebAudio. No audio files, no network.
import { RADIO } from './config.js';

let ctx = null;
let master = null;
let radioTimer = null;
let radioStep = 0;
let radioNodes = [];

export function ensureAudio() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, type, vol, when = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function sfx(name) {
  if (!ctx) return;
  if (name === 'shot') tone(220 + Math.random() * 60, 0.09, 'square', 0.25);
  else if (name === 'pickup') {
    tone(660, 0.08, 'sine', 0.2);
    tone(990, 0.12, 'sine', 0.2, 0.08);
  } else if (name === 'crash') tone(90, 0.25, 'sawtooth', 0.3);
  else if (name === 'siren') {
    tone(880, 0.4, 'sine', 0.08);
    tone(1174, 0.4, 'sine', 0.08, 0.4);
  } else if (name === 'cash') {
    tone(1320, 0.1, 'sine', 0.2);
    tone(1760, 0.16, 'sine', 0.2, 0.1);
  } else if (name === 'click') tone(1200, 0.04, 'square', 0.12);
}

const NOTE = [0, 2, 4, 5, 7, 9, 11];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function startRadio(stationIndex) {
  stopRadio();
  const station = RADIO[stationIndex];
  if (!station || station.bpm === 0) return; // talk station: no music
  if (!ctx) return;
  radioStep = 0;
  const beat = 60 / station.bpm / 2;
  radioTimer = setInterval(() => {
    if (!ctx) return;
    const scale = station.scale;
    const degree = [0, 2, 1, 3, 4, 3, 2, 1][radioStep % 8];
    const midi = station.root + scale[degree % scale.length] + 12 * Math.floor(degree / scale.length);
    tone(midiToFreq(midi), beat * 1.8, 'triangle', 0.12);
    if (radioStep % 4 === 0) tone(midiToFreq(station.root - 12), beat * 3.5, 'sine', 0.14);
    if (radioStep % 2 === 0) tone(120, 0.05, 'square', 0.05);
    radioStep += 1;
  }, beat * 1000);
}

export function stopRadio() {
  if (radioTimer) {
    clearInterval(radioTimer);
    radioTimer = null;
  }
  for (const n of radioNodes) {
    try {
      n.stop();
    } catch (e) {
      /* already stopped */
    }
  }
  radioNodes = [];
}

export function radioName(stationIndex) {
  return RADIO[stationIndex] ? RADIO[stationIndex].name : 'Off';
}
