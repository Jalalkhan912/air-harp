# Air Harp

Draw glowing strings in the air in front of your webcam, then pluck them with your finger.

## Run it

In this folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in Chrome or Safari, click **Click to start**, and allow camera access.
You need an internet connection the first time: hand tracking (MediaPipe) loads from a CDN.
`localhost` matters, because browsers only allow the camera on secure origins.

## Play

| Gesture | How | What happens |
|---|---|---|
| **Draw** | Pinch (thumb tip to index tip) with **both** hands, pull apart, then open either hand | A dashed line follows your hands; opening locks it in as a string. Strings shorter than 60 px are dropped. |
| **Pluck** | Sweep your index fingertip across a string | It plays a note and wobbles. Shorter strings play higher notes; faster sweeps play louder. |
| **Erase** | Hold an open palm (all five fingers spread) over a string for about 1 s | The string turns red, then disappears. Move away to cancel. |

## Keys

- `D`: debug overlay (FPS, gesture state, pinch ratios, open-palm detection).
- `R`: start/stop recording hand landmarks. Stopping downloads `air-harp-<timestamp>.json`.

## Sending a recording back

If a gesture misbehaves, press `R`, reproduce the problem, press `R` again, and send the downloaded
JSON file. It can be replayed on any machine with:

```sh
node scripts/replay.js air-harp-<timestamp>.json
```

## Development

- Tests: `node --test` (Node 22, no dependencies).
- All thresholds live in `src/config.js`.
