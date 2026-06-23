// Tiny WebAudio blips — created lazily on first user gesture to satisfy autoplay rules.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function blip(freq = 440, dur = 0.08, type: OscillatorType = "square", gain = 0.04): void {
  const a = ac();
  if (!a) return;
  if (a.state === "suspended") a.resume();
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(a.destination);
  const t = a.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur);
}

export const Sfx = {
  click: () => blip(620, 0.05, "square", 0.03),
  build: () => blip(330, 0.18, "triangle", 0.05),
  coin: () => blip(880, 0.12, "sine", 0.05),
  hit: () => blip(160, 0.12, "sawtooth", 0.05),
  shoot: () => blip(720, 0.08, "square", 0.04),
  win: () => {
    blip(523, 0.12, "triangle", 0.05);
    setTimeout(() => blip(659, 0.12, "triangle", 0.05), 120);
    setTimeout(() => blip(784, 0.2, "triangle", 0.05), 240);
  },
  lose: () => {
    blip(330, 0.2, "sawtooth", 0.05);
    setTimeout(() => blip(247, 0.3, "sawtooth", 0.05), 200);
  },
};
