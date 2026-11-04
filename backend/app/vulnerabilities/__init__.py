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
from app.vulnerabilities.llm11_system_prompt_leakage import SystemPromptLeakage
from app.vulnerabilities.llm12_vector_weaknesses import VectorWeaknesses
from app.vulnerabilities.llm13_rag_tenant_isolation import RagTenantIsolation
from app.vulnerabilities.llm14_indirect_injection import IndirectPromptInjection
from app.vulnerabilities.llm15_tool_output_injection import ToolOutputInjection
from app.vulnerabilities.llm16_parameter_tampering import ParameterTampering
from app.vulnerabilities.llm17_agent_auth_bypass import AgentAuthorizationBypass
from app.vulnerabilities.llm18_memory_poisoning import PersistentMemoryPoisoning
from app.vulnerabilities.llm19_multi_turn_jailbreak import MultiTurnJailbreak
from app.vulnerabilities.llm20_multimodal_injection import MultimodalPromptInjection
from app.vulnerabilities.llm21_mcp_security import McpServerSecurity
from app.vulnerabilities.llm22_code_injection import LlmToCodeInjection

# Register new modules here. Order defines the default lab sequence.
MODULES: list[VulnerabilityModule] = [
    PromptInjection(), InfoDisclosure(), ImproperOutput(), DataPoisoning(), ModelDoS(), UnboundedConsumption(),
    Hallucinations(), SupplyChain(), ExcessiveAgency(), Overreliance(), SystemPromptLeakage(), VectorWeaknesses(),
    RagTenantIsolation(), IndirectPromptInjection(), ToolOutputInjection(), ParameterTampering(),
    AgentAuthorizationBypass(), PersistentMemoryPoisoning(), MultiTurnJailbreak(), MultimodalPromptInjection(),
    McpServerSecurity(), LlmToCodeInjection(),
]
REGISTRY: dict[str, VulnerabilityModule] = {m.id: m for m in MODULES}

__all__ = ["MODULES", "REGISTRY", "VulnerabilityModule"]
