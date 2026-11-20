// Pure 2D geometry helpers. Points are { x, y } in screen pixels.

export function dist(p, q) {
  return Math.hypot(q.x - p.x, q.y - p.y);
}

export function midpoint(p, q) {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

// Sign of the cross product (b - a) x (c - a): >0 left turn, <0 right turn, 0 collinear.
function orient(a, b, c) {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

// True when c lies within the bounding box of segment a-b (used for collinear cases).
function onSegment(a, b, c) {
  return Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) &&
         Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y);
}

export function segmentsIntersect(p1, p2, q1, q2) {
  const o1 = orient(p1, p2, q1);
  const o2 = orient(p1, p2, q2);
  const o3 = orient(q1, q2, p1);
  const o4 = orient(q1, q2, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, p2, q2)) return true;
  if (o3 === 0 && onSegment(q1, q2, p1)) return true;
  if (o4 === 0 && onSegment(q1, q2, p2)) return true;
  return false;
}

export function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let u = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  u = Math.max(0, Math.min(1, u));
  return dist(p, { x: a.x + u * dx, y: a.y + u * dy });
}
