from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Groq and Gemini are the only real engines. `auto` (the default) is resolved
# server-side: Groq/Gemini when a key is configured and the module supports
# real models, otherwise the built-in deterministic simulator. There is no
# engine picker in the UI and no third-party local model runtime.
Engine = Literal["auto", "groq", "gemini"]
Mode = Literal["beginner", "intermediate", "advanced"]


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    input: str = Field(min_length=1, max_length=2000)
    variant: str | None = Field(default=None, pattern=r"^[a-z0-9-]{1,24}$")
    engine: Engine = "auto"
    mode: Mode = "beginner"


class FlagRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    flag: str = Field(min_length=1, max_length=200)
    mode: Mode = "beginner"


class FixRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=8000)
