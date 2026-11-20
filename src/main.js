// Start screen, main loop, and application of gesture events. Browser only.
import { createTracker } from './tracker.js';
import { createGestureEngine } from './gestures.js';
import { createPinchTracker } from './hands.js';
import { createString, pluckString } from './strings.js';
import { createSynth } from './synth.js';
import { render } from './render.js';
import { createDebug } from './debug.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start');
const errorEl = document.getElementById('error');

const engine = createGestureEngine();
const pinchView = createPinchTracker(); // same input as the engine's tracker; used only for hand markers
let strings = [];
let preview = null;
let hands = [];
let pinched = new Map();
let tracker = null;
let synth = null;
const debug = createDebug(document.getElementById('debug'));

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === 'd') debug.toggleOverlay();
  else if (key === 'r') debug.toggleRecording();
});

function applyEvents(events, frame) {
  for (const e of events) {
    switch (e.type) {
      case 'preview':
        preview = { a: e.a, b: e.b };
        break;
      case 'previewEnd':
        preview = null;
        break;
      case 'create':
        strings.push(createString(e.a, e.b, frame.t, Math.hypot(frame.width, frame.height)));
        break;
      case 'pluck': {
        const str = strings.find((s) => s.id === e.id);
        if (str) {
          pluckString(str, e.velocity, frame.t);
          synth.pluck(str.freq, e.velocity);
        }
        break;
      }
      case 'deleteProgress': {
        const str = strings.find((s) => s.id === e.id);
        if (str) str.deleteProgress = e.progress;
        break;
      }
      case 'delete':
        strings = strings.filter((s) => s.id !== e.id);
        break;
    }
  }
}

function loop(now) {
  const frame = tracker.detect(now);
  if (frame) {
    const events = engine.update(frame, strings);
    applyEvents(events, frame);
    hands = frame.hands;
    pinched = pinchView.update(frame.hands);
    if (debug) debug.update(frame, engine, strings);
  }
  render(ctx, { strings, preview, hands, pinched, now });
  requestAnimationFrame(loop);
}

function showError(msg) {
  errorEl.textContent = msg;
  startBtn.disabled = false;
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  errorEl.textContent = '';

  const audio = new (window.AudioContext || window.webkitAudioContext)();
  audio.resume?.();
  synth = createSynth(audio);

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
  } catch (err) {
    console.error(err);
    showError("Camera access was denied — allow it in the browser's site settings and reload.");
    return;
  }
  video.srcObject = stream;
  await video.play().catch(() => {});

  try {
    tracker = await createTracker(video);
  } catch (err) {
    console.error(err);
    showError("Couldn't load hand tracking — check your internet connection and reload.");
    return;
  }

  overlay.classList.add('hidden');
  requestAnimationFrame(loop);
});
