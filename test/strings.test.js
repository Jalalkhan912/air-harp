import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createString, pluckString, displacement, glow } from '../src/strings.js';
import { lengthToFrequency, frequencyToColor } from '../src/pitch.js';
import { CONFIG } from '../src/config.js';

const P = (x, y) => ({ x, y });

test('createString computes length, pitch and color once', () => {
  const a = createString(P(0, 0), P(300, 400), 1000, 1000);
  const b = createString(P(0, 0), P(100, 0), 1000, 1000);
  assert.equal(a.length, 500);
  assert.equal(a.freq, lengthToFrequency(500, 1000));
  assert.equal(a.color, frequencyToColor(a.freq));
  assert.equal(a.createdAt, 1000);
  assert.equal(a.pluckedAt, null);
  assert.equal(a.deleteProgress, 0);
  assert.notEqual(a.id, b.id);
});

test('pitch is fixed at creation (Review Focus 5)', () => {
  const a = createString(P(0, 0), P(500, 0), 0, 1000);
  const before = a.freq;
  const b = createString(P(0, 0), P(500, 0), 0, 2000);
  assert.equal(a.freq, before);
  assert.notEqual(b.freq, a.freq, 'same length on a bigger window maps to a different note');
});

test('un-plucked string does not move', () => {
  const str = createString(P(0, 0), P(500, 0), 0, 1000);
  for (let u = 0; u <= 1; u += 0.1) assert.equal(displacement(str, u, 500), 0);
});

test('ends stay fixed', () => {
  const str = createString(P(0, 0), P(500, 0), 0, 1000);
  pluckString(str, 1, 100);
  for (let t = 100; t < 2000; t += 7) {
    assert.ok(Math.abs(displacement(str, 0, t)) < 1e-9);
    assert.ok(Math.abs(displacement(str, 1, t)) < 1e-9);
  }
});

test('amplitude never exceeds VIB_AMPLITUDE_PX * velocity', () => {
  const str = createString(P(0, 0), P(500, 0), 0, 1000);
  pluckString(str, 0.6, 0);
  let peak = 0;
  for (let t = 0; t < 3000; t += 1) {
    const d = Math.abs(displacement(str, 0.5, t));
    assert.ok(d <= CONFIG.VIB_AMPLITUDE_PX * 0.6 + 1e-9);
    peak = Math.max(peak, d);
  }
  assert.ok(peak > CONFIG.VIB_AMPLITUDE_PX * 0.6 * 0.8, `peak ${peak} unexpectedly small`);
});

test('vibration decays with DECAY_S', () => {
  const str = createString(P(0, 0), P(500, 0), 0, 1000);
  pluckString(str, 1, 0);
  const win = 1000 / CONFIG.VIB_HZ_MIN;
  const maxIn = (start) => {
    let m = 0;
    for (let t = start; t <= start + win; t += 1) m = Math.max(m, Math.abs(displacement(str, 0.5, t)));
    return m;
  };
  const early = maxIn(0);
  const late = maxIn(3 * CONFIG.DECAY_S * 1000);
  assert.ok(late < 0.1 * early, `late ${late} vs early ${early}`);
});

test('higher notes wobble faster', () => {
  const lo = createString(P(0, 0), P(1000, 0), 0, 1000);
  const hi = createString(P(0, 0), P(60, 0), 0, 1000);
  const crossings = (str) => {
    pluckString(str, 1, 0);
    let n = 0;
    let prev = displacement(str, 0.5, 1);
    for (let t = 2; t <= 1000; t += 1) {
      const d = displacement(str, 0.5, t);
      if (Math.sign(d) !== Math.sign(prev) && d !== 0) n++;
      prev = d;
    }
    return n;
  };
  assert.ok(crossings(hi) > crossings(lo));
});

test('glow is 1 at the pluck and 0 after GLOW_MS', () => {
  const str = createString(P(0, 0), P(500, 0), 0, 1000);
  assert.equal(glow(str, 0), 0);
  pluckString(str, 1, 1000);
  assert.equal(glow(str, 1000), 1);
  assert.ok(glow(str, 1000 + CONFIG.GLOW_MS / 2) > 0);
  assert.equal(glow(str, 1000 + CONFIG.GLOW_MS), 0);
  assert.equal(glow(str, 5000), 0);
});
