// String model and its visible vibration. Pure, no browser code.
import { CONFIG } from './config.js';
import { dist } from './geometry.js';
import { lengthToFrequency, frequencyToColor, pitchPosition } from './pitch.js';

let nextId = 1;

// Pitch and color are computed once here, so resizing the window later never retunes a string.
export function createString(a, b, now, maxLength, cfg = CONFIG) {
  const length = dist(a, b);
  const freq = lengthToFrequency(length, maxLength, cfg);
  return {
    id: nextId++,
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    length,
    freq,
    color: frequencyToColor(freq, cfg),
    createdAt: now,
    pluckedAt: null,
    velocity: 0,
    deleteProgress: 0,
  };
}

export function pluckString(str, velocity, now) {
  str.pluckedAt = now;
  str.velocity = velocity;
}

// Perpendicular offset in px at position u (0..1): a decaying, slowed-down standing wave.
export function displacement(str, u, now, cfg = CONFIG) {
  if (str.pluckedAt === null) return 0;
  const dt = (now - str.pluckedAt) / 1000;
  if (dt < 0) return 0;
  const visHz = cfg.VIB_HZ_MIN + (cfg.VIB_HZ_MAX - cfg.VIB_HZ_MIN) * pitchPosition(str.freq, cfg);
  return cfg.VIB_AMPLITUDE_PX * str.velocity * Math.exp(-dt / cfg.DECAY_S) *
    Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * visHz * dt);
}

// 1 at the pluck, fading linearly to 0 over GLOW_MS.
export function glow(str, now, cfg = CONFIG) {
  if (str.pluckedAt === null) return 0;
  const dt = now - str.pluckedAt;
  if (dt < 0 || dt >= cfg.GLOW_MS) return 0;
  return 1 - dt / cfg.GLOW_MS;
}
