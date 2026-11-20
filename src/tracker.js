// MediaPipe HandLandmarker wrapper. Browser only.
// Returns frames in mirrored window pixels (matching the CSS-mirrored, object-fit: cover video).
import { smoothHands, stabilizeLabels } from './hands.js';
import { CONFIG } from './config.js';

const MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export async function createTracker(video) {
  // Dynamic import so a CDN failure surfaces as a catchable error, not a dead page.
  const { FilesetResolver, HandLandmarker } = await import(MP_URL);
  const fileset = await FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
  const landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  });

  let prevHands = null;
  let lastVideoTime = -1;

  return {
    // Returns a Frame for each new video frame, or null when the camera has no new frame yet.
    detect(now) {
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return null;
      lastVideoTime = video.currentTime;
      const res = landmarker.detectForVideo(video, now);

      const width = window.innerWidth;
      const height = window.innerHeight;
      // Map normalized video coords to the on-screen video rect (object-fit: cover), mirrored.
      const vw = video.videoWidth || width;
      const vh = video.videoHeight || height;
      const scale = Math.max(width / vw, height / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const ox = (width - dw) / 2;
      const oy = (height - dh) / 2;

      const handedness = res.handedness ?? res.handednesses ?? [];
      let hands = (res.landmarks ?? []).map((lms, i) => ({
        label: handedness[i]?.[0]?.categoryName ?? (i === 0 ? 'Right' : 'Left'),
        landmarks: lms.map((p) => ({ x: ox + (1 - p.x) * dw, y: oy + p.y * dh })),
      }));
      hands = stabilizeLabels(prevHands, hands);
      hands = smoothHands(prevHands, hands, CONFIG.SMOOTHING);
      prevHands = hands;
      return { t: now, width, height, hands };
    },
  };
}
