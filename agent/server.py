"""
WebSocket server for the LangGraph visual agent.
Handles real-time communication between the browser and the agent.
Uses BYOK (Bring Your Own Key) - clients provide their own Groq API keys.
"""

import os
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

from graph import VisualAgent
from voice import VoiceSynthesizer
from voice_local import LocalVoiceSynthesizer
from parameters import to_frontend_params, VisualParameters

# Load environment variables from project root
ROOT_DIR = Path(__file__).parent.parent
env_path = ROOT_DIR / ".env"
load_dotenv(env_path)

# Input validation
MAX_INPUT_LENGTH = 500


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

    async def initialize_agent(self, websocket: WebSocket, groq_api_key: str) -> bool:
        """Initialize agent with per-session API key (BYOK). Does not send greeting yet.

        Returns True if successful, False if API key is invalid.
        """
        # Store API key for this session (never logged or persisted)
        self.api_keys[websocket] = groq_api_key

        # Create a new agent for this connection with the provided API key
        # This will validate the API key by creating the LLM client
        try:
            agent = VisualAgent(groq_api_key=groq_api_key)
            # Test the API key with a simple call
            agent.validate_api_key()
            self.agents[websocket] = agent
            print("Agent created and API key validated successfully")
            return True
        except Exception as e:
            print(f"Failed to create agent: {e}")
            # Clean up
            if websocket in self.api_keys:
                del self.api_keys[websocket]
            return False

    async def start_experience(self, websocket: WebSocket):
        """Start the experience - send greeting and initial params."""
        agent = self.agents.get(websocket)
        if not agent:
            print("Warning: No agent found for start_experience")
            return

        # Send initial greeting
        greeting, params = agent.get_initial_greeting()
        await self.send_message(websocket, {
            "type": "params",
            "data": to_frontend_params(VisualParameters(**params))
        })

        # Synthesize and send greeting audio
        if self.voice:
            try:
                print(f"Synthesizing greeting: {greeting[:50]}...")
                audio_b64 = self.voice.synthesize_base64(greeting)
                print(f"Audio synthesized, length: {len(audio_b64)}")
                await self.send_message(websocket, {
                    "type": "speak",
                    "text": greeting,
                    "audio": audio_b64
                })
            except Exception as e:
                print(f"Voice synthesis failed: {e}")
                await self.send_message(websocket, {
                    "type": "speak",
                    "text": greeting,
                    "audio": None
                })
        else:
            print("No voice synthesizer available, using browser TTS")
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
            print("Warning: No agent found for this websocket")
            return

        # Get agent response
        print(f"Processing user input: {text[:100]}...")
        response_text, params = agent.process_user_input(text)
        print(f"Agent response: {response_text[:100] if response_text else 'None'}...")

        # Send parameter updates if any
        if params:
            print(f"Sending params: {params}")
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
            except Exception as e:
                print(f"Voice synthesis failed: {e}")
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
    # This server is only used for LangGraph backend
    # ElevenLabs connects directly from browser (BYOK)

    # Initialize voice synthesizer for TTS
    # Priority: 1. Local Piper TTS (HAL-9000), 2. ElevenLabs TTS (if configured)
    use_elevenlabs_tts = os.getenv("USE_ELEVENLABS", "false").lower() == "true"

    if use_elevenlabs_tts and os.getenv("ELEVENLABS_API_KEY"):
        try:
            manager.voice = VoiceSynthesizer()
            print("Voice: Using ElevenLabs TTS")
        except Exception as e:
            print(f"ElevenLabs TTS failed: {e}")
            manager.voice = None

    if not manager.voice:
        try:
            manager.voice = LocalVoiceSynthesizer()
            print("Voice: Using local Piper TTS (HAL-9000)")
        except Exception as e:
            print(f"Local Piper TTS failed: {e}")
            print("Voice: Falling back to browser TTS")

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
        "voice_enabled": manager.voice is not None
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
                    print(f"Initializing agent with BYOK key (length: {len(groq_api_key)})")
                    success = await manager.initialize_agent(websocket, groq_api_key)
                    if not success:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid API key or connection failed"
                        })
                else:
                    print("Warning: init received without API key")

            elif data.get("type") == "start":
                # User clicked to enter - send greeting
                await manager.start_experience(websocket)

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
