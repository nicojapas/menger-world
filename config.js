/**
 * Configuration for the cool-room application.
 * Auto-detects server URLs based on current host.
 */

function getServerUrl() {
    const protocol = window.location.protocol;
    const host = window.location.host;

    // For local development with separate servers
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return 'http://localhost:8765';
    }

    // For production: same host
    return `${protocol}//${host}`;
}

function getWebSocketUrl() {
    // Use secure WebSocket (wss) if page is served over HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    // For local development with separate servers
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return 'ws://localhost:8765/ws';
    }

    // For production: same host
    return `${protocol}//${host}/ws`;
}

export const SERVER_URL = getServerUrl();
export const AGENT_WS_URL = getWebSocketUrl();
