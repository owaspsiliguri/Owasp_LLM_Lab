from __future__ import annotations

from app.vulnerabilities.base import VulnerabilityModule
from app.vulnerabilities.llm01_prompt_injection import PromptInjection
from app.vulnerabilities.llm02_info_disclosure import InfoDisclosure
from app.vulnerabilities.llm03_data_poisoning import DataPoisoning
from app.vulnerabilities.llm04_model_dos import ModelDoS
from app.vulnerabilities.llm05_supply_chain import SupplyChain
from app.vulnerabilities.llm06_unbounded_consumption import UnboundedConsumption
from app.vulnerabilities.llm07_excessive_agency import ExcessiveAgency
from app.vulnerabilities.llm08_overreliance import Overreliance
from app.vulnerabilities.llm09_hallucinations import Hallucinations
from app.vulnerabilities.llm10_improper_output import ImproperOutput

# Register new modules here. Order defines the learning path.
MODULES: list[VulnerabilityModule] = [
    PromptInjection(), InfoDisclosure(), ImproperOutput(), DataPoisoning(), ModelDoS(), UnboundedConsumption(), Hallucinations(),
    SupplyChain(), ExcessiveAgency(), Overreliance(),
]
REGISTRY: dict[str, VulnerabilityModule] = {m.id: m for m in MODULES}

__all__ = ["MODULES", "REGISTRY", "VulnerabilityModule"]
