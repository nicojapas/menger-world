"""
WebSocket server for the visual agent.
Handles real-time communication between the browser and the agent.

Supports two backends:
- LangGraph (default): Custom agent with Groq LLM
- ElevenLabs: Native Conversational AI (set AGENT_BACKEND=elevenlabs)
"""

import os
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv

from graph import VisualAgent
from voice import VoiceSynthesizer
from voice_local import LocalVoiceSynthesizer
from parameters import to_frontend_params, VisualParameters

# ElevenLabs imports (optional)
try:
    from elevenlabs_config import get_agent_id, INITIAL_PARAMS
    ELEVENLABS_AVAILABLE = True
except ImportError:
    ELEVENLABS_AVAILABLE = False

# Load environment variables from project root
ROOT_DIR = Path(__file__).parent.parent
env_path = ROOT_DIR / ".env"
load_dotenv(env_path)

# Input validation
MAX_INPUT_LENGTH = 500

# Backend selection
AGENT_BACKEND = os.getenv("AGENT_BACKEND", "langgraph")  # "langgraph" or "elevenlabs"

# ElevenLabs agent ID (initialized in lifespan)
elevenlabs_agent_id = None


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.agents: dict[WebSocket, VisualAgent] = {}
        self.api_keys: dict[WebSocket, str] = {}  # Per-session API keys (BYOK)
        self.voice: Optional[VoiceSynthesizer] = None

    async def connect(self, websocket: WebSocket):
        """Accept WebSocket connection. Agent is initialized after receiving API key."""
        await websocket.accept()
        self.active_connections.append(websocket)

    async def initialize_agent(self, websocket: WebSocket, groq_api_key: str):
        """Initialize agent with per-session API key (BYOK)."""
        # Store API key for this session (never logged or persisted)
        self.api_keys[websocket] = groq_api_key

        # Create a new agent for this connection with the provided API key
        agent = VisualAgent(groq_api_key=groq_api_key)
        self.agents[websocket] = agent

        # Send initial greeting
        greeting, params = agent.get_initial_greeting()
        await self.send_message(websocket, {
            "type": "params",
            "data": to_frontend_params(VisualParameters(**params))
        })

        # Synthesize and send greeting audio
        if self.voice:
            try:
                audio_b64 = self.voice.synthesize_base64(greeting)
                await self.send_message(websocket, {
                    "type": "speak",
                    "text": greeting,
                    "audio": audio_b64
                })
            except Exception:
                await self.send_message(websocket, {
                    "type": "speak",
                    "text": greeting,
                    "audio": None
                })
        else:
            await self.send_message(websocket, {
                "type": "speak",
                "text": greeting,
                "audio": None
            })

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        if websocket in self.agents:
            del self.agents[websocket]
        if websocket in self.api_keys:
            del self.api_keys[websocket]  # Clear API key on disconnect

    async def send_message(self, websocket: WebSocket, message: dict):
        await websocket.send_json(message)

    async def process_user_input(self, websocket: WebSocket, text: str):
        """Process user speech input and respond."""
        agent = self.agents.get(websocket)
        if not agent:
            return

        # Get agent response
        response_text, params = agent.process_user_input(text)

        # Send parameter updates if any
        if params:
            await self.send_message(websocket, {
                "type": "params",
                "data": to_frontend_params(VisualParameters(**params))
            })

        # Synthesize and send speech
        if self.voice and response_text:
            try:
                audio_b64 = self.voice.synthesize_base64(response_text)
                await self.send_message(websocket, {
                    "type": "speak",
                    "text": response_text,
                    "audio": audio_b64
                })
            except Exception:
                await self.send_message(websocket, {
                    "type": "speak",
                    "text": response_text,
                    "audio": None
                })
        elif response_text:
            await self.send_message(websocket, {
                "type": "speak",
                "text": response_text,
                "audio": None
            })


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    global elevenlabs_agent_id

    # Initialize ElevenLabs if using that backend
    if AGENT_BACKEND == "elevenlabs" and ELEVENLABS_AVAILABLE:
        try:
            elevenlabs_agent_id = get_agent_id()
            print(f"ElevenLabs backend initialized with agent: {elevenlabs_agent_id}")
        except Exception as e:
            print(f"Failed to initialize ElevenLabs: {e}")
            elevenlabs_agent_id = None

    # For LangGraph backend, initialize voice synthesizer
    if AGENT_BACKEND == "langgraph":
        # Priority: 1. Local Piper TTS (HAL-9000), 2. ElevenLabs TTS (if configured)
        use_elevenlabs = os.getenv("USE_ELEVENLABS", "false").lower() == "true"

        if use_elevenlabs and os.getenv("ELEVENLABS_API_KEY"):
            try:
                manager.voice = VoiceSynthesizer()
            except Exception:
                manager.voice = None

        if not manager.voice:
            try:
                manager.voice = LocalVoiceSynthesizer()
            except Exception:
                pass  # Will use browser TTS fallback

    yield


app = FastAPI(title="Visual Agent Server", lifespan=lifespan)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Static files directory
STATIC_DIR = ROOT_DIR / "static"


@app.get("/")
async def root():
    """Serve the main index.html"""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"status": "ok", "message": "Visual Agent Server"}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "backend": AGENT_BACKEND,
        "voice_enabled": manager.voice is not None,
        "elevenlabs_ready": elevenlabs_agent_id is not None
    }


@app.get("/config")
async def get_config():
    """Get client configuration including backend type."""
    return {
        "backend": AGENT_BACKEND,
        "agentId": elevenlabs_agent_id if AGENT_BACKEND == "elevenlabs" else None,
        "initialParams": INITIAL_PARAMS if AGENT_BACKEND == "elevenlabs" else None
    }




@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "init":
                # BYOK: Initialize agent with per-session API key
                groq_api_key = data.get("groqApiKey", "")
                if groq_api_key:
                    await manager.initialize_agent(websocket, groq_api_key)

            elif data.get("type") == "user_input":
                text = data.get("text", "")
                if text:
                    # Input validation
                    text = text[:MAX_INPUT_LENGTH]
                    await manager.process_user_input(websocket, text)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# Mount static files LAST so it acts as fallback for JS, CSS, etc.
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8765))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV") != "production"
    )
