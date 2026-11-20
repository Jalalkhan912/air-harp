# Air Harp — Design

Date: 2026-11-20
Status: Draft, awaiting approval

## Intent

A fun toy you play in the air in front of a Mac's webcam. You draw glowing
"strings" across the screen with your hands, then pluck them with your index
finger. Each string sounds like a plucked string and visibly vibrates when
played. Its pitch depends on its length. You can build up a set of strings,
like a harp you make yourself, and wipe away the ones you don't want.

It's a personal toy, not a product. Success means it feels good to play: a
pluck sounds immediately, the strings wobble convincingly, and gestures
don't fire by accident.

## Goals

- Draw a string with a two-hand pinch, resize it live, and lock it in place
  by opening your fingers.
- Keep any number of strings on screen at once.
- Pluck a string by sweeping the index fingertip across it. Sound and visible
  vibration start at the same moment.
- Pitch comes from length. Shorter strings play higher notes, like real
  strings.
- Delete a string by holding an open palm over it.
- Runs on the user's Mac by opening a local web page in Chrome or Safari,
  with nothing to install.

## Non-goals

- Saving strings across page reloads, recording, exporting audio, MIDI.
- Mobile or touch support; multiple players.
- Instrument choice, settings panels, menus beyond a start screen.
- Support for browsers other than recent desktop Chrome and Safari.

## Anti-goals (it fails even if it "works" when…)

- There's a noticeable lag between a pluck and its sound (aim under ~50 ms on
  top of camera latency).
- Strings get plucked or deleted by accident while you're drawing, or right
  after you finish drawing one.
- The vibration looks like a jittery redraw instead of a smooth wobble.

## Constraints

- The developer works on a remote Linux machine with no camera or speakers.
  The user runs and tries everything on their Mac. Keep that loop fast:
  static files, no build step, reload to try again.
- The camera only works in a secure context. Serve the page from `localhost`,
  e.g. `python3 -m http.server`, which ships with macOS.
- Browsers won't start audio until the user clicks something, so the page
  opens with a "Click to start" screen. That click also requests camera
  access.

## Approaches considered

1. **Web page: MediaPipe Hand Landmarker (JS) + Canvas + Web Audio.**
   **Chosen.** It has the best latency and smoothest animation, and running
   it is just opening a page. A plucked-string sound can be generated in
   code, so no sound files are needed.
2. **Python: OpenCV + MediaPipe + a Python audio library.** This is the
   classic CV learning stack. Rejected because the Mac needs more setup, low
   audio latency takes more effort, and animation drawn in OpenCV is
   choppier. The user confirmed it's a toy, so learning that stack isn't a
   goal.
3. **Native macOS app (Swift + Vision).** Rejected as heavy (Xcode, much more
   code) for no real gain here.

## How it works (decided with the user)

### Screen

Full-window, mirrored (selfie-view) camera feed, dimmed so strings stand out.
Strings and hand indicators are drawn on a canvas on top.

```
+------------------------------------------------+
|  (dimmed mirrored camera)                      |
|                                                |
|     o==========================o   <- string   |
|                                                |
|         o~~~~~~~~~~~~~o       <- vibrating    |
|                                                |
|    [pinch]-- - - - - - - --[pinch] <- preview  |
+------------------------------------------------+
```

### Gestures

Hand landmarks come from MediaPipe (21 points per hand, up to 2 hands).
Thumb tip = landmark 4, index tip = landmark 8.

| Gesture | What it is | What it does |
|---|---|---|
| **Draw** | Both hands pinching (thumb tip touching index tip) | A preview line stretches between the two pinch points and follows your hands. Opening the pinch locks the string in place. |
| **Play** | Index fingertip sweeps across a string | Plucks it: sound plus vibration. Crossing several strings in one sweep plucks each one in turn. |
| **Delete** | Open palm (all five fingers spread) held over a string for ~1 s | The string turns red as a countdown, then disappears. Moving away cancels it. |

Rules that keep gestures from clashing:

- While a draw is in progress, plucking and deleting are off.
- A string created in the last ~1 s can't be deleted, so opening your hands
  to finish a draw doesn't start erasing it.
- A pinching hand doesn't pluck, and neither does an open-palm hand. Any
  other hand pose plucks with its index fingertip: a clean point, or loosely
  curled fingers. You don't need a strict pointing pose. Moving an open hand
  in to delete a string therefore won't pluck it, or its neighbours, on the
  way.

### Sound

- A plucked-string synth using the Karplus–Strong method, generated with
  Web Audio. No sample files.
- Pitch is inversely related to the string's on-screen length: shorter means
  higher. The range runs from the shortest allowed string to about the
  screen diagonal, covering roughly 3–4 octaves.
- Pluck speed sets loudness: a faster sweep plays louder.

### Vibration

- When plucked, a string draws as a standing wave across its length. Its
  amplitude decays at the same rate as the sound.
- The real audio frequency is far too fast to see, so the visible wobble is
  slowed down. Higher-pitched strings still wobble faster than lower ones.
- The string briefly glows when plucked.

## Calls I made (user to check)

- **Notes snap to a musical scale (pentatonic).** String length picks the
  nearest note in a pentatonic scale rather than any pitch at all, so any set
  of strings sounds good together. The alternative is continuous pitch:
  more "physical" but often out of tune. Easy to switch later.
- **Either hand opening finishes the draw.** You don't have to open both.
- **Strings shorter than a minimum length (~60 px) are discarded** when
  released, so accidental tiny pinches don't create strings.
- **Strings can cross each other.** No snapping or alignment.
- **Each string has its own color, based on its note.** Lower notes are
  warmer and higher notes are cooler.

- **Tuning tools are allowed. They are developer aids, not settings menus:**
  - A debug overlay toggled with the `D` key. It shows live pinch ratios,
    open-palm state, the current gesture state and FPS.
  - All tunable thresholds kept together in one `config.js` file.
  - A landmark recorder toggled with the `R` key. It downloads the hand
    landmark stream as JSON. The user can send that file back, and the
    recorded sessions get replayed through the gesture logic in
    `node --test`, so thresholds can be tuned on the Linux box.

## Left to the builder

- Exact thresholds: the pinch distance (normalized by hand size, with
  separate on/off thresholds so it doesn't flicker), the open-palm test, the
  delete radius, and the per-string pluck cooldown. Tune them so the
  anti-goals above hold.
- Smoothing of landmark positions to reduce jitter.
- File layout and code structure. Keep the pure logic (geometry, the gesture
  state machine, length-to-pitch mapping) in modules with no browser
  dependencies so it can be unit-tested with `node --test` on the Linux box.
  Camera, audio and feel get verified by the user on the Mac.
- How MediaPipe is loaded (CDN vs. vendored files) and the exact wave shape
  of the vibration.
- A short README: how to start the server and open the page.
