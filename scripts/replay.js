#!/usr/bin/env node
// Replays a landmark recording (from the R key) through the gesture engine.
// Usage: node scripts/replay.js <recording.json>
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CONFIG } from '../src/config.js';
import { createGestureEngine } from '../src/gestures.js';
import { createString } from '../src/strings.js';

// Returns every gesture event, each tagged with the frame time `t`. Created strings are kept
// in a local array (and deleted ones removed) so plucks and deletes behave as they did live.
// `recording.strings` (optional) holds the strings on screen when recording started.
export function runRecording(recording, cfg = CONFIG) {
  const engine = createGestureEngine(cfg);
  let strings = (recording.strings ?? []).map((s) => ({ ...s }));
  let nextId = strings.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  const out = [];
  for (const frame of recording.frames) {
    for (const e of engine.update(frame, strings)) {
      out.push({ ...e, t: frame.t });
      if (e.type === 'create') {
        const w = frame.width ?? recording.width;
        const h = frame.height ?? recording.height;
        strings.push({ ...createString(e.a, e.b, frame.t, Math.hypot(w, h), cfg), id: nextId++ });
      } else if (e.type === 'delete') {
        strings = strings.filter((s) => s.id !== e.id);
      }
    }
  }
  return out;
}

const pt = (p) => `(${Math.round(p.x)},${Math.round(p.y)})`;

export function formatEvent(e, t0 = 0) {
  const head = `${Math.round(e.t - t0)}ms ${e.type}`;
  switch (e.type) {
    case 'preview':
    case 'create':
      return `${head} a=${pt(e.a)} b=${pt(e.b)}`;
    case 'pluck':
      return `${head} id=${e.id} v=${e.velocity.toFixed(2)}`;
    case 'deleteProgress':
      return `${head} id=${e.id} p=${e.progress.toFixed(2)}`;
    case 'delete':
      return `${head} id=${e.id}`;
    default:
      return head;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/replay.js <recording.json>');
    process.exit(2);
  }
  const recording = JSON.parse(readFileSync(file, 'utf8'));
  const t0 = recording.frames[0]?.t ?? 0;
  for (const e of runRecording(recording)) console.log(formatEvent(e, t0));
}
