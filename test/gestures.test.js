import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHand } from './helpers/hands.js';
import { createGestureEngine } from '../src/gestures.js';
import { CONFIG } from '../src/config.js';

const DT = 33;
const P = (x, y) => ({ x, y });
const frame = (t, hands) => ({ t, width: 1280, height: 720, hands });
const s = (id, a, b, createdAt = -10000) => ({ id, a, b, createdAt });
const L = (pose, at) => makeHand({ label: 'Left', pose, at });
const R = (pose, at) => makeHand({ label: 'Right', pose, at });
const near = (p, q, tol = 1) => Math.hypot(p.x - q.x, p.y - q.y) <= tol;

// Feeds frames 33 ms apart. Each step is a list of hands; returns all events tagged with t.
function run(engine, steps, strings = [], t0 = 0) {
  const out = [];
  steps.forEach((hands, i) => {
    const t = t0 + i * DT;
    for (const e of engine.update(frame(t, hands), strings)) out.push({ ...e, t });
  });
  return out;
}
const ofType = (events, type) => events.filter((e) => e.type === type);
const repeat = (n, hands) => Array.from({ length: n }, () => hands);

test('draw creates a string', () => {
  const g = createGestureEngine();
  const ev = run(g, [
    ...repeat(3, [L('pinch', P(100, 300)), R('pinch', P(500, 300))]),
    ...repeat(4, [L('pinch', P(100, 300)), R('point', P(500, 300))]),
  ]);
  assert.equal(ofType(ev, 'preview').length, 3);
  assert.equal(ofType(ev, 'previewEnd').length, 1);
  const [c] = ofType(ev, 'create');
  assert.ok(c, 'create emitted');
  assert.ok(near(c.a, P(100, 300)) && near(c.b, P(500, 300)), JSON.stringify(c));
  assert.equal(g.state, 'idle');
});

test('preview points are ordered by x', () => {
  const g = createGestureEngine();
  const [p] = run(g, [[R('pinch', P(500, 300)), L('pinch', P(100, 300))]]);
  assert.equal(p.type, 'preview');
  assert.ok(p.a.x < p.b.x);
});

test('draw follows hands', () => {
  const g = createGestureEngine();
  const ev = run(g, [
    ...repeat(2, [L('pinch', P(100, 300)), R('pinch', P(500, 300))]),
    [L('pinch', P(100, 300)), R('pinch', P(600, 300))],
    [L('pinch', P(100, 300)), R('pinch', P(700, 300))],
    ...repeat(4, [L('pinch', P(100, 300)), R('point', P(700, 300))]),
  ]);
  const [c] = ofType(ev, 'create');
  assert.ok(c && near(c.b, P(700, 300)), JSON.stringify(c));
});

test('short draw discarded', () => {
  const g = createGestureEngine();
  const ev = run(g, [
    ...repeat(3, [L('pinch', P(100, 300)), R('pinch', P(140, 300))]),
    ...repeat(4, [L('pinch', P(100, 300)), R('point', P(140, 300))]),
  ]);
  assert.equal(ofType(ev, 'previewEnd').length, 1);
  assert.equal(ofType(ev, 'create').length, 0);
  assert.equal(g.state, 'idle');
});

test("one-frame flicker doesn't commit (Review Focus 4)", () => {
  const g = createGestureEngine();
  const both = [L('pinch', P(100, 300)), R('pinch', P(500, 300))];
  const ev = run(g, [
    ...repeat(3, both),
    [L('pinch', P(100, 300)), R('point', P(500, 300))],
    ...repeat(3, both),
  ]);
  assert.equal(ofType(ev, 'previewEnd').length, 0);
  assert.equal(ofType(ev, 'create').length, 0);
  assert.equal(g.state, 'drawing');
});

test('hand leaving mid-draw commits (Review Focus 1)', () => {
  const g = createGestureEngine();
  const ev = run(g, [
    ...repeat(3, [L('pinch', P(100, 300)), R('pinch', P(500, 300))]),
    ...repeat(4, [L('pinch', P(100, 300))]),
  ]);
  const [c] = ofType(ev, 'create');
  assert.ok(c && near(c.a, P(100, 300)) && near(c.b, P(500, 300)), JSON.stringify(c));
  assert.equal(g.state, 'idle');
});

test('both hands leaving mid-draw commits too', () => {
  const g = createGestureEngine();
  const ev = run(g, [
    ...repeat(3, [L('pinch', P(100, 300)), R('pinch', P(500, 300))]),
    ...repeat(4, []),
  ]);
  assert.equal(ofType(ev, 'create').length, 1);
  assert.equal(g.state, 'idle');
});

test('no pluck or delete right after draw (Review Focus 2)', () => {
  const g = createGestureEngine();
  const strings = [];
  const steps = [
    ...repeat(3, [L('pinch', P(100, 300)), R('pinch', P(500, 300))]),
    ...repeat(4, [L('pinch', P(100, 300)), R('point', P(500, 300))]),
  ];
  let created = null;
  let t = 0;
  const all = [];
  const step = (hands) => {
    for (const e of g.update(frame(t, hands), strings)) {
      all.push({ ...e, t });
      if (e.type === 'create') {
        created = s(1, e.a, e.b, t);
        strings.push(created);
      }
    }
    t += DT;
  };
  steps.forEach(step);
  assert.ok(created, 'string created');
  const createdAt = created.createdAt;
  // Opening the hands: the fingertips sweep across the new string within the mute window.
  step([L('point', P(300, 250)), R('point', P(400, 250))]);
  step([L('point', P(300, 350)), R('point', P(400, 350))]);
  assert.ok(t - createdAt <= CONFIG.POST_DRAW_MUTE_MS);
  // Then an open palm rests on it for 1.2 s.
  while (t - createdAt <= 1200) step([R('open', P(300, 300))]);
  assert.equal(all.filter((e) => e.type === 'pluck' && e.id === 1).length, 0);
  assert.equal(all.filter((e) => e.type === 'delete' && e.id === 1).length, 0);
});

const vertical = [s(7, P(300, 100), P(300, 500))];

test('pluck: sweeping across a string plucks it once', () => {
  const g = createGestureEngine();
  const ev = run(g, [
    [R('point', P(250, 300))],
    [R('point', P(350, 300))],
    ...repeat(5, [R('point', P(350, 300))]),
  ], vertical);
  const plucks = ofType(ev, 'pluck');
  assert.equal(plucks.length, 1);
  assert.equal(plucks[0].id, 7);
  assert.ok(plucks[0].velocity >= 0.2 && plucks[0].velocity <= 1);
});

test('pluck: resting exactly on a string does not re-pluck', () => {
  const g = createGestureEngine();
  const ev = run(g, [
    [R('point', P(250, 300))],
    ...repeat(10, [R('point', P(300, 300))]),
  ], vertical);
  assert.equal(ofType(ev, 'pluck').length, 1);
});

test('fast sweep is louder', () => {
  const vel = (dx) => {
    const g = createGestureEngine();
    const ev = run(g, [[R('point', P(300 - dx / 2, 300))], [R('point', P(300 + dx / 2, 300))]], vertical);
    return ofType(ev, 'pluck')[0].velocity;
  };
  assert.ok(vel(100) > vel(30), `${vel(100)} <= ${vel(30)}`);
});

test('sweep plucks several strings', () => {
  const g = createGestureEngine();
  const three = [s(1, P(300, 100), P(300, 500)), s(2, P(320, 100), P(320, 500)), s(3, P(340, 100), P(340, 500))];
  const ev = run(g, [[R('point', P(250, 300))], [R('point', P(400, 300))]], three);
  assert.deepEqual(ofType(ev, 'pluck').map((e) => e.id).sort(), [1, 2, 3]);
});

test('cooldown: back-and-forth within PLUCK_COOLDOWN_MS plucks once', () => {
  const g = createGestureEngine();
  const ev = run(g, [[R('point', P(250, 300))], [R('point', P(350, 300))], [R('point', P(250, 300))]], vertical);
  assert.equal(ofType(ev, 'pluck').length, 1);
});

test('cooldown: back-and-forth 100 ms apart plucks twice', () => {
  const g = createGestureEngine();
  const strings = vertical;
  let n = 0;
  const step = (t, x) => (n += g.update(frame(t, [R('point', P(x, 300))]), strings).filter((e) => e.type === 'pluck').length);
  step(0, 250);
  step(100, 350);
  step(200, 250);
  assert.equal(n, 2);
});

for (const pose of ['pinch', 'open']) {
  test(`${pose} hands don't pluck`, () => {
    const g = createGestureEngine();
    const ev = run(g, [[R(pose, P(250, 300))], [R(pose, P(350, 300))]], vertical);
    assert.equal(ofType(ev, 'pluck').length, 0);
  });
}

test('fist hands do pluck', () => {
  const g = createGestureEngine();
  const ev = run(g, [[R('fist', P(250, 300))], [R('fist', P(350, 300))]], vertical);
  assert.equal(ofType(ev, 'pluck').length, 1);
});

test("reappearing hand doesn't pluck (Review Focus 3)", () => {
  const g = createGestureEngine();
  const ev = run(g, [[R('point', P(250, 300))], [], [R('point', P(350, 300))]], vertical);
  assert.equal(ofType(ev, 'pluck').length, 0);
});

test("teleport doesn't pluck", () => {
  const g = createGestureEngine();
  const ev = run(g, [[R('point', P(150, 300))], [R('point', P(450, 300))]], vertical);
  assert.equal(ofType(ev, 'pluck').length, 0);
});

const horizontal = () => [s(9, P(200, 300), P(600, 300))];

test('delete after hold', () => {
  const g = createGestureEngine();
  const ev = run(g, repeat(40, [R('open', P(400, 305))]), horizontal());
  const dels = ofType(ev, 'delete');
  // The strings array is never pruned here, so look only up to the first delete.
  const progress = ofType(ev, 'deleteProgress').filter((e) => !dels.length || e.t <= dels[0].t);
  assert.ok(progress.length > 5);
  for (let i = 1; i < progress.length; i++) assert.ok(progress[i].progress > progress[i - 1].progress);
  assert.equal(dels.length >= 1, true);
  assert.equal(dels[0].id, 9);
  const start = progress[0].t - progress[0].progress * CONFIG.DELETE_HOLD_MS;
  assert.ok(dels[0].t - start >= CONFIG.DELETE_HOLD_MS);
  assert.ok(dels[0].t - DT - start < CONFIG.DELETE_HOLD_MS, 'fires on the first frame at or after the hold');
});

test('moving away cancels', () => {
  const g = createGestureEngine();
  const holdFrames = Math.ceil(500 / DT);
  const ev = run(g, [
    ...repeat(holdFrames, [R('open', P(400, 305))]),
    ...repeat(30, [R('open', P(400, 505))]),
  ], horizontal());
  const progress = ofType(ev, 'deleteProgress');
  assert.ok(progress.some((e) => e.progress > 0.3));
  assert.ok(progress.some((e) => e.id === 9 && e.progress === 0), 'cancel emitted');
  assert.equal(ofType(ev, 'delete').length, 0);
});

test('no pluck/delete while drawing', () => {
  const g = createGestureEngine();
  const strings = [s(1, P(300, 100), P(300, 500)), s(2, P(100, 250), P(100, 350))];
  const ev = run(g, [
    [L('pinch', P(100, 300)), R('pinch', P(250, 300))],
    [L('pinch', P(100, 300)), R('pinch', P(350, 300))],
    [L('pinch', P(100, 300)), R('pinch', P(250, 300))],
  ], strings);
  assert.equal(g.state, 'drawing');
  assert.equal(ofType(ev, 'pluck').length, 0);
  assert.equal(ofType(ev, 'delete').length, 0);
});

test('engine never mutates strings', () => {
  const g = createGestureEngine();
  const strings = horizontal();
  Object.freeze(strings[0]);
  Object.freeze(strings);
  run(g, repeat(40, [R('open', P(400, 305))]), strings);
});
