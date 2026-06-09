/**
 * Main orchestrator - minimal entry point that ties together all modules
 */

import { Renderer, loadShader } from './src/renderer.js';
import { SyncState } from './src/sync.js';
import audioSystem from './src/audio.js';
import { DebugUI } from './src/debug.js';
import { AgentClient, createAgentUI } from './src/agent-client.js';

// Initialize renderer
const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);
const syncState = new SyncState();
const debugUI = new DebugUI();

// Agent client (initialized later)
let agentClient = null;
let agentUI = null;

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
        audioSystem.playTurnSound(pan, isAlt);
    });

    // Update agent parameter interpolation
    if (agentClient) {
        agentClient.updateInterpolation();
    }

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

    // Connect to agent server now (after user interaction, so audio can play)
    if (agentClient) {
        agentClient.connect().catch((err) => {
            console.log('Agent server not available:', err.message);
        });
    }

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

    // Initialize agent client (connects after user clicks to start)
    agentUI = createAgentUI();
    agentClient = new AgentClient({
        wsUrl: 'ws://localhost:8765/ws',
        onParamsChange: (params) => {
            // Update debug UI sliders to show agent-driven changes
            debugUI.setValues(params);
            // Merge agent params with current debug values
            const currentValues = debugUI.getValues();
            renderer.setDebugValues({ ...currentValues, ...params });
        },
        onStatusChange: (status) => {
            agentUI.updateStatus(status);
        },
        onTranscript: (entry) => {
            agentUI.addTranscript(entry);
        }
    });

    // Keyboard shortcut for microphone
    document.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            if (agentClient.isConnected) {
                agentClient.toggleListening();
            }
        }
    });

    // Button click handler
    document.getElementById('agent-listen-btn')?.addEventListener('click', () => {
        if (agentClient.isConnected) {
            agentClient.toggleListening();
        }
    });

    // Show static frame behind overlay
    renderer.renderStatic();
}

init().catch(console.error);
