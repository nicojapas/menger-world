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
     * Waits for server to validate the API key before resolving
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this._connectResolve = resolve;
            this._connectReject = reject;
            this._connectionValidated = false;

            this.ws.onopen = () => {
                console.log('WebSocket opened, sending init and start...');

                // Send init message with API key (BYOK)
                if (this.groqApiKey) {
                    this.ws.send(JSON.stringify({
                        type: 'init',
                        groqApiKey: this.groqApiKey
                    }));
                }

                // Also send start to trigger server response for validation
                this.ws.send(JSON.stringify({ type: 'start' }));
            };

            this.ws.onclose = () => {
                console.log('Disconnected from agent server');
                this.isConnected = false;
                this.onStatusChange({ connected: false });

                // Reject if connection not yet validated
                if (!this._connectionValidated && this._connectReject) {
                    this._connectReject(new Error('Connection closed before validation'));
                    this._connectReject = null;
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                if (this._connectReject) {
                    this._connectReject(error);
                    this._connectReject = null;
                }
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);

                // Check for validation - first successful message means API key is valid
                if (!this._connectionValidated) {
                    if (message.type === 'error') {
                        // Server rejected (likely invalid API key)
                        console.error('Server error during validation:', message.message);
                        if (this._connectReject) {
                            this._connectReject(new Error(message.message || 'Server rejected connection'));
                            this._connectReject = null;
                        }
                        return;
                    } else if (message.type === 'params' || message.type === 'speak' || message.type === 'ready') {
                        // First successful response - connection is validated
                        this._connectionValidated = true;
                        this.isConnected = true;
                        this.onStatusChange({ connected: true });
                        if (this._connectResolve) {
                            this._connectResolve();
                            this._connectResolve = null;
                        }
                    }
                }

                this.handleMessage(message);
            };

            // Timeout for validation
            setTimeout(() => {
                if (!this._connectionValidated && this._connectReject) {
                    this._connectReject(new Error('Connection validation timeout'));
                    this._connectReject = null;
                    this.ws?.close();
                }
            }, 10000);
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
     * Start the experience - already triggered during connect()
     */
    start() {
        // Start message already sent during connect() for validation
        console.log('LangGraph session already started during connect');
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
