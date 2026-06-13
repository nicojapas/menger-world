/**
 * Main orchestrator - minimal entry point that ties together all modules
 * Supports two backends: LangGraph (custom agent) or ElevenLabs (native voice AI)
 * Uses BYOK (Bring Your Own Key) - users provide their own API keys
 */

import { Renderer, loadShader } from './src/renderer.js';
import { SyncState } from './src/sync.js';
import audioSystem from './src/audio.js';
import { AgentClient, createAgentUI } from './src/agent-client.js';
import { ElevenLabsClient, createElevenLabsUI } from './src/elevenlabs-client.js';
import { AGENT_WS_URL, SERVER_URL } from './config.js';

// LocalStorage keys (only non-sensitive data)
const STORAGE_KEYS = {
    BACKEND: 'menger-world-backend',
    AGENT_ID: 'menger-world-agent-id',
    SERVER_URL: 'menger-world-server-url'
};

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
let selectedBackend = null;

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

// Start experience
const startOverlay = document.getElementById('start-overlay');

async function startExperience() {
    if (experienceStarted) return;

    await audioSystem.start();
    audioStarted = true;
    experienceStarted = true;
    startOverlay.style.display = 'none';

    // Tell the agent to start (sends greeting)
    if (agentClient) {
        agentClient.start();
    }

    // For LangGraph, auto-start listening
    if (selectedBackend === 'langgraph' && agentClient) {
        agentClient.startListening();
    }

    // Start animation - render first frame at t=0 to avoid visual jump
    requestAnimationFrame((firstFrameTime) => {
        timeOffset = firstFrameTime;
        // Render first frame immediately at t=0 (matches renderStatic)
        const { turnIntensity, isAlternate } = syncState.update(0, () => {});
        renderer.render(0, turnIntensity, isAlternate);
        // Then continue with normal animation loop
        requestAnimationFrame(render);
    });
}


/**
 * Update the start overlay state (connecting or error)
 */
function setOverlayState(state, errorMessage = '') {
    const connectingState = document.getElementById('connecting-state');
    const errorStateEl = document.getElementById('error-state');
    const errorMessageEl = document.getElementById('error-message');

    connectingState.style.display = state === 'connecting' ? 'block' : 'none';
    errorStateEl.style.display = state === 'error' ? 'block' : 'none';

    if (errorMessage) {
        errorMessageEl.textContent = errorMessage;
    }
}

/**
 * Show setup screen and wait for user configuration
 * Returns: { backend: 'elevenlabs'|'langgraph', agentId?, groqApiKey?, serverUrl? }
 */
function showSetupScreen() {
    return new Promise((resolve) => {
        const setupOverlay = document.getElementById('setup-overlay');
        const startBtn = document.getElementById('setup-start-btn');
        const errorDiv = document.getElementById('setup-error');

        // Backend buttons
        const justFlyBtn = document.getElementById('backend-justfly');
        const elevenLabsBtn = document.getElementById('backend-elevenlabs');
        const langGraphBtn = document.getElementById('backend-langgraph');

        // Config sections
        const elevenLabsConfig = document.getElementById('elevenlabs-config');
        const langGraphConfig = document.getElementById('langgraph-config');

        // Input fields
        const agentIdInput = document.getElementById('elevenlabs-agent-id');
        const apiKeyInput = document.getElementById('langgraph-api-key');
        const serverUrlInput = document.getElementById('langgraph-server-url');

        // Current selection
        let selectedBackend = localStorage.getItem(STORAGE_KEYS.BACKEND) || 'elevenlabs';

        // Pre-fill from localStorage (non-sensitive only)
        agentIdInput.value = localStorage.getItem(STORAGE_KEYS.AGENT_ID) || '';
        serverUrlInput.value = localStorage.getItem(STORAGE_KEYS.SERVER_URL) || 'http://localhost:8765';

        // Update UI based on selection
        function updateSelection(backend) {
            selectedBackend = backend;

            // Update button styles
            justFlyBtn.style.borderColor = backend === 'justfly' ? '#0f0' : '#333';
            justFlyBtn.style.color = backend === 'justfly' ? '#fff' : '#888';
            elevenLabsBtn.style.borderColor = backend === 'elevenlabs' ? '#0f0' : '#333';
            elevenLabsBtn.style.color = backend === 'elevenlabs' ? '#fff' : '#888';
            langGraphBtn.style.borderColor = backend === 'langgraph' ? '#0f0' : '#333';
            langGraphBtn.style.color = backend === 'langgraph' ? '#fff' : '#888';

            // Show/hide config sections
            elevenLabsConfig.style.display = backend === 'elevenlabs' ? 'block' : 'none';
            langGraphConfig.style.display = backend === 'langgraph' ? 'block' : 'none';

            // Clear error
            errorDiv.style.display = 'none';
        }

        // Initialize UI
        updateSelection(selectedBackend);

        // Backend selection handlers
        justFlyBtn.addEventListener('click', () => updateSelection('justfly'));
        elevenLabsBtn.addEventListener('click', () => updateSelection('elevenlabs'));
        langGraphBtn.addEventListener('click', () => updateSelection('langgraph'));

        // Start button handler
        startBtn.addEventListener('click', () => {
            let config = { backend: selectedBackend };

            if (selectedBackend === 'elevenlabs') {
                const agentId = agentIdInput.value.trim();
                if (!agentId) {
                    errorDiv.textContent = 'Please enter your ElevenLabs Agent ID';
                    errorDiv.style.display = 'block';
                    return;
                }
                config.agentId = agentId;
                localStorage.setItem(STORAGE_KEYS.AGENT_ID, agentId);
            } else if (selectedBackend === 'langgraph') {
                const apiKey = apiKeyInput.value.trim();
                const serverUrl = serverUrlInput.value.trim() || 'http://localhost:8765';
                if (!apiKey) {
                    errorDiv.textContent = 'Please enter your Groq API Key';
                    errorDiv.style.display = 'block';
                    return;
                }
                config.groqApiKey = apiKey;
                config.serverUrl = serverUrl;
                localStorage.setItem(STORAGE_KEYS.SERVER_URL, serverUrl);
                // Note: API key is NOT stored in localStorage for security
            }
            // justfly mode requires no validation

            // Save backend choice
            localStorage.setItem(STORAGE_KEYS.BACKEND, selectedBackend);

            // Hide setup
            setupOverlay.style.display = 'none';

            // Show start overlay only for agent modes (need to wait for connection)
            if (selectedBackend !== 'justfly') {
                document.getElementById('start-overlay').style.display = 'flex';
            }

            resolve(config);
        });

        // Handle Enter key in inputs
        [agentIdInput, apiKeyInput, serverUrlInput].forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    startBtn.click();
                }
            });
        });
    });
}

// Initialize
async function init() {
    // Load fragment shader (vertex shader is inlined in renderer)
    const fragmentSource = await loadShader('./src/shaders/fragment.glsl');

    // Initialize renderer
    renderer.init(fragmentSource);
    renderer.resize();

    // Show static frame while setup screen is visible
    renderer.renderStatic();

    // Wait for user to configure via setup screen
    const config = await showSetupScreen();
    selectedBackend = config.backend;

    console.log(`Using ${config.backend} backend`);

    // Initialize appropriate agent client based on backend
    if (config.backend === 'justfly') {
        // Just Fly mode - no agent, just visuals and sounds
        // Start immediately (user already clicked START)
        await startExperience();
    } else if (config.backend === 'elevenlabs') {
        agentUI = createElevenLabsUI();
        agentClient = new ElevenLabsClient({
            agentId: config.agentId,
            onParamsChange: (params) => {
                renderer.setVisualParams(params);
            },
            onStatusChange: (status) => {
                agentUI.updateStatus(status);
                // Start experience when connected, show error if disconnected before start
                if (status.connected) {
                    startExperience();
                } else if (status.connected === false && !experienceStarted) {
                    setOverlayState('error', status.error || 'Disconnected');
                }
            },
            onTranscript: (entry) => {
                agentUI.addTranscript(entry);
            }
        });

        // Connect to agent
        try {
            await agentClient.connect();
        } catch (err) {
            console.error('Agent connection failed:', err);
            setOverlayState('error', err.message || 'Connection failed');
        }
    } else {
        // LangGraph backend
        const wsUrl = config.serverUrl.replace(/^http/, 'ws') + '/ws';
        agentUI = createAgentUI();
        agentClient = new AgentClient({
            wsUrl: wsUrl,
            groqApiKey: config.groqApiKey,
            onParamsChange: (params) => {
                renderer.setVisualParams(params);
            },
            onStatusChange: (status) => {
                agentUI.updateStatus(status);
                // Start experience when connected, show error if disconnected before start
                if (status.connected) {
                    startExperience();
                } else if (status.connected === false && !experienceStarted) {
                    setOverlayState('error', status.error || 'Disconnected');
                }
            },
            onTranscript: (entry) => {
                agentUI.addTranscript(entry);
            }
        });

        // Connect to agent
        try {
            await agentClient.connect();
        } catch (err) {
            console.error('Agent connection failed:', err);
            setOverlayState('error', err.message || 'Connection failed');
        }
    }
}

init().catch(console.error);
