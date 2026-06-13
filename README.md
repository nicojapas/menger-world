# Menger World

[![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-000000?style=for-the-badge&logo=elevenlabs&logoColor=white)](https://elevenlabs.io/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

![Menger World Demo](menger-hal-demo.gif)

An immersive WebGL fractal corridor controlled by a HAL 9000-inspired AI agent. Navigate through an infinite raymarched Menger sponge while an AI adjusts the visuals in real-time based on voice interaction.

## Features

- **Raymarched Fractal Geometry** — Real-time Menger sponge with breathing animations and dynamic lighting
- **Procedural Audio** — Layered soundscapes with spatial audio, synchronized to camera movement
- **AI Visual Control** — Agent manipulates shader parameters based on conversation mood
- **Voice Interaction** — Full voice-to-voice conversation with the AI
- **Zero Dependencies Frontend** — Pure WebGL/GLSL, no frameworks

## Two Backends

This project supports two agent backends:

| Backend | Description | Branch |
|---------|-------------|--------|
| **ElevenLabs** | Native Conversational AI with real-time voice-to-voice | `elevenlabs-native` |
| **LangGraph** | Custom agent with Groq LLM + separate TTS | `main` |

---

## ElevenLabs Backend (Recommended)

Uses [ElevenLabs Conversational AI](https://elevenlabs.io/conversational-ai) for end-to-end voice conversation with ultra-low latency.

### Setup

1. **Create an ElevenLabs Agent** at [elevenlabs.io/app/conversational-ai](https://elevenlabs.io/app/conversational-ai)
   - Set **Authorization** to **Public**
   - Add a **Client Tool** named `updateVisuals` with parameters: `rounding`, `domainWarp`, `breathingSpeed`, `layer2Density`, `layer3Density`, `baseColorR`, `baseColorG`, `baseColorB`
   - Configure your system prompt and voice

2. **Configure environment**
   ```bash
   cd agent && pip install -r requirements.txt
   cp .env.example .env
   ```

   Add to `.env`:
   ```
   AGENT_BACKEND=elevenlabs
   ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxx
   ```

3. **Run**
   ```bash
   python server.py
   ```

### Architecture (ElevenLabs)

```
┌─────────────────┐                      ┌──────────────────┐
│                 │   Config/AgentID     │                  │
│  WebGL Client   │◄────────────────────►│  FastAPI Server  │
│  (Browser)      │                      │                  │
│                 │                      └──────────────────┘
│  @elevenlabs/   │   Direct WebSocket
│  client SDK     │◄────────────────────►  ElevenLabs Cloud
│                 │   (Voice + AI + TTS)
└─────────────────┘
```

---

## LangGraph Backend

Custom agent using LangGraph for orchestration, Groq for LLM inference, and Piper TTS for voice synthesis. Gives you full control over the agent logic.

### Setup

```bash
cd agent && pip install -r requirements.txt
cp .env.example .env
```

Add to `.env`:
```
AGENT_BACKEND=langgraph
GROQ_API_KEY=your_groq_api_key
```

### Run

```bash
python server.py
```

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
| Deploy | Docker |

## Environment Variables

| Variable | Backend | Required | Description |
|----------|---------|----------|-------------|
| `AGENT_BACKEND` | Both | No | `elevenlabs` or `langgraph` (default) |
| `ELEVENLABS_AGENT_ID` | ElevenLabs | Yes | Agent ID from ElevenLabs dashboard |
| `GROQ_API_KEY` | LangGraph | Yes | Groq API key for LLM inference |
| `USE_ELEVENLABS` | LangGraph | No | Set to `true` for ElevenLabs TTS instead of Piper |
| `ELEVENLABS_API_KEY` | LangGraph | No | Required if `USE_ELEVENLABS=true` |

## Docker

```bash
docker build -t menger-world .
docker run -p 8765:8765 -e AGENT_BACKEND=elevenlabs -e ELEVENLABS_AGENT_ID=xxx menger-world
```

## Audio Generation

The project uses ElevenLabs Sound Effects API to generate ambient audio loops.

```bash
cp .env.example .env  # Add ELEVENLABS_API_KEY
npm run generate-audio
```

## License

MIT
