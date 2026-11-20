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
