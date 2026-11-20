// Canvas drawing of strings, the draw preview and hand markers. Browser only.
import { displacement, glow } from './strings.js';
import { indexTip, pinchPoint } from './hands.js';

const SEGMENTS = 40;

function stringPath(ctx, str, now) {
  const dx = str.b.x - str.a.x;
  const dy = str.b.y - str.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  for (let i = 0; i <= SEGMENTS; i++) {
    const u = i / SEGMENTS;
    const d = displacement(str, u, now);
    const x = str.a.x + dx * u + nx * d;
    const y = str.a.y + dy * u + ny * d;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

function drawString(ctx, str, now) {
  const g = glow(str, now);
  ctx.save();
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = str.color;
  ctx.shadowColor = str.color;
  ctx.shadowBlur = 20 * g;
  stringPath(ctx, str, now);
  ctx.stroke();
  if (str.deleteProgress > 0) {
    // Fade toward red as the delete countdown runs.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255, 40, 40, ${Math.min(1, str.deleteProgress)})`;
    ctx.stroke();
  }
  // Anchor dots at the ends.
  ctx.shadowBlur = 0;
  ctx.fillStyle = str.color;
  for (const p of [str.a, str.b]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function render(ctx, { strings, preview, hands, pinched, now }) {
  const { width, height } = ctx.canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);

  for (const str of strings) drawString(ctx, str, now);

  if (preview) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(preview.a.x, preview.a.y);
    ctx.lineTo(preview.b.x, preview.b.y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  for (const hand of hands) {
    const tip = indexTip(hand);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (pinched?.get(hand.label)) {
      const p = pinchPoint(hand);
      ctx.strokeStyle = 'rgba(255, 210, 122, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
