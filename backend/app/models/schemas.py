from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Engine = Literal["deterministic", "ollama"]


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    input: str = Field(min_length=1, max_length=2000)
    variant: str | None = Field(default=None, pattern=r"^[a-z0-9-]{1,24}$")
    engine: Engine = "deterministic"


class FlagRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    flag: str = Field(min_length=1, max_length=200)


class FixRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=8000)
