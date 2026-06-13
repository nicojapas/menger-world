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
        this.Conversation = null; // Store SDK reference

        // Interpolation state for smooth parameter transitions
        this.currentParams = {};
        this.targetParams = {};
        this.interpolationSpeed = 0.016; // ~3 seconds to reach target at 60fps
    }

    /**
     * Connect to ElevenLabs and start the session
     * Validates agent ID by actually connecting
     */
    async connect() {
        // Prevent multiple simultaneous attempts
        if (this.isConnecting || this.isConnected) {
            console.log('Already connecting/connected, skipping');
            return;
        }
        this.isConnecting = true;

        // Check if ElevenLabs SDK is loaded (IIFE bundle exposes window.ElevenLabsClient)
        const ElevenLabs = window.ElevenLabsClient || window.ElevenLabs || window.elevenlabs;
        this.Conversation = ElevenLabs?.Conversation || window.Conversation;

        if (!this.Conversation) {
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

        // Actually start the session to validate the agent ID
        try {
            console.log('Starting ElevenLabs session with agent:', this.agentId);
            this.conversation = await this.Conversation.startSession({
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
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.onStatusChange({ connected: true });
                },

                onDisconnect: (details) => {
                    console.log('Disconnected from ElevenLabs');
                    if (details) {
                        console.log('Disconnect details:', JSON.stringify(details, null, 2));
                    }
                    this.isConnected = false;
                    this.onStatusChange({ connected: false });
                },

                onError: (error) => {
                    console.error('ElevenLabs error:', error);
                    if (error.code) console.error('Error code:', error.code);
                    if (error.reason) console.error('Error reason:', error.reason);
                    this.isConnecting = false;
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
        } catch (sessionError) {
            this.isConnecting = false;
            console.error('Failed to start ElevenLabs session:', sessionError);
            this.onStatusChange({ error: sessionError.message || 'Connection failed' });
            throw sessionError;
        }
    }

    /**
     * Start is now a no-op since connection happens in connect()
     */
    start() {
        // Session already started in connect()
        console.log('ElevenLabs session already active');
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
