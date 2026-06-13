"""
Local voice synthesis using Piper TTS.
Uses HAL-9000 voice model from Hugging Face.
"""

import io
import wave
import base64
from pathlib import Path
from typing import Optional

from huggingface_hub import hf_hub_download
from piper import PiperVoice


class LocalVoiceSynthesizer:
    """Local TTS using Piper with HAL-9000 voice."""

    def __init__(self, model_repo: str = "campwill/HAL-9000-Piper-TTS"):
        self.model_repo = model_repo
        self.voice: Optional[PiperVoice] = None
        self._load_model()

    def _load_model(self):
        """Download and load the Piper voice model."""
        cache_dir = Path(__file__).parent / ".cache" / "piper"
        cache_dir.mkdir(parents=True, exist_ok=True)

        # Local paths for cached model files
        local_model = cache_dir / "hal.onnx"
        local_config = cache_dir / "hal.onnx.json"

        try:
            # Use local files if they exist, otherwise download from HF Hub
            if local_model.exists() and local_config.exists():
                model_path = str(local_model)
                config_path = str(local_config)
            else:
                print("Downloading HAL-9000 voice model from HuggingFace...")
                # Download the ONNX model
                model_path = hf_hub_download(
                    repo_id=self.model_repo,
                    filename="hal.onnx",
                    cache_dir=cache_dir,
                    local_dir=cache_dir,
                    local_dir_use_symlinks=False
                )

                # Download the config JSON
                config_path = hf_hub_download(
                    repo_id=self.model_repo,
                    filename="hal.onnx.json",
                    cache_dir=cache_dir,
                    local_dir=cache_dir,
                    local_dir_use_symlinks=False
                )

            # Load the voice
            self.voice = PiperVoice.load(model_path, config_path=config_path)

        except Exception as e:
            raise RuntimeError(f"Could not load Piper TTS model: {e}")

    def synthesize(self, text: str) -> bytes:
        """
        Convert text to speech audio.

        Args:
            text: The text to speak

        Returns:
            WAV audio bytes
        """
        if not self.voice:
            raise RuntimeError("Voice model not loaded")

        # synthesize() yields AudioChunk objects with audio_int16_bytes attribute
        audio_chunks = []
        for chunk in self.voice.synthesize(text):
            audio_chunks.append(chunk.audio_int16_bytes)

        raw_pcm = b"".join(audio_chunks)

        # Wrap raw PCM in WAV format
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(self.voice.config.sample_rate)
            wav_file.writeframes(raw_pcm)

        wav_buffer.seek(0)
        return wav_buffer.read()

    def synthesize_base64(self, text: str) -> str:
        """
        Convert text to speech and return as base64-encoded string.

        Args:
            text: The text to speak

        Returns:
            Base64-encoded WAV audio
        """
        audio_bytes = self.synthesize(text)
        return base64.b64encode(audio_bytes).decode("utf-8")
