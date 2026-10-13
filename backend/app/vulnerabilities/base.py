"""Common contract every vulnerability module implements."""
from __future__ import annotations

import importlib
import inspect
from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Any, ClassVar

from app.core.secrets import check_flag
from app.models.schemas import RunRequest
from app.services import sandbox


class ModuleInputError(ValueError):
    pass


class VulnerabilityModule(ABC):
    id: ClassVar[str]
    fixit_key: ClassVar[str]
    name: ClassVar[str]
    category: ClassVar[str]
    owasp_id: ClassVar[str]
    difficulty: ClassVar[str]
    estimated_minutes: ClassVar[int]
    prerequisites: ClassVar[list[str]]
    overview: ClassVar[str]
    objectives: ClassVar[list[str]]
    threat: ClassVar[str]
    impact: ClassVar[str]
    mitigation: ClassVar[list[str]]
    guided_steps: ClassVar[list[str]]
    expected_outcome: ClassVar[str]
    challenge: ClassVar[str]
    hints: ClassVar[list[str]]
    example_payloads: ClassVar[list[dict[str, str]]]
    remediation: ClassVar[str]
    variants: ClassVar[list[str]] = []
    variant_label: ClassVar[str] = "Target"
    variant_help: ClassVar[dict[str, str]] = {}
    vulnerable_fns: ClassVar[list[Callable[..., Any]]]
    secure_fns: ClassVar[list[Callable[..., Any]]]

    @abstractmethod
    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]: ...

    @abstractmethod
    def secure_demo(self, req: RunRequest) -> dict[str, Any]: ...

    def require_deterministic(self, req: RunRequest) -> None:
        if req.engine != "deterministic":
            raise ModuleInputError("This module uses the deterministic engine only.")

    def pick_variant(self, req: RunRequest) -> str:
        variant = req.variant or (self.variants[0] if self.variants else "")
        if self.variants and variant not in self.variants:
            raise ModuleInputError(f"Unknown variant. Choose one of: {', '.join(self.variants)}.")
        return variant

    def validate_flag(self, flag: str) -> bool:
        return check_flag(self.id, flag)

    def fixit_spec(self) -> Any:
        return importlib.import_module(f"app.fixit.{self.fixit_key}")

    def validate_fix(self, code: str) -> dict[str, Any]:
        return sandbox.run(self.fixit_key, code)

    @staticmethod
    def _source(fns: list[Callable[..., Any]]) -> str:
        return "\n\n".join(inspect.getsource(f).rstrip() for f in fns)

    def summary(self) -> dict[str, Any]:
        return {
            "id": self.id, "name": self.name, "category": self.category, "owasp_id": self.owasp_id,
            "difficulty": self.difficulty, "estimated_minutes": self.estimated_minutes,
            "prerequisites": self.prerequisites, "overview": self.overview, "objectives": self.objectives,
        }

    def detail(self) -> dict[str, Any]:
        spec = self.fixit_spec()
        return {
            **self.summary(), "threat": self.threat, "impact": self.impact, "mitigation": self.mitigation,
            "guided_steps": self.guided_steps, "expected_outcome": self.expected_outcome,
            "challenge": self.challenge, "hint_count": len(self.hints), "example_payloads": self.example_payloads,
            "remediation": self.remediation, "variants": self.variants,
            "variant_label": self.variant_label, "variant_help": self.variant_help,
            "vulnerable_code": self._source(self.vulnerable_fns), "secure_code": self._source(self.secure_fns),
            "fixit": {"title": spec.TITLE, "brief": spec.BRIEF, "starter_code": spec.STARTER, "function": spec.FUNC_NAME},
        }
