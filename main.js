/**
 * Main orchestrator - minimal entry point that ties together all modules
 */

import { Renderer, loadShader } from './src/renderer.js';
import { SyncState } from './src/sync.js';
import { getSegmentInfo } from './src/camera.js';
import audioSystem from './src/audio.js';

// Initialize renderer
const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);
const syncState = new SyncState();
const debugEl = document.getElementById('debug');

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
    const { turnIntensity, audioParams } = syncState.update(t, (pan) => {
        audioSystem.playTurnSound(pan);
    });

    // Render frame
    renderer.render(t, turnIntensity);

    // Update audio
    if (audioStarted) {
        audioSystem.update(audioParams);
    }

    // Debug display
    const { segment, depth } = getSegmentInfo(t);
    // Direction the camera is moving during this segment
    const directions = ['+Z', '+X', '+Z', '+Y', '+Z', '-X', '+Z', '-Y'];
    // Next direction (what we turn TO)
    const nextDir = ['+X', '+Z', '+Y', '+Z', '-X', '+Z', '-Y', '+Z'];
    debugEl.innerHTML = `
        Segment: ${segment} / 7<br>
        Depth: ${(depth * 100).toFixed(0)}%<br>
        Direction: ${directions[segment]} → ${nextDir[segment]}<br>
        <span style="color: #ff8">Sound at 75%</span>${depth >= 0.75 ? ' <span style="color: #f44">NOW!</span>' : ''}
    `;

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
    debugEl.style.display = 'block';

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

    // Show static frame behind overlay
    renderer.renderStatic();
}

init().catch(console.error);
