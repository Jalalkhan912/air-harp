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
  // label -> Map<string id, { side: -1|1, p: Point }>: last side of each string the fingertip was
  // clearly on (beyond PLUCK_DEADBAND_PX), and where. Jitter inside the band never flips it.
  const sides = new Map();
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

  // Signed distance from p to the infinite line through the string.
  function signedDist(p, str) {
    const dx = str.b.x - str.a.x;
    const dy = str.b.y - str.a.y;
    const len = Math.hypot(dx, dy) || 1;
    return ((p.x - str.a.x) * dy - (p.y - str.a.y) * dx) / len;
  }

  // Updates every present hand's side of every string, in all states. Returns, per label, the
  // strings whose side flipped this frame along a path that actually crosses the string.
  function updateSides(hands, strings) {
    const flips = new Map();
    const present = new Set(hands.map((h) => h.label));
    for (const label of [...sides.keys()]) if (!present.has(label)) sides.delete(label);
    for (const hand of hands) {
      const tip = indexTip(hand);
      let known = sides.get(hand.label);
      if (!known) sides.set(hand.label, (known = new Map()));
      const flipped = [];
      const ids = new Set();
      for (const str of strings) {
        ids.add(str.id);
        const d = signedDist(tip, str);
        if (Math.abs(d) <= cfg.PLUCK_DEADBAND_PX) continue;
        const side = Math.sign(d);
        const prev = known.get(str.id);
        if (prev && prev.side !== side && segmentsIntersect(prev.p, tip, str.a, str.b)) flipped.push(str);
        known.set(str.id, { side, p: tip });
      }
      for (const id of [...known.keys()]) if (!ids.has(id)) known.delete(id);
      flips.set(hand.label, flipped);
    }
    return flips;
  }

  function updatePluck(t, hands, pinched, open, flips, events) {
    if (state !== 'idle' || t < muteUntil) return;
    for (const hand of hands) {
      if (pinched.get(hand.label) || open.get(hand.label)) continue;
      const prev = prevTips.get(hand.label);
      if (!prev) continue;
      const cur = indexTip(hand);
      const len = dist(prev.p, cur);
      if (len > cfg.MAX_JUMP_PX) continue;
      const dt = t - prev.t;
      const velocity = clamp(dt > 0 ? len / dt / cfg.PLUCK_SPEED_MAX : 1, 0.2, 1);
      for (const str of flips.get(hand.label) ?? []) {
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
      const flips = updateSides(hands, strings);
      updatePluck(t, hands, pinched, open, flips, events);
      updateDelete(t, hands, open, strings, events);

      // Fingertip history: every present hand, in all states; absent labels forgotten.
      const present = new Set(hands.map((h) => h.label));
      for (const label of [...prevTips.keys()]) if (!present.has(label)) prevTips.delete(label);
      for (const h of hands) prevTips.set(h.label, { p: indexTip(h), t });
      return events;
    },
  };
}
