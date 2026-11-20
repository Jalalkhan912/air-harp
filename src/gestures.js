// Gesture state machine: hand frames + current strings -> gesture events. Pure, no browser code.
// Never mutates `strings`; reads only id, a, b and createdAt.
import { CONFIG } from './config.js';
import { dist, segmentsIntersect, pointToSegmentDistance } from './geometry.js';
import { createPinchTracker, pinchPoint, isOpenPalm, palmCenter, indexTip } from './hands.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createGestureEngine(cfg = CONFIG) {
  const pinch = createPinchTracker(cfg);
  let state = 'idle';
  let previewA = null;
  let previewB = null;
  let releaseStart = null;     // t of the last frame on which both hands were pinched
  let muteUntil = -Infinity;
  const prevTips = new Map();  // label -> { p: Point, t }
  const lastPluck = new Map(); // string id -> t
  let deleteTarget = null;     // { id, start }

  function cancelDelete(events) {
    if (deleteTarget) {
      events.push({ type: 'deleteProgress', id: deleteTarget.id, progress: 0 });
      deleteTarget = null;
    }
  }

  function updateDraw(t, hands, pinched, events) {
    const pinchedHands = hands.filter((h) => pinched.get(h.label));
    if (pinchedHands.length >= 2) {
      const [p, q] = [pinchPoint(pinchedHands[0]), pinchPoint(pinchedHands[1])].sort((m, n) => m.x - n.x);
      previewA = p;
      previewB = q;
      releaseStart = t;
      if (state === 'idle') {
        state = 'drawing';
        cancelDelete(events);
      }
      events.push({ type: 'preview', a: previewA, b: previewB });
      return;
    }
    if (state !== 'drawing') return;
    // Fewer than two pinched hands (opened, or lost by tracking): wait out RELEASE_MS.
    if (t - releaseStart >= cfg.RELEASE_MS) {
      events.push({ type: 'previewEnd' });
      if (dist(previewA, previewB) >= cfg.MIN_STRING_LENGTH) {
        events.push({ type: 'create', a: previewA, b: previewB });
      }
      state = 'idle';
      previewA = previewB = releaseStart = null;
      muteUntil = t + cfg.POST_DRAW_MUTE_MS;
    }
  }

  function updatePluck(t, hands, pinched, open, strings, events) {
    if (state !== 'idle' || t < muteUntil) return;
    for (const hand of hands) {
      if (pinched.get(hand.label) || open.get(hand.label)) continue;
      const prev = prevTips.get(hand.label);
      if (!prev) continue;
      const cur = indexTip(hand);
      const len = dist(prev.p, cur);
      if (len === 0 || len > cfg.MAX_JUMP_PX) continue;
      const dt = t - prev.t;
      const velocity = clamp(dt > 0 ? len / dt / cfg.PLUCK_SPEED_MAX : 1, 0.2, 1);
      for (const str of strings) {
        if (!segmentsIntersect(prev.p, cur, str.a, str.b)) continue;
        const last = lastPluck.get(str.id);
        if (last !== undefined && t - last < cfg.PLUCK_COOLDOWN_MS) continue;
        lastPluck.set(str.id, t);
        events.push({ type: 'pluck', id: str.id, velocity });
      }
    }
  }

  function updateDelete(t, hands, open, strings, events) {
    if (state !== 'idle') return;
    const palm = hands.find((h) => open.get(h.label));
    let target = null;
    if (palm) {
      const c = palmCenter(palm);
      let best = Infinity;
      for (const str of strings) {
        if (t - str.createdAt < cfg.DELETE_GRACE_MS) continue;
        const d = pointToSegmentDistance(c, str.a, str.b);
        if (d <= cfg.DELETE_RADIUS && d < best) {
          best = d;
          target = str;
        }
      }
    }
    if (!target) {
      cancelDelete(events);
      return;
    }
    if (!deleteTarget || deleteTarget.id !== target.id) {
      cancelDelete(events);
      deleteTarget = { id: target.id, start: t };
      return;
    }
    const progress = Math.min(1, (t - deleteTarget.start) / cfg.DELETE_HOLD_MS);
    events.push({ type: 'deleteProgress', id: target.id, progress });
    if (progress >= 1) {
      events.push({ type: 'delete', id: target.id });
      deleteTarget = null;
    }
  }

  return {
    get state() {
      return state;
    },
    update(frame, strings) {
      const { t, hands } = frame;
      const events = [];
      const pinched = pinch.update(hands);
      const open = new Map(hands.map((h) => [h.label, isOpenPalm(h, cfg)]));

      updateDraw(t, hands, pinched, events);
      updatePluck(t, hands, pinched, open, strings, events);
      updateDelete(t, hands, open, strings, events);

      // Fingertip history: every present hand, in all states; absent labels forgotten.
      const present = new Set(hands.map((h) => h.label));
      for (const label of [...prevTips.keys()]) if (!present.has(label)) prevTips.delete(label);
      for (const h of hands) prevTips.set(h.label, { p: indexTip(h), t });
      return events;
    },
  };
}
