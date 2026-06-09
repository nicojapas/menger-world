/**
 * Camera path and waypoint calculations
 * Handles navigation through the fractal corridor
 */

import {
    SEGMENT_LENGTH,
    WAYPOINT_COUNT,
    LOOP_Z_SPAN,
    SEGMENT_Z_BASE,
    SEGMENT_Z_NEXT,
    CAMERA_TIME_SCALE,
} from './constants.js';

/**
 * Get the current segment and depth within that segment
 * @param {number} time - Animation time in seconds
 * @returns {{ segment: number, depth: number, camTime: number }}
 */
export function getSegmentInfo(time) {
    const camTime = time * CAMERA_TIME_SCALE;
    const segment = Math.floor(camTime / SEGMENT_LENGTH) % WAYPOINT_COUNT;
    const depth = (camTime % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    return { segment, depth, camTime };
}

/**
 * Calculate camera Z position for audio sync
 * @param {number} segment - Current segment index (0-7)
 * @param {number} depth - Progress through segment (0-1)
 * @returns {number} Camera Z position
 */
export function getCameraZ(segment, depth) {
    const loopOffset = Math.floor(segment / WAYPOINT_COUNT) * LOOP_Z_SPAN;
    const segInLoop = segment % WAYPOINT_COUNT;
    const zBase = SEGMENT_Z_BASE[segInLoop];
    const zNext = SEGMENT_Z_NEXT[segInLoop];
    return loopOffset + zBase + (zNext - zBase) * depth;
}

