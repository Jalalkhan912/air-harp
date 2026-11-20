// Karplus–Strong plucked string. karplusStrong() is pure; createSynth() wraps it for Web Audio.
import { CONFIG } from './config.js';

export function karplusStrong(freq, sampleRate, {
  duration = CONFIG.SOUND_DURATION_S,
  decayS = CONFIG.DECAY_S,
  random = Math.random,
} = {}) {
  const out = new Float32Array(Math.round(duration * sampleRate));
  const N = Math.max(2, Math.round(sampleRate / freq));
  const line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = random() * 2 - 1;
  // One pass round the delay line per period: the note falls by e every decayS seconds.
  // The two-point average also loses cos(pi f / fs) per pass at the fundamental, so divide
  // that out. Capped below 1 so no component (e.g. DC) can ever grow.
  const rho = Math.min(Math.exp(-1 / (freq * decayS)) / Math.cos((Math.PI * freq) / sampleRate), 0.99999);
  let k = 0;
  for (let i = 0; i < out.length; i++) {
    const next = k + 1 === N ? 0 : k + 1;
    const y = rho * 0.5 * (line[k] + line[next]);
    line[k] = y;
    out[i] = y;
    k = next;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.9 / peak;
  return out;
}

// Browser only: plays cached Karplus–Strong buffers through a per-pluck gain.
export function createSynth(ctx) {
  const cache = new Map();
  // Every voice goes through one master gain and a compressor, so sweeping across several
  // strings at once (each buffer peaks at 0.9) can't clip the output.
  const master = ctx.createGain();
  master.gain.value = 0.5;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  master.connect(limiter).connect(ctx.destination);
  function bufferFor(freq) {
    const key = freq.toFixed(3);
    let buf = cache.get(key);
    if (!buf) {
      const data = karplusStrong(freq, ctx.sampleRate);
      buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.copyToChannel(data, 0);
      cache.set(key, buf);
    }
    return buf;
  }
  return {
    pluck(freq, velocity) {
      const src = ctx.createBufferSource();
      src.buffer = bufferFor(freq);
      const gain = ctx.createGain();
      gain.gain.value = velocity;
      src.connect(gain).connect(master);
      src.start();
    },
  };
}
