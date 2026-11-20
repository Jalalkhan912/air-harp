import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHand } from './helpers/hands.js';
import { runRecording } from '../scripts/replay.js';

const P = (x, y) => ({ x, y });
const L = (pose, at) => makeHand({ label: 'Left', pose, at });
const R = (pose, at) => makeHand({ label: 'Right', pose, at });

// Draw a string from (100,300) to (500,300), then pluck it ~500 ms after it is created.
function drawThenPluck() {
  const steps = [
    ...Array(3).fill([L('pinch', P(100, 300)), R('pinch', P(500, 300))]),
    ...Array(4).fill([L('pinch', P(100, 300)), R('point', P(500, 300))]),
    ...Array(16).fill([]),
    [R('point', P(300, 250))],
    [R('point', P(300, 350))],
  ];
  return {
    width: 1280,
    height: 720,
    frames: steps.map((hands, i) => ({ t: 1000 + i * 33, width: 1280, height: 720, hands })),
  };
}

const collapse = (types) => types.filter((x, i) => i === 0 || x !== types[i - 1]);

test('runRecording replays a draw then a pluck', () => {
  const events = runRecording(drawThenPluck());
  assert.deepEqual(collapse(events.map((e) => e.type)), ['preview', 'previewEnd', 'create', 'pluck']);
  for (const e of events) assert.equal(typeof e.t, 'number');
  const create = events.find((e) => e.type === 'create');
  const pluck = events.find((e) => e.type === 'pluck');
  assert.ok(pluck.t - create.t >= 500);
});

test('replay CLI prints one line per event', () => {
  const dir = mkdtempSync(join(tmpdir(), 'air-harp-'));
  const file = join(dir, 'rec.json');
  writeFileSync(file, JSON.stringify(drawThenPluck()));
  const script = fileURLToPath(new URL('../scripts/replay.js', import.meta.url));
  const out = execFileSync(process.execPath, [script, file], { encoding: 'utf8' }).trim().split('\n');
  assert.equal(out.length, runRecording(drawThenPluck()).length);
  assert.match(out.at(-1), /^\d+ms pluck id=\d+ v=\d\.\d\d$/);
});

test('replay starts from the strings that existed when recording began (review)', () => {
  // A string drawn before R was pressed, then a sweep across it.
  const recording = {
    width: 1280,
    height: 720,
    strings: [{ id: 42, a: P(300, 100), b: P(300, 500), createdAt: -5000 }],
    frames: [
      { t: 0, width: 1280, height: 720, hands: [R('point', P(250, 300))] },
      { t: 33, width: 1280, height: 720, hands: [R('point', P(350, 300))] },
    ],
  };
  const plucks = runRecording(recording).filter((e) => e.type === 'pluck');
  assert.deepEqual(plucks.map((e) => e.id), [42]);
});

test('strings created during replay never reuse a recorded id', () => {
  const rec = drawThenPluck();
  rec.strings = [{ id: 1, a: P(900, 100), b: P(900, 500), createdAt: -5000 }];
  const created = runRecording(rec).find((e) => e.type === 'create');
  assert.ok(created);
  const plucks = runRecording(rec).filter((e) => e.type === 'pluck');
  assert.ok(plucks.length >= 1 && plucks.every((e) => e.id !== 1), JSON.stringify(plucks));
});
