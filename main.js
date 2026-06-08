/**
 * Main orchestrator - minimal entry point that ties together all modules
 */

import { Renderer, loadShader } from './src/renderer.js';
import { SyncState } from './src/sync.js';
import audioSystem from './src/audio.js';
import { DebugUI } from './src/debug.js';

// Initialize renderer
const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);
const syncState = new SyncState();
const debugUI = new DebugUI();

// State
let experienceStarted = false;
let audioStarted = false;
let timeOffset = 0;

// Handle window resize
function onResize() {
    renderer.resize();
    if (!experienceStarted) {
        renderer.renderStatic();
    }
}
window.addEventListener('resize', onResize);

// Animation loop
function render(time) {
    const t = (time - timeOffset) * 0.001;

    // Update sync state and get visual/audio parameters
    const { turnIntensity, isAlternate, audioParams } = syncState.update(t, (pan, isAlt) => {
        // Only play turn sounds if enabled
        if (debugUI.getValues().turnSoundsEnabled > 0.5) {
            audioSystem.playTurnSound(pan, isAlt);
        }
    });

    // Render frame
    renderer.render(t, turnIntensity, isAlternate);

    // Update audio
    if (audioStarted) {
        audioSystem.update(audioParams);
    }

    requestAnimationFrame(render);
}

// Start experience on user interaction
const startOverlay = document.getElementById('start-overlay');
startOverlay?.addEventListener('click', async () => {
    if (experienceStarted) return;

    await audioSystem.start();
    audioStarted = true;
    experienceStarted = true;
    startOverlay.style.display = 'none';

    // Start animation from t=0
    requestAnimationFrame((firstFrameTime) => {
        timeOffset = firstFrameTime;
        requestAnimationFrame(render);
    });
});

// Initialize
async function init() {
    // Load fragment shader (vertex shader is inlined in renderer)
    const fragmentSource = await loadShader('./src/shaders/fragment.glsl');

    // Initialize renderer
    renderer.init(fragmentSource);
    renderer.resize();

    // Initialize debug UI
    debugUI.init();
    debugUI.onChange = (values) => {
        renderer.setDebugValues(values);
    };

    // Show static frame behind overlay
    renderer.renderStatic();
}

init().catch(console.error);
