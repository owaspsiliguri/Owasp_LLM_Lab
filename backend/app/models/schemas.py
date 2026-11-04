from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Groq and Gemini are the only real engines. `auto` is resolved server-side:
# Groq/Gemini when a key is configured and the module supports real models,
# otherwise the built-in deterministic simulator.
Engine = Literal["auto", "groq", "gemini"]


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    input: str = Field(min_length=1, max_length=2000)
    variant: str | None = Field(default=None, pattern=r"^[a-z0-9-]{1,24}$")
    engine: Engine = "auto"


class FlagRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    flag: str = Field(min_length=1, max_length=200)


class FixRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=8000)
