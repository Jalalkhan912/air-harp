import { test } from 'node:test';
import assert from 'node:assert/strict';
import { karplusStrong } from '../src/synth.js';
import { CONFIG } from '../src/config.js';

const SR = 48000;
function lcg(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rms = (x, from, to) => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += x[i] * x[i];
  return Math.sqrt(sum / (to - from));
};

test('output length matches duration', () => {
  const y = karplusStrong(220, SR, { duration: 1.5, random: lcg() });
  assert.equal(y.length, Math.round(1.5 * SR));
  assert.equal(karplusStrong(220, SR, { random: lcg() }).length, Math.round(CONFIG.SOUND_DURATION_S * SR));
});

test('samples stay within [-1, 1]', () => {
  for (const f of [98, 220, 1046.5]) {
    const y = karplusStrong(f, SR, { random: lcg() });
    for (const v of y) assert.ok(v >= -1 && v <= 1);
  }
});

// Amplitude of one frequency in x[from..to) (single-bin DFT).
const toneAmp = (x, from, to, f) => {
  let re = 0, im = 0;
  for (let i = from; i < to; i++) {
    re += x[i] * Math.cos((2 * Math.PI * f * i) / SR);
    im += x[i] * Math.sin((2 * Math.PI * f * i) / SR);
  }
  return Math.hypot(re, im);
};

// The note (fundamental) decays at DECAY_S, like the visual wobble. Broadband RMS is not
// used: the pluck's bright noise attack dies in a fraction of a second and would dominate.
test('sound decays at the shared DECAY_S rate', () => {
  const decayS = CONFIG.DECAY_S;
  for (const seed of [1, 7, 42, 12345, 999]) {
    const y = karplusStrong(220, SR, { random: lcg(seed) });
    const first = toneAmp(y, 0, Math.round(0.1 * SR), 220);
    const later = toneAmp(y, Math.round(decayS * SR), Math.round((decayS + 0.1) * SR), 220);
    const ratio = later / first;
    assert.ok(ratio >= 0.2 && ratio <= 0.6, `seed ${seed}: ratio ${ratio}`);
  }
});

test('pitch: autocorrelation peaks at the period', () => {
  const y = karplusStrong(220, SR, { random: lcg() });
  let bestLag = 0;
  let best = -Infinity;
  for (let lag = 150; lag <= 300; lag++) {
    let sum = 0;
    for (let i = 4800; i < 9600; i++) sum += y[i] * y[i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  assert.ok(Math.abs(bestLag - SR / 220) <= 2, `lag ${bestLag}`);
});

test('deterministic for the same seeded random', () => {
  const a = karplusStrong(330, SR, { random: lcg(7) });
  const b = karplusStrong(330, SR, { random: lcg(7) });
  assert.deepEqual(a, b);
});
