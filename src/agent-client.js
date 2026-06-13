/**
 * Agent client for communicating with the LangGraph visual agent.
 * Handles WebSocket connection, speech recognition, and audio playback.
 */

export class AgentClient {
    constructor(options = {}) {
        this.wsUrl = options.wsUrl || 'ws://localhost:8765/ws';
        this.groqApiKey = options.groqApiKey;
        this.onParamsChange = options.onParamsChange || (() => {});
        this.onStatusChange = options.onStatusChange || (() => {});
        this.onTranscript = options.onTranscript || (() => {});

        this.ws = null;
        this.recognition = null;
        this.isListening = false;
        this.isConnected = false;
        this.audioQueue = [];
        this.isPlaying = false;

        // Interpolation state for smooth parameter transitions
        this.currentParams = {};
        this.targetParams = {};
        this.interpolationSpeed = 0.016; // ~3 seconds to reach target at 60fps
    }

    /**
     * Connect to the agent server
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('Connected to agent server');

                // Send init message with API key (BYOK)
                if (this.groqApiKey) {
                    this.ws.send(JSON.stringify({
                        type: 'init',
                        groqApiKey: this.groqApiKey
                    }));
                }

                this.isConnected = true;
                this.onStatusChange({ connected: true });
                resolve();
            };

            this.ws.onclose = () => {
                console.log('Disconnected from agent server');
                this.isConnected = false;
                this.onStatusChange({ connected: false });
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
        });
    }

    /**
     * Disconnect from the server
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.stopListening();
    }

    /**
     * Start the experience (triggers greeting from server)
     */
    start() {
        if (!this.isConnected || !this.ws) {
            console.warn('Not connected to agent server');
            return;
        }
        this.ws.send(JSON.stringify({ type: 'start' }));
    }

    /**
     * Handle incoming messages from the server
     */
    handleMessage(message) {
        switch (message.type) {
            case 'params':
                this.handleParamsUpdate(message.data);
                break;

            case 'speak':
                this.handleSpeak(message);
                break;

            case 'error':
                console.error('Server error:', message.message);
                this.onStatusChange({ connected: false, error: message.message });
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
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
     * Handle speech from the agent
     */
    handleSpeak(message) {
        console.log('Agent says:', message.text);
        console.log('Audio received:', message.audio ? `${message.audio.length} chars` : 'none');
        this.onTranscript({ speaker: 'agent', text: message.text });

        if (message.audio) {
            this.queueAudio(message.audio);
        } else {
            // Fallback to browser's built-in speech synthesis
            this.speakWithBrowserTTS(message.text);
        }
    }

    /**
     * Use browser's built-in text-to-speech as fallback
     */
    speakWithBrowserTTS(text) {
        if (!('speechSynthesis' in window)) {
            console.warn('Browser TTS not supported');
            return;
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to find a good English voice
        const voices = speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
            || voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        // Track speaking state to prevent echo
        utterance.onstart = () => {
            this.isPlaying = true;
            this.onStatusChange({ speaking: true });
        };
        utterance.onend = () => {
            this.isPlaying = false;
            this.onStatusChange({ speaking: false });
        };
        utterance.onerror = () => {
            this.isPlaying = false;
            this.onStatusChange({ speaking: false });
        };

        speechSynthesis.speak(utterance);
    }

    /**
     * Queue audio for playback
     */
    queueAudio(base64Audio) {
        this.audioQueue.push(base64Audio);
        this.playNextAudio();
    }

    /**
     * Play the next audio in the queue
     */
    async playNextAudio() {
        if (this.isPlaying || this.audioQueue.length === 0) {
            return;
        }

        this.isPlaying = true;
        this.onStatusChange({ speaking: true });
        const base64Audio = this.audioQueue.shift();

        try {
            console.log('Playing audio, base64 length:', base64Audio.length);

            // Decode base64 to audio
            const audioData = atob(base64Audio);
            const audioArray = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
            }

            console.log('Decoded audio bytes:', audioArray.length);

            // Detect audio type from magic bytes
            // WAV starts with "RIFF", MP3 starts with 0xFF 0xFB or ID3
            let mimeType = 'audio/mpeg';
            if (audioArray[0] === 0x52 && audioArray[1] === 0x49 && audioArray[2] === 0x46 && audioArray[3] === 0x46) {
                mimeType = 'audio/wav';
            }
            console.log('Audio format:', mimeType);

            const audioBlob = new Blob([audioArray], { type: mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);

            audio.onended = () => {
                console.log('Audio playback finished');
                URL.revokeObjectURL(audioUrl);
                this.isPlaying = false;
                this.onStatusChange({ speaking: false });
                this.playNextAudio();
            };

            audio.onerror = (e) => {
                console.error('Audio playback error:', e, audio.error);
                this.isPlaying = false;
                this.onStatusChange({ speaking: false });
                this.playNextAudio();
            };

            console.log('Calling audio.play()...');
            await audio.play();
            console.log('Audio playing');
        } catch (error) {
            console.error('Error playing audio:', error);
            this.isPlaying = false;
            this.onStatusChange({ speaking: false });
            this.playNextAudio();
        }
    }

    /**
     * Send user input to the agent
     */
    sendUserInput(text) {
        if (!this.isConnected || !this.ws) {
            console.warn('Not connected to agent server');
            return;
        }

        this.onTranscript({ speaker: 'user', text });

        this.ws.send(JSON.stringify({
            type: 'user_input',
            text: text
        }));
    }

    /**
     * Start listening for speech input
     */
    startListening() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return false;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.onStatusChange({ listening: true });
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.onStatusChange({ listening: false });

            // Auto-restart if still supposed to be listening
            if (this.shouldListen) {
                setTimeout(() => this.recognition.start(), 100);
            }
        };

        this.recognition.onresult = (event) => {
            // Ignore input while AI is speaking (prevents echo)
            if (this.isPlaying) {
                return;
            }

            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript;
            const isFinal = event.results[last].isFinal;

            if (isFinal) {
                this.sendUserInput(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
                this.isListening = false;
                this.onStatusChange({ listening: false, error: event.error });
            }
        };

        this.shouldListen = true;
        this.recognition.start();
        return true;
    }

    /**
     * Stop listening for speech input
     */
    stopListening() {
        this.shouldListen = false;
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
        this.isListening = false;
        this.onStatusChange({ listening: false });
    }

    /**
     * Toggle listening state
     */
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
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
 * Create the agent UI overlay
 */
export function createAgentUI() {
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
        <div class="badge">Powered by LangGraph + Groq</div>
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
