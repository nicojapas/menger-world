/**
 * Central configuration for all tunable parameters
 */

// Timing
export const SEGMENT_LENGTH = 10.0;
export const CAMERA_TIME_SCALE = 0.8;
export const LOOP_Z_SPAN = 64;
export const WAYPOINT_COUNT = 8;

// Visual turn effect
export const TURN_EFFECT_DURATION = 4.5;
export const BASE_OSCILLATION_SPEED = 0.25;
export const BASE_OSCILLATION_AMOUNT = 0.2;
export const TURN_INTENSITY_BOOST = 1.85;

// Turn detection - every segment ends with a turn
export const PRE_TURN_SEGMENTS = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
export const TURN_SOUND_TRIGGER = 0.75;
// Pan values for each turn (based on direction change)
// +X (right) = 0.5, -X (left) = -0.5, +Y/−Y (up/down) = 0, returning to +Z = slight opposite
export const TURN_PAN = {
    0: 0.5,   // → +X (right)
    1: -0.3,  // → +Z (coming from right)
    2: 0,     // → +Y (up)
    3: 0,     // → +Z (coming from up)
    4: -0.5,  // → -X (left)
    5: 0.3,   // → +Z (coming from left)
    6: 0,     // → -Y (down)
    7: 0,     // → +Z (coming from down)
};

// Camera waypoints - positions in the Menger sponge corridor
// Each waypoint is [x, y, z] - the camera smoothly interpolates between them
export const WAYPOINTS = [
    [0, 0, 0],   // Start
    [0, 0, 16],  // Forward
    [4, 0, 16],  // Turn right
    [4, 0, 32],  // Forward
    [4, 4, 32],  // Turn up
    [4, 4, 48],  // Forward
    [0, 4, 48],  // Turn left
    [0, 4, 64],  // Forward (loop)
];

// Z positions for each segment (used for camZ calculation in audio sync)
export const SEGMENT_Z_BASE = [0, 16, 16, 32, 32, 48, 48, 64];
export const SEGMENT_Z_NEXT = [16, 16, 32, 32, 48, 48, 64, 64];

// Colors
export const BASE_COLOR = [0.95, 0.95, 0.97];
export const TURN_COLOR = [0.55, 0.08, 0.05];

// Audio layer configuration
export const AUDIO_LOOPS = [
    { name: 'drone', file: 'loops/drone.mp3', baseVolume: 0.5 },
    { name: 'texture', file: 'loops/texture.mp3', baseVolume: 0.25 },
    { name: 'movement', file: 'loops/movement.mp3', baseVolume: 0.35 },
    { name: 'breathing', file: 'loops/breathing.mp3', baseVolume: 0.4 },
];

export const AUDIO_ONE_SHOTS = [
    { name: 'turn', file: 'loops/turn.mp3', baseVolume: 0.7 },
    { name: 'accent', file: 'loops/accent.mp3', baseVolume: 0.6 },
];

// Audio effects
export const MASTER_VOLUME = 0.8;
export const REVERB_DURATION = 3;
export const REVERB_DECAY = 2;
export const CROSSFADE_TIME = 0.12;
export const TURN_SOUND_COOLDOWN = 0.5;
