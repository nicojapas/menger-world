/**
 * Main orchestrator - minimal entry point that ties together all modules
 * Supports two backends: LangGraph (custom agent) or ElevenLabs (native voice AI)
 */

import { Renderer, loadShader } from './src/renderer.js';
import { SyncState } from './src/sync.js';
import audioSystem from './src/audio.js';
import { AgentClient, createAgentUI } from './src/agent-client.js';
import { ElevenLabsClient, createElevenLabsUI } from './src/elevenlabs-client.js';
import { AGENT_WS_URL, SERVER_URL } from './config.js';

// Initialize renderer
const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);
const syncState = new SyncState();

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

// Get backend configuration from server
async function getBackendConfig() {
    try {
        const response = await fetch(`${SERVER_URL}/config`);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.log('Could not fetch config, using default LangGraph backend');
    }
    return { backend: 'langgraph' };
}

// Initialize
async function init() {
    // Load fragment shader (vertex shader is inlined in renderer)
    const fragmentSource = await loadShader('./src/shaders/fragment.glsl');

    // Initialize renderer
    renderer.init(fragmentSource);
    renderer.resize();

    // Get backend configuration
    const config = await getBackendConfig();
    const useElevenLabs = config.backend === 'elevenlabs';

    console.log(`Using ${config.backend} backend`);

    // Initialize appropriate agent client based on backend
    if (useElevenLabs) {
        agentUI = createElevenLabsUI();
        agentClient = new ElevenLabsClient({
            serverUrl: SERVER_URL,
            onParamsChange: (params) => {
                renderer.setVisualParams(params);
            },
            onStatusChange: (status) => {
                agentUI.updateStatus(status);
            },
            onTranscript: (entry) => {
                agentUI.addTranscript(entry);
            }
        });
    } else {
        agentUI = createAgentUI();
        agentClient = new AgentClient({
            wsUrl: AGENT_WS_URL,
            onParamsChange: (params) => {
                renderer.setVisualParams(params);
            },
            onStatusChange: (status) => {
                agentUI.updateStatus(status);
            },
            onTranscript: (entry) => {
                agentUI.addTranscript(entry);
            }
        });
    }

    // Keyboard shortcut for microphone (only for LangGraph backend)
    if (!useElevenLabs) {
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
    }

    // Show static frame behind overlay
    renderer.renderStatic();
}

init().catch(console.error);
