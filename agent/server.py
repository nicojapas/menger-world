"""
WebSocket server for the visual agent.
Handles real-time communication between the browser and the LangGraph agent.
"""

import os
import json
import asyncio
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
print(f"Loading .env from: {env_path}")
print(f".env exists: {env_path.exists()}")
load_dotenv(env_path)


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.agents: dict[WebSocket, VisualAgent] = {}
        self.voice: Optional[VoiceSynthesizer] = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

        # Create a new agent for this connection
        agent = VisualAgent()
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
                print(f"Synthesizing greeting: {greeting}")
                audio_b64 = self.voice.synthesize_base64(greeting)
                print(f"Audio synthesized: {len(audio_b64)} chars")
                await self.send_message(websocket, {
                    "type": "speak",
                    "text": greeting,
                    "audio": audio_b64
                })
            except Exception as e:
                print(f"Voice synthesis error: {e}")
                import traceback
                traceback.print_exc()
                await self.send_message(websocket, {
                    "type": "speak",
                    "text": greeting,
                    "audio": None
                })
        else:
            print("Voice not available, sending text only")
            await self.send_message(websocket, {
                "type": "speak",
                "text": greeting,
                "audio": None
            })

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        if websocket in self.agents:
            del self.agents[websocket]

    async def send_message(self, websocket: WebSocket, message: dict):
        await websocket.send_json(message)

    async def process_user_input(self, websocket: WebSocket, text: str):
        """Process user speech input and respond."""
        agent = self.agents.get(websocket)
        if not agent:
            return

        # Get agent response
        response_text, params = agent.process_user_input(text)
        print(f"[AGENT] Speech: {response_text}")
        print(f"[AGENT] Params: {params}")

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
            except Exception as e:
                print(f"Voice synthesis error: {e}")
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
    print("=== Server starting ===")

    # Try to initialize voice synthesizer
    # Priority: 1. Local Piper TTS (HAL-9000), 2. ElevenLabs (if configured)
    use_elevenlabs = os.getenv("USE_ELEVENLABS", "false").lower() == "true"

    if use_elevenlabs and os.getenv("ELEVENLABS_API_KEY"):
        print("Attempting ElevenLabs voice synthesis...")
        try:
            manager.voice = VoiceSynthesizer()
            print("ElevenLabs voice synthesis enabled")
        except Exception as e:
            print(f"ElevenLabs failed: {e}")
            manager.voice = None

    if not manager.voice:
        print("Attempting local Piper TTS (HAL-9000)...")
        try:
            manager.voice = LocalVoiceSynthesizer()
            print("Local Piper TTS enabled (HAL-9000 voice)")
        except Exception as e:
            print(f"Local TTS failed: {e}")
            import traceback
            traceback.print_exc()
            print("Voice synthesis disabled - will use browser TTS fallback")

    print(f"Voice synthesizer initialized: {manager.voice is not None}")
    print("=== Server ready ===")

    yield

    # Cleanup
    print("Shutting down...")


app = FastAPI(title="Visual Agent Server", lifespan=lifespan)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Serve static frontend files
STATIC_DIR = ROOT_DIR / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


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

            if data.get("type") == "user_input":
                text = data.get("text", "")
                if text:
                    await manager.process_user_input(websocket, text)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8765))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV") != "production"
    )
