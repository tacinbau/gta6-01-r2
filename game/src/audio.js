// Azura Bay radio: 3 procedural stations, WebAudio oscillators, no audio files.
// Everything is guarded — headless runs have no audio and must never crash.
const STATION_PATTERNS = [
  { name: 'Sol Mar FM', genre: 'Island Pop', bass: [55, 65.4, 49, 58.3], lead: [220, 261.6, 196, 246.9], tempo: 116 },
  { name: 'Bayou 94', genre: 'Swamp Blues', bass: [49, 49, 58.3, 55], lead: [146.8, 174.6, 196, 164.8], tempo: 92 },
  { name: 'Neon Drive', genre: 'Night Synth', bass: [55, 55, 82.4, 73.4], lead: [440, 415.3, 493.9, 440], tempo: 128 },
];

export class Radio {
  constructor() {
    this.station = 0;
    this.ctx = null;
    this.timer = null;
    this.step = 0;
    this.playing = false;
  }

  current() {
    return STATION_PATTERNS[this.station];
  }

  next() {
    this.station = (this.station + 1) % STATION_PATTERNS.length;
    if (this.playing) this.restart();
    return this.current();
  }

  start() {
    try {
      if (typeof window === 'undefined' || !window.AudioContext) return false;
      if (!this.ctx) this.ctx = new window.AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.playing = true;
      this.restart();
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  restart() {
    if (this.timer) clearInterval(this.timer);
    const pat = this.current();
    const beat = 60000 / pat.tempo / 2;
    this.step = 0;
    this.timer = setInterval(() => {
      if (!this.playing || !this.ctx) return;
      const i = this.step % 8;
      this.blip(pat.bass[Math.floor(i / 2) % 4], beat * 0.9, 'triangle', 0.05);
      if (i % 2 === 0) this.blip(pat.lead[(i / 2) % 4], beat * 0.45, 'square', 0.02);
      this.step += 1;
    }, beat);
  }

  blip(freq, durMs, type, gain) {
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + durMs / 1000);
    } catch {
      // audio is garnish, never fatal
    }
  }
}
