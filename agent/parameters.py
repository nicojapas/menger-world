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
        description="Edge softness. 0 = sharp edges, 0.3 = soft/melted"
    )

    domain_warp: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Spatial distortion. 0 = rigid, 1 = fluid/dreamlike"
    )

    breathing_speed: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=3.0,
        description="Pulsation rate. 0 = still, 3 = rapid"
    )

    layer_2_density: Optional[float] = Field(
        default=None,
        ge=0.1,
        le=1.0,
        description="Layer 2 density. 0.1 = hollow, 1.0 = solid"
    )

    layer_3_density: Optional[float] = Field(
        default=None,
        ge=0.1,
        le=1.0,
        description="Layer 3 density. 0.1 = hollow, 1.0 = solid"
    )

    base_color_r: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Base color red component"
    )

    base_color_g: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Base color green component"
    )

    base_color_b: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Base color blue component"
    )


class AgentResponse(VisualParameters):
    """Structured response from the agent: speech + visual parameters."""

    speech: str = Field(
        description="HAL 9000's cryptic response, max 10 words, ending with a question"
    )

    def get_params_dict(self) -> Optional[dict]:
        """Extract only the visual parameters (excluding speech) as a dict."""
        params = self.model_dump(exclude={"speech"}, exclude_none=True)
        return params if params else None


# Mapping from our snake_case to the frontend's camelCase
PARAM_NAME_MAP = {
    "rounding": "rounding",
    "domain_warp": "domainWarp",
    "breathing_speed": "breathingSpeed",
    "layer_2_density": "layer2Density",
    "layer_3_density": "layer3Density",
    "base_color_r": "baseColorR",
    "base_color_g": "baseColorG",
    "base_color_b": "baseColorB",
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
    layer_2_density=0.5,
    layer_3_density=0.5,
)
