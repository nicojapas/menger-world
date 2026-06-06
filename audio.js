/**
 * Procedural audio system using ElevenLabs-generated loops
 * Layers multiple short loops and applies real-time effects based on visual parameters
 */

// Continuous ambient layers
const LOOPS = [
    { name: 'drone', file: 'loops/drone.mp3', baseVolume: 0.5 },
    { name: 'texture', file: 'loops/texture.mp3', baseVolume: 0.25 },
    { name: 'movement', file: 'loops/movement.mp3', baseVolume: 0.35 },
];

// One-shot sounds (not looped continuously)
const ONE_SHOTS = [
    { name: 'turn', file: 'loops/turn.mp3', baseVolume: 0.7 },
];

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.layers = new Map();
        this.oneShots = new Map();
        this.convolver = null;
        this.lowpass = null;
        this.highpass = null;
        this.initialized = false;
        this.started = false;
        this.turnSoundCooldown = 0;
    }

    async init() {
        if (this.initialized) return;

        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Master chain: layers -> highpass -> lowpass -> convolver -> master gain -> destination
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.ctx.destination);

        // Convolver for reverb (we'll generate an impulse response)
        this.convolver = this.ctx.createConvolver();
        this.convolver.buffer = this.createReverbImpulse(3, 2, false);

        // Dry/wet mix for reverb
        this.dryGain = this.ctx.createGain();
        this.wetGain = this.ctx.createGain();
        this.dryGain.gain.value = 0.7;
        this.wetGain.gain.value = 0.3;

        this.dryGain.connect(this.masterGain);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.masterGain);

        // Filters for depth-based sound shaping
        this.lowpass = this.ctx.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = 20000;
        this.lowpass.Q.value = 0.5;

        this.highpass = this.ctx.createBiquadFilter();
        this.highpass.type = 'highpass';
        this.highpass.frequency.value = 20;
        this.highpass.Q.value = 0.5;

        // Chain filters
        this.highpass.connect(this.lowpass);
        this.lowpass.connect(this.dryGain);
        this.lowpass.connect(this.convolver);

        // Load all loops
        await this.loadLoops();

        this.initialized = true;
    }

    createReverbImpulse(duration, decay, reverse) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        const leftChannel = impulse.getChannelData(0);
        const rightChannel = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = reverse ? length - i : i;
            const envelope = Math.pow(1 - n / length, decay);
            leftChannel[i] = (Math.random() * 2 - 1) * envelope;
            rightChannel[i] = (Math.random() * 2 - 1) * envelope;
        }

        return impulse;
    }

    async loadLoops() {
        // Load continuous loops
        const loadPromises = LOOPS.map(async (loop) => {
            try {
                const response = await fetch(loop.file);
                if (!response.ok) {
                    console.warn(`Loop not found: ${loop.file} - will use placeholder`);
                    return { ...loop, buffer: null };
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                return { ...loop, buffer: audioBuffer };
            } catch (err) {
                console.warn(`Failed to load ${loop.file}:`, err.message);
                return { ...loop, buffer: null };
            }
        });

        const loadedLoops = await Promise.all(loadPromises);

        for (const loop of loadedLoops) {
            // Create gain node for this layer
            const gainNode = this.ctx.createGain();
            gainNode.gain.value = 0; // Start silent, fade in on start
            gainNode.connect(this.highpass);

            // Create stereo panner for spatial variation
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = 0;
            panner.connect(gainNode);

            this.layers.set(loop.name, {
                config: loop,
                buffer: loop.buffer,
                gain: gainNode,
                panner: panner,
                source: null,
            });
        }

        // Load one-shot sounds
        const oneShotPromises = ONE_SHOTS.map(async (sound) => {
            try {
                const response = await fetch(sound.file);
                if (!response.ok) {
                    console.warn(`One-shot not found: ${sound.file}`);
                    return { ...sound, buffer: null };
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                return { ...sound, buffer: audioBuffer };
            } catch (err) {
                console.warn(`Failed to load ${sound.file}:`, err.message);
                return { ...sound, buffer: null };
            }
        });

        const loadedOneShots = await Promise.all(oneShotPromises);

        for (const sound of loadedOneShots) {
            this.oneShots.set(sound.name, {
                config: sound,
                buffer: sound.buffer,
            });
        }
    }

    async start() {
        if (!this.initialized) {
            await this.init();
        }

        // Resume context if suspended (browser autoplay policy)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (this.started) return;

        // Start all loops
        for (const [name, layer] of this.layers) {
            if (!layer.buffer) {
                console.warn(`Skipping ${name} - no buffer loaded`);
                continue;
            }

            const source = this.ctx.createBufferSource();
            source.buffer = layer.buffer;
            source.loop = true;
            source.connect(layer.panner);

            // Randomize start position for variation
            const startOffset = Math.random() * layer.buffer.duration;
            source.start(0, startOffset);

            layer.source = source;

            // Fade in
            layer.gain.gain.setTargetAtTime(
                layer.config.baseVolume,
                this.ctx.currentTime,
                0.5
            );
        }

        this.started = true;
    }

    stop() {
        if (!this.started) return;

        for (const [name, layer] of this.layers) {
            if (layer.source) {
                // Fade out then stop
                layer.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
                const source = layer.source;
                setTimeout(() => {
                    try { source.stop(); } catch (e) {}
                }, 500);
                layer.source = null;
            }
        }

        this.started = false;
    }

    /**
     * Update audio parameters based on visual state
     * @param {Object} params
     * @param {number} params.time - Current animation time
     * @param {number} params.depth - Camera depth in corridor (0-1, affects filter)
     * @param {number} params.speed - Camera movement speed (affects layer mix)
     * @param {number} params.twist - Current corridor twist amount
     */
    update(params) {
        if (!this.started || !this.ctx) return;

        const { time = 0, depth = 0.5, speed = 1, twist = 0 } = params;

        // Lowpass filter based on depth - deeper = more muffled
        const lpFreq = 2000 + (1 - depth) * 18000;
        this.lowpass.frequency.setTargetAtTime(lpFreq, this.ctx.currentTime, 0.1);

        // Reverb wet/dry based on depth - deeper = more reverb
        const wetAmount = 0.2 + depth * 0.5;
        this.wetGain.gain.setTargetAtTime(wetAmount, this.ctx.currentTime, 0.1);
        this.dryGain.gain.setTargetAtTime(1 - wetAmount * 0.5, this.ctx.currentTime, 0.1);

        // Layer volumes based on parameters
        const droneLayer = this.layers.get('drone');
        const textureLayer = this.layers.get('texture');
        const movementLayer = this.layers.get('movement');

        if (droneLayer?.source) {
            // Drone is constant but modulated by depth
            const droneVol = droneLayer.config.baseVolume * (0.7 + depth * 0.5);
            droneLayer.gain.gain.setTargetAtTime(droneVol, this.ctx.currentTime, 0.3);
        }

        if (textureLayer?.source) {
            // Texture swells with time - more dramatic variation
            const swell = 0.3 + 0.7 * Math.sin(time * 0.08);
            const textureVol = textureLayer.config.baseVolume * swell;
            textureLayer.gain.gain.setTargetAtTime(textureVol, this.ctx.currentTime, 0.4);
            // Pan texture slowly
            textureLayer.panner.pan.setTargetAtTime(
                Math.sin(time * 0.05) * 0.6,
                this.ctx.currentTime,
                0.2
            );
        }

        if (movementLayer?.source) {
            // Movement layer responds to depth - louder in narrow passages
            const movementVol = movementLayer.config.baseVolume * (0.5 + depth * 0.8);
            movementLayer.gain.gain.setTargetAtTime(movementVol, this.ctx.currentTime, 0.2);
            // Pan based on depth phase
            movementLayer.panner.pan.setTargetAtTime(
                Math.sin(depth * Math.PI * 2) * 0.4,
                this.ctx.currentTime,
                0.15
            );
        }

        // Update cooldown
        if (this.turnSoundCooldown > 0) {
            this.turnSoundCooldown -= 0.016; // Approximate frame time
        }
    }

    /**
     * Play the turn/accent sound as a one-shot with variation
     * @param {number} pan - Stereo pan position (-1 to 1)
     */
    playTurnSound(pan = 0) {
        if (!this.started || !this.ctx) return;
        if (this.turnSoundCooldown > 0) return; // Prevent rapid re-triggering

        const turn = this.oneShots.get('turn');
        if (!turn?.buffer) {
            console.warn('Turn sound not loaded');
            return;
        }

        // Create a new source for each play (one-shots are disposable)
        const source = this.ctx.createBufferSource();
        source.buffer = turn.buffer;

        // Add variation: randomize playback rate (pitch) between 0.85 and 1.15
        source.playbackRate.value = 0.85 + Math.random() * 0.3;

        // Create gain and panner for this instance
        const gain = this.ctx.createGain();

        // Add variation: randomize volume between 0.85 and 1.0 of base
        const volumeVariation = 0.85 + Math.random() * 0.15;
        const targetVolume = turn.config.baseVolume * volumeVariation;

        const panner = this.ctx.createStereoPanner();
        // Add slight random pan variation to the directional pan
        const panVariation = (Math.random() - 0.5) * 0.2;
        panner.pan.value = Math.max(-1, Math.min(1, pan + panVariation));

        // Connect: source -> panner -> gain -> master effects chain
        source.connect(panner);
        panner.connect(gain);
        gain.connect(this.highpass);

        // Play with slight attack/release envelope
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(targetVolume, this.ctx.currentTime + 0.05);

        // Random start offset (0 to 0.3 seconds into the sound)
        const startOffset = Math.random() * 0.3;
        source.start(0, startOffset);

        // Set cooldown to prevent rapid re-triggering (in seconds)
        this.turnSoundCooldown = 2.0;
    }

    // Set master volume (0-1)
    setVolume(vol) {
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(
                Math.max(0, Math.min(1, vol)),
                this.ctx.currentTime,
                0.1
            );
        }
    }

    // Get current audio context time
    getTime() {
        return this.ctx?.currentTime || 0;
    }
}

// Singleton instance
const audioSystem = new AudioSystem();

export default audioSystem;
export { AudioSystem };
