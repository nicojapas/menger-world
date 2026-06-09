/**
 * Audio-visual synchronization logic
 * Manages turn detection, visual effects, and audio parameter updates
 */

import {
    TURN_EFFECT_DURATION,
    BASE_OSCILLATION_SPEED,
    BASE_OSCILLATION_AMOUNT,
    TURN_INTENSITY_BOOST,
    PRE_TURN_SEGMENTS,
    TURN_SOUND_TRIGGER,
    TURN_PAN,
} from './constants.js';
import { getSegmentInfo, getCameraZ } from './camera.js';

/**
 * SyncState - tracks state for audio-visual synchronization
 */
export class SyncState {
    constructor() {
        this.lastSegment = -1;
        this.turnSoundTriggered = false;
        this.turnEffectStartTime = -12;
        this.turnCount = 0;
    }

    /**
     * Update sync state based on current time
     * @param {number} time - Animation time in seconds
     * @param {function} onTurnSound - Callback when turn sound should play (receives pan, isAlternate)
     * @returns {{ turnIntensity: number, audioParams: object }}
     */
    update(time, onTurnSound) {
        const { segment, depth, camTime } = getSegmentInfo(time);

        // Detect segment change
        if (segment !== this.lastSegment) {
            this.lastSegment = segment;
            this.turnSoundTriggered = false;
        }

        // Trigger turn sound when approaching end of pre-turn segment
        if (
            PRE_TURN_SEGMENTS.has(segment) &&
            depth >= TURN_SOUND_TRIGGER &&
            !this.turnSoundTriggered
        ) {
            const pan = TURN_PAN[segment] || 0;
            const isAlternate = this.turnCount % 2 === 1;
            onTurnSound(pan, isAlternate);
            this.turnSoundTriggered = true;
            this.turnEffectStartTime = time;
            this.turnCount++;
        }

        // Calculate turn intensity for visual effect
        const turnIntensity = this.calculateTurnIntensity(time);

        // Is this an alternate turn (for accent sound visual)?
        const isAlternate = this.turnCount % 2 === 0 && turnIntensity > 0;

        // Calculate camera Z position for audio sync
        const camZ = getCameraZ(segment, depth);

        // Audio parameters
        const audioParams = {
            time,
            depth,
            speed: 1.0,
            twist: 0,
            camZ,
        };

        return { turnIntensity, isAlternate, audioParams };
    }

    /**
     * Calculate the current turn intensity (0-1)
     * Combines base oscillation with turn boost
     * @param {number} time
     * @returns {number}
     */
    calculateTurnIntensity(time) {
        // Base: slow constant oscillation from white to subtle red
        const baseOscillation =
            Math.sin(time * BASE_OSCILLATION_SPEED) * BASE_OSCILLATION_AMOUNT;

        // Turn boost: additional intensity during turns (synced to sound)
        let turnBoost = 0;
        const timeSinceTurnStart = time - this.turnEffectStartTime;

        if (timeSinceTurnStart >= 0 && timeSinceTurnStart < TURN_EFFECT_DURATION) {
            // Smooth curve: fast attack, slower decay
            const progress = timeSinceTurnStart / TURN_EFFECT_DURATION;
            turnBoost = (1 - Math.pow(progress, 0.5)) * TURN_INTENSITY_BOOST;
        }

        // Combine: base oscillation + turn boost (clamped to 1)
        return Math.min(1, baseOscillation + turnBoost);
    }

    /**
     * Reset state (useful for restart)
     */
    reset() {
        this.lastSegment = -1;
        this.turnSoundTriggered = false;
        this.turnEffectStartTime = -12;
    }
}
