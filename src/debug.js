// Developer aids: D toggles a live overlay, R records landmarks and downloads them as JSON.
// Browser only.
import { pinchRatio, isOpenPalm } from './hands.js';

export function createDebug(preEl) {
  const rec = document.createElement('div');
  rec.id = 'rec';
  rec.textContent = '● REC';
  rec.hidden = true;
  document.body.appendChild(rec);

  let overlayOn = false;
  let recording = null; // Frame[] while recording
  let fps = 0;
  let lastT = null;

  function download(frames) {
    const first = frames[0];
    const data = {
      width: first?.width ?? window.innerWidth,
      height: first?.height ?? window.innerHeight,
      frames,
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `air-harp-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    update(frame, engine, strings) {
      if (lastT !== null && frame.t > lastT) {
        const inst = 1000 / (frame.t - lastT);
        fps = fps ? fps * 0.9 + inst * 0.1 : inst;
      }
      lastT = frame.t;
      if (recording) recording.push(frame);
      if (!overlayOn) return;
      const lines = [
        `fps      ${fps.toFixed(1)}`,
        `state    ${engine.state}`,
        `strings  ${strings.length}`,
      ];
      for (const h of frame.hands) {
        lines.push(`${h.label.padEnd(6)} pinch ${pinchRatio(h).toFixed(2)}  open ${isOpenPalm(h)}`);
      }
      if (!frame.hands.length) lines.push('no hands');
      preEl.textContent = lines.join('\n');
    },
    toggleOverlay() {
      overlayOn = !overlayOn;
      preEl.hidden = !overlayOn;
      if (!overlayOn) preEl.textContent = '';
    },
    toggleRecording() {
      if (recording) {
        const frames = recording;
        recording = null;
        rec.hidden = true;
        download(frames);
      } else {
        recording = [];
        rec.hidden = false;
      }
    },
  };
}
