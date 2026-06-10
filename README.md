# Menger World

[![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-000000?style=for-the-badge&logo=elevenlabs&logoColor=white)](https://elevenlabs.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

![Menger World Demo](menger-hal-demo.gif)

An immersive WebGL fractal corridor controlled by a HAL 9000-inspired AI agent. Navigate through an infinite raymarched Menger sponge while an AI adjusts the visuals in real-time based on voice interaction.

## Features

- **Raymarched Fractal Geometry** — Real-time Menger sponge with breathing animations and dynamic lighting
- **Procedural Audio** — Layered soundscapes with procedurally generated spatial audio, synchronized to camera movement
- **AI Visual Control** — LangGraph agent manipulates shader parameters via WebSocket
- **Voice Synthesis** — ElevenLabs or local Piper TTS with HAL 9000 persona
- **Zero Dependencies Frontend** — Pure WebGL/GLSL, no frameworks

## Quick Start

### Frontend Only

```bash
npx serve .
```

### With AI Agent

```bash
# Install Python dependencies
cd agent && pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add your GROQ_API_KEY (required)
# Optionally add ELEVENLABS_API_KEY for cloud TTS

# Run the server
python server.py
```

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│                 │◄──────────────────►│                  │
│  WebGL Client   │                    │  FastAPI Server  │
│  (Browser)      │   Visual Params    │                  │
│                 │◄───────────────────│  LangGraph Agent │
│  Web Audio API  │                    │  Voice Synthesis │
│                 │   Audio Stream     │                  │
└─────────────────┘◄───────────────────└──────────────────┘
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Rendering | WebGL 1.0, GLSL ES, Raymarching |
| Audio | Web Audio API, Convolution Reverb |
| Agent | LangGraph, Groq (Llama 3) |
| Voice | ElevenLabs / Piper TTS |
| Server | FastAPI, WebSockets, Uvicorn |
| Deploy | Docker |

## Audio Generation

The project uses ElevenLabs Sound Effects API to generate ambient audio loops that are layered and processed in real-time.

### Generating Sounds

```bash
cp .env.example .env  # Add ELEVENLABS_API_KEY
npm run generate-audio
```

### Sound Layers

| Sound | Duration | Description |
|-------|----------|-------------|
| `drone` | 10s | Deep space ambient drone, low frequency resonant hum |
| `texture` | 8s | Ethereal crystalline shimmer, high frequency sparkle |
| `movement` | 10s | Whooshing wind through metallic corridors |
| `breathing` | 12s | Slow alien respiration synced to wall animation |
| `turn` | 3s | Metallic scraping one-shot triggered on direction changes |
| `accent` | 6s | Distant metallic resonance, pitch-shifted variant |

### Real-Time Processing

The Web Audio API applies effects based on camera position:

- **Convolution reverb** — Wet/dry mix increases with corridor depth
- **Lowpass filter** — Deeper positions sound more muffled
- **Stereo panning** — Layers drift spatially with time and depth
- **Crossfade looping** — Seamless transitions eliminate audio clicks
- **Breathing sync** — Volume modulation matches shader wall animation

## Docker

```bash
docker build -t cool-room .
docker run -p 8765:8765 cool-room
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for LLM inference |
| `ELEVENLABS_API_KEY` | No | ElevenLabs API key for cloud TTS |
| `USE_ELEVENLABS` | No | Set to `true` to prefer ElevenLabs over local TTS |

## License

MIT
