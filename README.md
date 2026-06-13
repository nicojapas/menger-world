# Menger World

[![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-000000?style=for-the-badge&logo=elevenlabs&logoColor=white)](https://elevenlabs.io/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

![Menger World Demo](menger-hal-demo.gif)

An immersive WebGL fractal corridor controlled by a HAL 9000-inspired AI agent. Navigate through an infinite raymarched Menger sponge while an AI adjusts the visuals in real-time based on voice interaction.

## Live Demo

**[Try it live →](https://nicojapas.github.io/menger-world/)**

The app supports two agent modes:

| Mode | Requirements | Description |
|------|--------------|-------------|
| **ElevenLabs** | Agent ID only | Uses ElevenLabs Conversational AI directly from the browser — no server needed |
| **LangGraph** | Local server + Groq API key | Custom agent with Groq LLM — requires running the backend locally |

## Features

- **Raymarched Fractal Geometry** — Real-time Menger sponge with breathing animations and dynamic lighting
- **Procedural Audio** — Layered soundscapes with spatial audio, synchronized to camera movement
- **AI Visual Control** — Agent manipulates shader parameters based on conversation mood
- **Voice Interaction** — Full voice-to-voice conversation with the AI
- **Zero Dependencies Frontend** — Pure WebGL/GLSL, no frameworks

---

## ElevenLabs Mode

Uses [ElevenLabs Conversational AI](https://elevenlabs.io/conversational-ai) for end-to-end voice conversation with ultra-low latency. No local server required — connects directly from the browser.

### Setup

1. **Create an ElevenLabs Agent** at [elevenlabs.io/app/conversational-ai](https://elevenlabs.io/app/conversational-ai)
   - Set **Authorization** to **Public**
   - Add a **Client Tool** named `updateVisuals` with parameters: `rounding`, `domainWarp`, `breathingSpeed`, `layer2Density`, `layer3Density`, `baseColorR`, `baseColorG`, `baseColorB`
   - Configure your system prompt and voice

2. **Enter your Agent ID** in the app when prompted

### Architecture (ElevenLabs)

```
┌─────────────────┐
│                 │
│  WebGL Client   │
│  (Browser)      │
│                 │
│  @elevenlabs/   │   Direct WebSocket
│  client SDK     │◄────────────────────►  ElevenLabs Cloud
│                 │   (Voice + AI + TTS)
└─────────────────┘
```

---

## LangGraph Mode

Custom agent using LangGraph for orchestration, Groq for LLM inference, and Piper TTS for voice synthesis. Requires running the local backend server.

### Setup

```bash
cd agent && pip install -r requirements.txt
python server.py
```

Then open the app and select **LangGraph** mode. Enter your **Groq API key** when prompted.

### Architecture (LangGraph)

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│                 │◄──────────────────►│                  │
│  WebGL Client   │                    │  FastAPI Server  │
│  (Browser)      │   Visual Params    │                  │
│                 │◄───────────────────│  LangGraph Agent │
│  Web Speech API │                    │  Piper TTS       │
│                 │   Audio Stream     │                  │
└─────────────────┘◄───────────────────└──────────────────┘
```

---

## Frontend Only

To run just the visualization without AI:

```bash
npx serve .
```

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Rendering | WebGL 1.0, GLSL ES, Raymarching |
| Audio | Web Audio API, Convolution Reverb |
| Agent (ElevenLabs) | ElevenLabs Conversational AI |
| Agent (LangGraph) | LangGraph, Groq (Llama 3.1), Piper TTS |
| Server | FastAPI, WebSockets, Uvicorn |

## Environment Variables (Server)

These are only needed when running the LangGraph backend server locally:

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | No | Can also be provided via the app's BYOK flow |
| `USE_ELEVENLABS` | No | Set to `true` for ElevenLabs TTS instead of Piper |
| `ELEVENLABS_API_KEY` | No | Required if `USE_ELEVENLABS=true` |

## Audio Generation

The project uses ElevenLabs Sound Effects API to generate ambient audio loops.

```bash
cp .env.example .env  # Add ELEVENLABS_API_KEY
npm run generate-audio
```

## License

MIT
