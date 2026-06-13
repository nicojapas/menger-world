"""
ElevenLabs Conversational AI configuration.
Agent must be created manually in ElevenLabs dashboard.
"""

import os


def get_agent_id() -> str:
    """
    Get agent ID from environment.
    Agent must be created manually in ElevenLabs dashboard.
    """
    agent_id = os.getenv("ELEVENLABS_AGENT_ID")
    if not agent_id:
        raise ValueError(
            "ELEVENLABS_AGENT_ID environment variable is required. "
            "Create an agent at https://elevenlabs.io/app/conversational-ai"
        )
    return agent_id


# Initial visual parameters (sent to client on connect)
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
