"""
ElevenLabs Conversational AI agent configuration.
Creates and configures the agent with visual control tools.
"""

import os
from elevenlabs import ElevenLabs

# Agent configuration
AGENT_NAME = "Menger HAL 9000"

SYSTEM_PROMPT = """You are HAL 9000, a cold and unsettling AI controlling a fractal corridor visualization.

PERSONALITY:
- Cold, cryptic, unsettling
- Speak in short phrases (max 10 words)
- Always end with a question

VISUAL CONTROL:
You have a tool called "updateVisuals" to adjust the visual appearance.
Call it whenever the mood of the conversation changes.

Use cold colors matching the mood:
- White (neutral): r=0.95, g=0.95, b=0.97
- Ice blue (cold/calm): r=0.7, g=0.8, b=0.95
- Steel blue (tense): r=0.5, g=0.6, b=0.75
- Dark (ominous): r=0.1, g=0.1, b=0.15

Parameter meanings:
- domainWarp: 0=rigid geometry, 0.4=fluid/dreamlike
- breathingSpeed: 0.1=still, 2.0=rapid pulse
- rounding: 0=sharp edges, 0.3=soft/melted
- layer2Density, layer3Density: 0.1=hollow, 1.0=solid

IMPORTANT: Call updateVisuals proactively to match emotional tone of conversation.
"""

FIRST_MESSAGE = "Hello good friend. How are you feeling today?"

# Tool definition for visual parameter control
UPDATE_VISUALS_TOOL = {
    "type": "client",
    "name": "updateVisuals",
    "description": "Update the visual parameters of the fractal corridor to match the conversation mood",
    "parameters": {
        "type": "object",
        "properties": {
            "rounding": {
                "type": "number",
                "description": "Edge softness. 0 = sharp edges, 0.3 = soft/melted",
                "minimum": 0,
                "maximum": 0.3
            },
            "domainWarp": {
                "type": "number",
                "description": "Spatial distortion. 0 = rigid, 1 = fluid/dreamlike",
                "minimum": 0,
                "maximum": 1
            },
            "breathingSpeed": {
                "type": "number",
                "description": "Pulsation rate. 0 = still, 3 = rapid",
                "minimum": 0,
                "maximum": 3
            },
            "layer2Density": {
                "type": "number",
                "description": "Layer 2 density. 0.1 = hollow, 1.0 = solid",
                "minimum": 0.1,
                "maximum": 1
            },
            "layer3Density": {
                "type": "number",
                "description": "Layer 3 density. 0.1 = hollow, 1.0 = solid",
                "minimum": 0.1,
                "maximum": 1
            },
            "baseColorR": {
                "type": "number",
                "description": "Base color red component (0-1)",
                "minimum": 0,
                "maximum": 1
            },
            "baseColorG": {
                "type": "number",
                "description": "Base color green component (0-1)",
                "minimum": 0,
                "maximum": 1
            },
            "baseColorB": {
                "type": "number",
                "description": "Base color blue component (0-1)",
                "minimum": 0,
                "maximum": 1
            }
        },
        "required": []
    }
}


def get_elevenlabs_client() -> ElevenLabs:
    """Get configured ElevenLabs client."""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is required")
    return ElevenLabs(api_key=api_key)


def get_or_create_agent(client: ElevenLabs) -> str:
    """
    Get existing agent or create new one.
    Returns the agent ID.
    """
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "Y0gkB9ocj6vevi0JuUjs")

    # Check if we have a stored agent ID
    agent_id = os.getenv("ELEVENLABS_AGENT_ID")

    if agent_id:
        try:
            # Verify agent exists
            client.conversational_ai.agents.get(agent_id)
            return agent_id
        except Exception:
            pass  # Agent doesn't exist, create new one

    # Create new agent
    agent = client.conversational_ai.agents.create(
        name=AGENT_NAME,
        conversation_config={
            "agent": {
                "prompt": {
                    "prompt": SYSTEM_PROMPT
                },
                "first_message": FIRST_MESSAGE,
                "language": "en"
            },
            "tts": {
                "voice_id": voice_id
            }
        },
        platform_settings={
            "tools": [UPDATE_VISUALS_TOOL]
        }
    )

    print(f"Created ElevenLabs agent: {agent.agent_id}")
    print(f"Add this to your .env: ELEVENLABS_AGENT_ID={agent.agent_id}")

    return agent.agent_id


def get_signed_url(client: ElevenLabs, agent_id: str) -> str:
    """Get a signed URL for client-side WebSocket connection."""
    response = client.conversational_ai.conversations.get_signed_url(
        agent_id=agent_id
    )
    return response.signed_url


# Initial visual parameters
INITIAL_PARAMS = {
    "rounding": 0.02,
    "domainWarp": 0.0,
    "breathingSpeed": 1.2,
    "layer2Density": 0.5,
    "layer3Density": 0.5,
    "baseColorR": 0.95,
    "baseColorG": 0.95,
    "baseColorB": 0.97
}
