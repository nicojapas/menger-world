/**
 * Shared agent UI component.
 * Creates the status panel overlay for agent connections.
 */

/**
 * Create the agent UI overlay
 * @param {string} provider - Provider name for the badge (e.g., "ElevenLabs", "LangGraph + Groq")
 */
export function createAgentUI(provider = 'Agent') {
    const ui = document.createElement('div');
    ui.id = 'agent-ui';
    ui.innerHTML = `
        <div class="status">
            <div class="status-dot" id="agent-status-dot"></div>
            <span id="agent-status-text">Disconnected</span>
        </div>
        <div class="transcript" id="agent-transcript"></div>
        <div class="badge">Powered by ${provider}</div>
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
