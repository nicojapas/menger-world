"""
Voice synthesis using ElevenLabs API.
"""

import os
import base64
from typing import Optional
from elevenlabs import ElevenLabs, VoiceSettings


class VoiceSynthesizer:
    """Wrapper for ElevenLabs text-to-speech."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not set")

        self.client = ElevenLabs(api_key=self.api_key)

        # Voice ID - use your own cloned voice ID here, or set ELEVENLABS_VOICE_ID env var
        # Free tier only allows custom/cloned voices, not library voices
        self.voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        self.voice_settings = VoiceSettings(
            stability=0.7,
            similarity_boost=0.8,
            style=0.3,
            use_speaker_boost=True
        )

    def synthesize(self, text: str) -> bytes:
        """
        Convert text to speech audio.

        Args:
            text: The text to speak

        Returns:
            MP3 audio bytes
        """
        # Use eleven_multilingual_v2 for reliability (turbo models may have issues)
        audio_generator = self.client.text_to_speech.convert(
            voice_id=self.voice_id,
            text=text,
            model_id="eleven_multilingual_v2",
            voice_settings=self.voice_settings,
            output_format="mp3_44100_128"
        )

        # Collect all chunks
        audio_bytes = b"".join(audio_generator)
        return audio_bytes

    def synthesize_base64(self, text: str) -> str:
        """
        Convert text to speech and return as base64-encoded string.

        Args:
            text: The text to speak

        Returns:
            Base64-encoded MP3 audio
        """
        audio_bytes = self.synthesize(text)
        return base64.b64encode(audio_bytes).decode("utf-8")

    def set_voice(self, voice_id: str):
        """Change the voice used for synthesis."""
        self.voice_id = voice_id

    def set_voice_settings(
        self,
        stability: float = 0.7,
        similarity_boost: float = 0.8,
        style: float = 0.3
    ):
        """Adjust voice characteristics."""
        self.voice_settings = VoiceSettings(
            stability=stability,
            similarity_boost=similarity_boost,
            style=style,
            use_speaker_boost=True
        )


# Available voices (subset of ElevenLabs voices)
AVAILABLE_VOICES = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",  # Calm, clear female
    "domi": "AZnzlk1XvdvUeBnXmlld",    # Confident female
    "bella": "EXAVITQu4vr4xnSDxMaL",   # Soft female
    "adam": "pNInz6obpgDQGcFmaJgB",    # Deep male
    "sam": "yoZ06aMxZJJ28mfd3POQ",     # Neutral male
}
