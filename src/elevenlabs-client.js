/**
 * ElevenLabs Conversational AI client.
 * Connects directly to ElevenLabs for voice-to-voice conversation.
 * Uses clientTools to control visual parameters.
 */

export class ElevenLabsClient {
    constructor(options = {}) {
        this.agentId = options.agentId;
        this.onParamsChange = options.onParamsChange || (() => {});
        this.onStatusChange = options.onStatusChange || (() => {});
        this.onTranscript = options.onTranscript || (() => {});

        this.conversation = null;
        this.isConnected = false;
        this.isConnecting = false;

        // Interpolation state for smooth parameter transitions
        this.currentParams = {};
        this.targetParams = {};
        this.interpolationSpeed = 0.016; // ~3 seconds to reach target at 60fps
    }

    /**
     * Initialize and connect to ElevenLabs
     */
    async connect() {
        // Prevent multiple simultaneous connection attempts
        if (this.isConnecting || this.isConnected) {
            console.log('Already connecting or connected, skipping');
            return;
        }
        this.isConnecting = true;

        // Check if ElevenLabs SDK is loaded (IIFE bundle exposes window.ElevenLabsClient)
        const ElevenLabs = window.ElevenLabsClient || window.ElevenLabs || window.elevenlabs;
        const Conversation = ElevenLabs?.Conversation || window.Conversation;

        if (!Conversation) {
            this.isConnecting = false;
            console.error('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('eleven') || k === 'Conversation'));
            throw new Error('ElevenLabs SDK not loaded. Include @elevenlabs/client script.');
        }

        if (!this.agentId) {
            this.isConnecting = false;
            throw new Error('No agent ID provided');
        }

        // Request microphone permission before connecting
        try {
            console.log('Requesting microphone permission...');
            await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone permission granted');
        } catch (micError) {
            this.isConnecting = false;
            console.error('Microphone permission denied:', micError);
            this.onStatusChange({ error: 'Microphone permission required' });
            throw new Error('Microphone permission denied');
        }

        // Connect directly with agent ID (BYOK - user provides their own agent ID)
        try {
            console.log('Starting ElevenLabs session with agent:', this.agentId);
            this.conversation = await Conversation.startSession({
                agentId: this.agentId,

                // Handle visual parameter updates via client tool
                clientTools: {
                    updateVisuals: async (parameters) => {
                        console.log('updateVisuals called:', parameters);
                        this.handleParamsUpdate(parameters);
                        return "Visual parameters updated";
                    }
                },

                onConnect: () => {
                    console.log('Connected to ElevenLabs');
                    this.isConnecting = false;
                    this.isConnected = true;
                    this.onStatusChange({ connected: true });
                },

                onDisconnect: (details) => {
                    console.log('Disconnected from ElevenLabs');
                    if (details) {
                        console.log('Disconnect details:', JSON.stringify(details, null, 2));
                    }
                    this.isConnecting = false;
                    this.isConnected = false;
                    this.onStatusChange({ connected: false });
                },

                onError: (error) => {
                    console.error('ElevenLabs error:', error);
                    if (error.code) console.error('Error code:', error.code);
                    if (error.reason) console.error('Error reason:', error.reason);
                    this.onStatusChange({ error: error.message || String(error) });
                },

                onMessage: (message) => {
                    // Handle transcription messages
                    if (message.source === 'user') {
                        this.onTranscript({ speaker: 'user', text: message.message });
                    } else if (message.source === 'ai') {
                        this.onTranscript({ speaker: 'agent', text: message.message });
                    }
                },

                onStatusChange: (status) => {
                    console.log('ElevenLabs status:', status);
                    this.onStatusChange({
                        listening: status.mode === 'listening',
                        speaking: status.mode === 'speaking'
                    });
                }
            });

            console.log('ElevenLabs session started successfully');
            return this.conversation;
        } catch (sessionError) {
            this.isConnecting = false;
            console.error('Failed to start ElevenLabs session:', sessionError);
            this.onStatusChange({ error: sessionError.message || 'Connection failed' });
            throw sessionError;
        }
    }

    /**
     * Disconnect from ElevenLabs
     */
    disconnect() {
        if (this.conversation) {
            this.conversation.endSession();
            this.conversation = null;
        }
        this.isConnected = false;
        this.onStatusChange({ connected: false });
    }

    /**
     * Start the experience - ElevenLabs auto-starts on connect, so this is a no-op
     */
    start() {
        // ElevenLabs automatically starts the conversation when connected
        // The agent will speak its greeting when ready
    }

    /**
     * Handle parameter updates - set as targets for interpolation
     */
    handleParamsUpdate(params) {
        console.log('Parameter update:', params);

        // Set target params for interpolation
        Object.assign(this.targetParams, params);

        // Initialize current params if not set
        for (const key in params) {
            if (!(key in this.currentParams)) {
                this.currentParams[key] = params[key];
            }
        }
    }

    /**
     * Send text input (for typing instead of voice)
     */
    sendUserInput(text) {
        if (!this.isConnected || !this.conversation) {
            console.warn('Not connected to ElevenLabs');
            return;
        }

        this.onTranscript({ speaker: 'user', text });
        // ElevenLabs handles voice input directly, but we can inject text
        // This is mainly for testing/debugging
        console.log('Text input not directly supported in voice mode');
    }

    /**
     * Start/stop listening - ElevenLabs handles this automatically
     * These are here for API compatibility with the LangGraph client
     */
    startListening() {
        // ElevenLabs listens automatically when connected
        console.log('ElevenLabs listens automatically');
        return true;
    }

    stopListening() {
        // ElevenLabs manages its own listening state
        console.log('ElevenLabs manages listening state');
    }

    toggleListening() {
        // For compatibility - no-op since ElevenLabs auto-listens
    }

    /**
     * Update interpolated parameters - call this each frame
     * Returns the current interpolated values
     */
    updateInterpolation() {
        let hasChanges = false;

        for (const key in this.targetParams) {
            const target = this.targetParams[key];
            const current = this.currentParams[key] ?? target;

            if (Math.abs(target - current) > 0.001) {
                this.currentParams[key] = current + (target - current) * this.interpolationSpeed;
                hasChanges = true;
            } else {
                this.currentParams[key] = target;
            }
        }

        if (hasChanges) {
            this.onParamsChange(this.currentParams);
        }

        return this.currentParams;
    }

    /**
     * Set interpolation speed (0.01 = slow, 0.1 = fast)
     */
    setInterpolationSpeed(speed) {
        this.interpolationSpeed = Math.max(0.01, Math.min(1, speed));
    }
}


/**
 * Create the agent UI overlay for ElevenLabs
 */
export function createElevenLabsUI() {
    const ui = document.createElement('div');
    ui.id = 'agent-ui';
    ui.innerHTML = `
        <style>
            #agent-ui {
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.85);
                color: #fff;
                font-family: monospace;
                font-size: 12px;
                padding: 15px;
                border-radius: 8px;
                z-index: 1000;
                width: 300px;
                display: none;
            }
            #agent-ui.visible {
                display: block;
            }
            #agent-ui .status {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }
            #agent-ui .status-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #666;
            }
            #agent-ui .status-dot.connected {
                background: #0f0;
            }
            #agent-ui .status-dot.listening {
                background: #f00;
                animation: pulse 1s infinite;
            }
            #agent-ui .status-dot.speaking {
                background: #00f;
                animation: pulse 0.5s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            #agent-ui .transcript {
                max-height: 150px;
                overflow-y: auto;
                margin-bottom: 10px;
                padding: 8px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            #agent-ui .transcript-entry {
                margin-bottom: 8px;
            }
            #agent-ui .transcript-entry.user {
                color: #8cf;
            }
            #agent-ui .transcript-entry.agent {
                color: #8f8;
            }
            #agent-ui .badge {
                background: #333;
                border: 1px solid #555;
                color: #888;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                text-align: center;
            }
            #agent-ui .hint {
                color: #666;
                font-size: 10px;
                margin-top: 8px;
                text-align: center;
            }
        </style>
        <div class="status">
            <div class="status-dot" id="agent-status-dot"></div>
            <span id="agent-status-text">Disconnected</span>
        </div>
        <div class="transcript" id="agent-transcript"></div>
        <div class="badge">Powered by ElevenLabs</div>
        <div class="hint">Voice is always active when connected</div>
    `;

    document.body.appendChild(ui);

    // Track connection state
    let isConnected = false;

    return {
        updateStatus: (status) => {
            const panel = document.getElementById('agent-ui');
            const dot = document.getElementById('agent-status-dot');
            const text = document.getElementById('agent-status-text');

            // Update tracked connection state if provided
            if (status.connected !== undefined) {
                isConnected = status.connected;
            }

            // Show panel when connected
            if (isConnected) {
                panel.classList.add('visible');
            }

            dot.classList.remove('connected', 'listening', 'speaking');

            if (status.speaking) {
                dot.classList.add('speaking');
                text.textContent = 'Agent speaking...';
            } else if (status.listening) {
                dot.classList.add('listening');
                text.textContent = 'Listening...';
            } else if (isConnected) {
                dot.classList.add('connected');
                text.textContent = 'Connected';
            } else {
                text.textContent = 'Disconnected';
            }
        },

        addTranscript: (entry) => {
            const transcript = document.getElementById('agent-transcript');
            const div = document.createElement('div');
            div.className = `transcript-entry ${entry.speaker}`;
            div.textContent = `${entry.speaker === 'user' ? 'You' : 'Agent'}: ${entry.text}`;
            transcript.appendChild(div);
            transcript.scrollTop = transcript.scrollHeight;
        }
    };
}
