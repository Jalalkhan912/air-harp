// Every tunable threshold for Air Harp lives here and nowhere else.
export const CONFIG = {
  PINCH_ON: 0.25, PINCH_OFF: 0.40,          // thumb-index distance / hand size (wrist→middle MCP)
  OPEN_FINGER_RATIO: 1.15,                   // tip-to-wrist > PIP-to-wrist * ratio  => finger extended
  OPEN_THUMB_RATIO: 0.5,                     // thumb tip → index MCP / hand size > ratio => thumb out
  SMOOTHING: 0.5,                            // EMA weight of the new sample
  RELEASE_MS: 100,                           // pinch must be open/lost this long to finish a draw
  MIN_STRING_LENGTH: 60,
  POST_DRAW_MUTE_MS: 300,                    // no plucks right after a draw ends
  PLUCK_COOLDOWN_MS: 80,                     // per string
  PLUCK_SPEED_MAX: 2.0,                      // px/ms that maps to velocity 1
  MAX_JUMP_PX: 250,                          // fingertip moves farther than this in one frame => no pluck
  DELETE_RADIUS: 40, DELETE_HOLD_MS: 1000, DELETE_GRACE_MS: 1000,
  LOW_HZ: 98.0, HIGH_HZ: 1046.5,             // G2 .. C6
  SNAP_TO_SCALE: true, SCALE: [0, 2, 4, 7, 9], SCALE_ROOT_MIDI: 60,
  DECAY_S: 1.2,                              // shared sound/vibration time constant
  SOUND_DURATION_S: 3.0,
  VIB_AMPLITUDE_PX: 14, VIB_HZ_MIN: 5, VIB_HZ_MAX: 16,
  GLOW_MS: 250,
};
