// Synthetic hand builder for tests. Coordinates are screen pixels, fingers point up.
// Layout is in units of hand size s = dist(wrist, middle MCP).

const P = (x, y) => ({ x, y });

// Finger chains: [MCP, PIP, DIP, TIP] for index (5-8), middle (9-12), ring (13-16), pinky (17-20).
const MCP = { index: P(-0.3, -0.95), middle: P(0, -1), ring: P(0.25, -0.95), pinky: P(0.45, -0.85) };

function extended(mcp) {
  return [mcp, P(mcp.x, mcp.y - 0.35), P(mcp.x, mcp.y - 0.6), P(mcp.x, mcp.y - 0.85)];
}
function curled(mcp) {
  // PIP rises a little, then the finger folds back so the tip sits near the MCP.
  return [mcp, P(mcp.x, mcp.y - 0.3), P(mcp.x, mcp.y - 0.15), P(mcp.x, mcp.y + 0.2)];
}

const THUMB = {
  out:    [P(-0.25, -0.3), P(-0.45, -0.5), P(-0.65, -0.65), P(-0.85, -0.8)],
  tucked: [P(-0.2, -0.25), P(-0.25, -0.45), P(-0.15, -0.6), P(-0.1, -0.7)],
  // Folded across the palm, away from the curled index tip (fist).
  across: [P(-0.2, -0.25), P(-0.15, -0.4), P(0.1, -0.45), P(0.35, -0.4)],
};

function layout(pose) {
  const lm = new Array(21);
  lm[0] = P(0, 0);
  const fingers = { index: 5, middle: 9, ring: 13, pinky: 17 };
  let thumb;
  if (pose === 'open') {
    thumb = THUMB.out;
    for (const [name, i] of Object.entries(fingers)) extended(MCP[name]).forEach((p, k) => (lm[i + k] = p));
  } else if (pose === 'point') {
    thumb = THUMB.tucked;
    for (const [name, i] of Object.entries(fingers)) {
      (name === 'index' ? extended : curled)(MCP[name]).forEach((p, k) => (lm[i + k] = p));
    }
  } else if (pose === 'fist') {
    thumb = THUMB.across;
    for (const [name, i] of Object.entries(fingers)) curled(MCP[name]).forEach((p, k) => (lm[i + k] = p));
  } else if (pose === 'pinch') {
    // Index bends toward the thumb; tips meet at (-0.6, -1.0).
    thumb = [P(-0.25, -0.3), P(-0.45, -0.55), P(-0.6, -0.75), P(-0.58, -1.0)];
    [MCP.index, P(-0.4, -1.15), P(-0.55, -1.12), P(-0.62, -1.0)].forEach((p, k) => (lm[5 + k] = p));
    for (const name of ['middle', 'ring', 'pinky']) extended(MCP[name]).forEach((p, k) => (lm[fingers[name] + k] = p));
  } else {
    throw new Error(`unknown pose ${pose}`);
  }
  thumb.forEach((p, k) => (lm[1 + k] = p));
  return lm;
}

function anchor(pose, lm) {
  if (pose === 'pinch') return P((lm[4].x + lm[8].x) / 2, (lm[4].y + lm[8].y) / 2);
  if (pose === 'point') return lm[8];
  const ids = [0, 5, 9, 13, 17];
  return P(ids.reduce((s, i) => s + lm[i].x, 0) / 5, ids.reduce((s, i) => s + lm[i].y, 0) / 5);
}

export function makeHand({ label = 'Right', pose = 'point', at = P(0, 0), size = 100 } = {}) {
  const local = layout(pose);
  const mirror = label === 'Left' ? -1 : 1;
  const ref = anchor(pose, local);
  const landmarks = local.map((p) => P(at.x + (p.x - ref.x) * size * mirror, at.y + (p.y - ref.y) * size));
  return { label, landmarks };
}
