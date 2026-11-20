// String length -> pitch, and pitch -> color. Pure, no browser code.
import { CONFIG } from './config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);
const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
const mod12 = (n) => ((n % 12) + 12) % 12;

// Nearest MIDI note (integer) whose pitch class, relative to the scale root, is in the scale.
function snapMidi(midi, cfg) {
  const inScale = (m) => cfg.SCALE.includes(mod12(m - cfg.SCALE_ROOT_MIDI));
  const base = Math.round(midi);
  let best = null;
  for (let d = 0; d <= 12; d++) {
    for (const m of [base - d, base + d]) {
      if (inScale(m) && (best === null || Math.abs(m - midi) < Math.abs(best - midi))) best = m;
    }
    if (best !== null) break;
  }
  return best ?? base;
}

// Shorter strings play higher. Log scale from HIGH_HZ (MIN_STRING_LENGTH) to LOW_HZ (maxLength).
export function lengthToFrequency(length, maxLength, cfg = CONFIG) {
  const span = Math.max(1, maxLength - cfg.MIN_STRING_LENGTH);
  const t = clamp((length - cfg.MIN_STRING_LENGTH) / span, 0, 1);
  const f = cfg.HIGH_HZ * (cfg.LOW_HZ / cfg.HIGH_HZ) ** t;
  if (!cfg.SNAP_TO_SCALE) return f;
  return midiToHz(snapMidi(hzToMidi(f), cfg));
}

// 0 at LOW_HZ, 1 at HIGH_HZ, on a log scale, clamped.
export function pitchPosition(freq, cfg = CONFIG) {
  return clamp(Math.log(freq / cfg.LOW_HZ) / Math.log(cfg.HIGH_HZ / cfg.LOW_HZ), 0, 1);
}

// Low notes warm (hue 20), high notes cool (hue 220).
export function frequencyToColor(freq, cfg = CONFIG) {
  const hue = 20 + 200 * pitchPosition(freq, cfg);
  return `hsl(${hue.toFixed(1)}, 90%, 62%)`;
}
