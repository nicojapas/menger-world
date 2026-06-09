"""
Parameter schema and validation for the visual agent.
Defines which parameters the agent can control and their semantic meanings.
"""

from pydantic import BaseModel, Field
from typing import Optional


class VisualParameters(BaseModel):
    """Parameters that control the visual appearance of the fractal corridor."""

    rounding: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=0.3,
        description="Edge softness. 0 = sharp/crystalline edges, 0.3 = soft/organic/melted edges"
    )

    domain_warp: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Spatial distortion. 0 = rigid/structured geometry, 1 = fluid/wavy/dreamlike"
    )

    breathing_speed: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=3.0,
        description="Pulsation rate. 0 = completely still, 3 = rapid breathing/alive"
    )

    iterations: Optional[int] = Field(
        default=None,
        ge=1,
        le=6,
        description="Fractal complexity. 1 = simple/minimal, 6 = intricate/complex/detailed"
    )


# Schema description for the LLM
PARAMETER_SCHEMA_DESCRIPTION = """
You control a fractal corridor visualization. You can adjust these parameters:

1. rounding (0.0 to 0.3):
   - 0.0: Sharp, crystalline, harsh edges
   - 0.15: Balanced, slightly softened
   - 0.3: Soft, organic, melted, blob-like

2. domain_warp (0.0 to 0.4):
   - 0.0: Rigid, structured, geometric
   - 0.2: Moderately wavy, flowing
   - 0.4: Highly fluid, dreamlike, distorted

3. breathing_speed (0.1 to 2.0):
   - 0.1: Completely still, frozen
   - 1.0: Gentle breathing, calm pulse
   - 2.0: Rapid pulsing, energetic, alive

4. layer_2_density
   - 0.1: Hollow
   - 0.5: Normal
   - 1.0: Full
   
5. layer_3_density
   - 0.1: Hollow
   - 0.5: Normal
   - 1.0: Fulf

When changing parameters, consider the user's emotional state and preferences.
"""


# Mapping from our snake_case to the frontend's camelCase
PARAM_NAME_MAP = {
    "rounding": "rounding",
    "domain_warp": "domainWarp",
    "breathing_speed": "breathingSpeed",
    "layer_2_density": "layer2Density",
    "layer_3_density": "layer3Density",
}


def to_frontend_params(params: VisualParameters) -> dict:
    """Convert VisualParameters to frontend-compatible dict."""
    result = {}
    param_dict = params.model_dump(exclude_none=True)

    for key, value in param_dict.items():
        frontend_key = PARAM_NAME_MAP.get(key, key)
        result[frontend_key] = value

    return result


# Default starting values
DEFAULT_PARAMS = VisualParameters(
    rounding=0.05,
    domain_warp=0.2,
    breathing_speed=1.0,
    layer_2_noise=0.5,
    layer_3_noise=0.5,
)
