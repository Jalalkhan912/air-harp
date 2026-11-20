import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lengthToFrequency, pitchPosition, frequencyToColor } from '../src/pitch.js';
import { CONFIG } from '../src/config.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected}±${tol}, got ${actual}`);
const midiOf = (f) => 69 + 12 * Math.log2(f / 440);
const mod12 = (n) => ((n % 12) + 12) % 12;

test('shortest string plays HIGH_HZ', () => {
  near(lengthToFrequency(60, 1000), 1046.5, 0.5);
});

test('longest string plays LOW_HZ', () => {
  near(lengthToFrequency(1000, 1000), 98.0, 0.5);
});

test('lengths outside the range clamp to the ends', () => {
  assert.equal(lengthToFrequency(10, 1000), lengthToFrequency(60, 1000));
  assert.equal(lengthToFrequency(5000, 1000), lengthToFrequency(1000, 1000));
});

test('longer strings never play higher', () => {
  let prev = Infinity;
  for (let len = 60; len <= 1000; len += 10) {
    const f = lengthToFrequency(len, 1000);
    assert.ok(f <= prev, `length ${len}: ${f} > ${prev}`);
    prev = f;
  }
});

test('outputs snap to the C major pentatonic scale', () => {
  for (let len = 60; len <= 1000; len += 10) {
    const f = lengthToFrequency(len, 1000);
    const m = Math.round(midiOf(f));
    assert.ok([0, 2, 4, 7, 9].includes(mod12(m - 60)), `length ${len}: midi ${m} not in scale`);
    near(f, 440 * 2 ** ((m - 69) / 12), 0.01, `length ${len}:`);
  }
});

test('SNAP_TO_SCALE false gives continuous pitch', () => {
  const f = lengthToFrequency(530, 1000, { ...CONFIG, SNAP_TO_SCALE: false });
  const m = midiOf(f);
  assert.ok(Math.abs(m - Math.round(m)) > 0.01, `midi ${m} is a whole note`);
});

test('pitchPosition spans 0..1 from LOW_HZ to HIGH_HZ', () => {
  near(pitchPosition(CONFIG.LOW_HZ), 0, 1e-9);
  near(pitchPosition(CONFIG.HIGH_HZ), 1, 1e-9);
});

test('low notes are warm, high notes are cool', () => {
  const low = frequencyToColor(98);
  const high = frequencyToColor(1046.5);
  assert.match(low, /^hsl\(/);
  assert.match(high, /^hsl\(/);
  assert.notEqual(low, high);
  const hue = (s) => parseFloat(s.slice(4));
  near(hue(low), 20, 0.5, 'low hue');
  near(hue(high), 220, 0.5, 'high hue');
});
