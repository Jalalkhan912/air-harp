// Hand pose features from MediaPipe landmarks (screen pixels). Pure, no browser code.
import { CONFIG } from './config.js';
import { dist, midpoint } from './geometry.js';

export function handSize(hand) {
  return dist(hand.landmarks[0], hand.landmarks[9]);
}

export function pinchRatio(hand) {
  const s = handSize(hand);
  return s > 0 ? dist(hand.landmarks[4], hand.landmarks[8]) / s : Infinity;
}

export function pinchPoint(hand) {
  return midpoint(hand.landmarks[4], hand.landmarks[8]);
}

export function indexTip(hand) {
  return hand.landmarks[8];
}

export function palmCenter(hand) {
  const ids = [0, 5, 9, 13, 17];
  const lm = hand.landmarks;
  return {
    x: ids.reduce((s, i) => s + lm[i].x, 0) / ids.length,
    y: ids.reduce((s, i) => s + lm[i].y, 0) / ids.length,
  };
}

// [PIP, TIP] landmark indices for index, middle, ring and pinky.
const FINGERS = [[6, 8], [10, 12], [14, 16], [18, 20]];

export function isOpenPalm(hand, cfg = CONFIG) {
  const lm = hand.landmarks;
  const wrist = lm[0];
  for (const [pip, tip] of FINGERS) {
    if (!(dist(wrist, lm[tip]) > dist(wrist, lm[pip]) * cfg.OPEN_FINGER_RATIO)) return false;
  }
  const s = handSize(hand);
  return s > 0 && dist(lm[4], lm[5]) / s > cfg.OPEN_THUMB_RATIO;
}

// Per-label pinch state with hysteresis: on below PINCH_ON, off above PINCH_OFF.
export function createPinchTracker(cfg = CONFIG) {
  let state = new Map();
  return {
    update(hands) {
      const next = new Map();
      for (const hand of hands) {
        const r = pinchRatio(hand);
        const was = state.get(hand.label) ?? false;
        next.set(hand.label, was ? r <= cfg.PINCH_OFF : r < cfg.PINCH_ON);
      }
      state = next;
      return new Map(next);
    },
  };
}

// Exponential moving average per landmark, matched by label.
export function smoothHands(prev, cur, alpha = CONFIG.SMOOTHING) {
  return cur.map((hand) => {
    const old = prev?.find((h) => h.label === hand.label);
    if (!old) return hand;
    return {
      ...hand,
      landmarks: hand.landmarks.map((p, i) => ({
        x: old.landmarks[i].x + alpha * (p.x - old.landmarks[i].x),
        y: old.landmarks[i].y + alpha * (p.y - old.landmarks[i].y),
      })),
    };
  });
}
