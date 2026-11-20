import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHand } from './helpers/hands.js';
import {
  handSize, pinchRatio, pinchPoint, isOpenPalm, palmCenter, indexTip,
  createPinchTracker, smoothHands,
} from '../src/hands.js';
import { CONFIG } from '../src/config.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b}±${tol}, got ${a}`);

for (const label of ['Right', 'Left']) {
  test(`builder poses classify as intended (${label})`, () => {
    for (const pose of ['point', 'pinch', 'open', 'fist']) {
      const h = makeHand({ label, pose, at: { x: 400, y: 300 }, size: 120 });
      near(handSize(h), 120, 0.01, `${pose} size`);
      if (pose === 'pinch') assert.ok(pinchRatio(h) < 0.1, `pinch ratio ${pinchRatio(h)}`);
      else assert.ok(pinchRatio(h) > 0.6, `${pose} ratio ${pinchRatio(h)}`);
      assert.equal(isOpenPalm(h), pose === 'open', `${pose} open palm`);
    }
  });
}

test('builder anchors: pinch point, index tip, palm center', () => {
  const pp = pinchPoint(makeHand({ pose: 'pinch', at: { x: 200, y: 300 } }));
  assert.ok(Math.hypot(pp.x - 200, pp.y - 300) <= 1, `pinch point ${JSON.stringify(pp)}`);
  assert.deepEqual(indexTip(makeHand({ pose: 'point', at: { x: 50, y: 60 } })), { x: 50, y: 60 });
  const pc = palmCenter(makeHand({ pose: 'open', at: { x: 70, y: 80 } }));
  near(pc.x, 70, 1e-9); near(pc.y, 80, 1e-9);
});

// A 'point' hand whose thumb tip sits `ratio * size` from the index tip.
function withRatio(ratio, label = 'Right') {
  const h = makeHand({ label, pose: 'point', at: { x: 300, y: 300 }, size: 100 });
  const tip = h.landmarks[8];
  h.landmarks[4] = { x: tip.x + ratio * 100, y: tip.y };
  return h;
}

test('pinch tracker uses hysteresis between PINCH_ON and PINCH_OFF', () => {
  const tr = createPinchTracker();
  const seq = [0.2, 0.3, 0.35, 0.45, 0.3].map((r) => tr.update([withRatio(r)]).get('Right'));
  assert.deepEqual(seq, [true, true, true, false, false]);
  near(pinchRatio(withRatio(0.3)), 0.3, 1e-9);
});

test('pinch tracker drops labels missing from the frame', () => {
  const tr = createPinchTracker();
  tr.update([withRatio(0.2, 'Right'), withRatio(0.2, 'Left')]);
  const out = tr.update([withRatio(0.3, 'Left')]);
  assert.equal(out.has('Right'), false);
  assert.equal(out.get('Left'), true);
  // Right comes back with a mid ratio: its old pinched state was forgotten.
  assert.equal(tr.update([withRatio(0.3, 'Right')]).get('Right'), false);
});

test('smoothHands blends matching labels and passes new labels through', () => {
  const mk = (label, x) => ({ label, landmarks: Array.from({ length: 21 }, () => ({ x, y: x })) });
  const out = smoothHands([mk('Right', 0)], [mk('Right', 10), mk('Left', 7)], 0.5);
  assert.equal(out[0].landmarks[3].x, 5);
  assert.equal(out[0].landmarks[3].y, 5);
  assert.deepEqual(out[1], mk('Left', 7));
  assert.equal(smoothHands(null, [mk('Right', 10)])[0].landmarks[0].x, 10);
  assert.equal(CONFIG.SMOOTHING, 0.5);
});

import { stabilizeLabels } from '../src/hands.js';

const at = (label, x) => makeHand({ label, pose: 'point', at: { x, y: 300 } });

test('stabilizeLabels undoes a one-frame label swap', () => {
  const prev = [at('Left', 200), at('Right', 600)];
  const cur = stabilizeLabels(prev, [at('Right', 205), at('Left', 598)]);
  const byLabel = Object.fromEntries(cur.map((h) => [h.label, h.landmarks[8].x]));
  assert.deepEqual(byLabel, { Left: 205, Right: 598 });
});

test('stabilizeLabels separates colliding labels by nearest previous hand', () => {
  const prev = [at('Left', 200), at('Right', 600)];
  const cur = stabilizeLabels(prev, [at('Left', 590), at('Left', 210)]);
  const byLabel = Object.fromEntries(cur.map((h) => [h.label, h.landmarks[8].x]));
  assert.deepEqual(byLabel, { Left: 210, Right: 590 });
});

test('stabilizeLabels with no history splits colliding labels the MediaPipe way', () => {
  // MediaPipe expects mirrored input; the raw camera frame isn't, so the hand on the left of
  // the (mirrored) screen comes back as 'Right'.
  const cur = stabilizeLabels(null, [at('Left', 200), at('Left', 600)]);
  const byLabel = Object.fromEntries(cur.map((h) => [h.label, h.landmarks[8].x]));
  assert.deepEqual(byLabel, { Right: 200, Left: 600 });
});

test('a one-frame label swap does not pluck (review)', async () => {
  const { createGestureEngine } = await import('../src/gestures.js');
  const g = createGestureEngine();
  const strings = [{ id: 1, a: { x: 400, y: 0 }, b: { x: 400, y: 700 }, createdAt: -1e4 }];
  let prev = null;
  let plucks = 0;
  // Smoothing a swapped hand toward the other one's old position would carry it across x=400.
  const frames = [
    [at('Left', 250), at('Right', 650)],
    [at('Left', 250), at('Right', 650)],
    [at('Right', 250), at('Left', 650)], // tracker swaps labels for one frame
    [at('Left', 250), at('Right', 650)],
  ];
  frames.forEach((raw, i) => {
    const hands = smoothHands(prev, stabilizeLabels(prev, raw), 0.5);
    prev = hands;
    plucks += g.update({ t: i * 33, width: 1280, height: 720, hands }, strings).filter((e) => e.type === 'pluck').length;
  });
  assert.equal(plucks, 0);
});
