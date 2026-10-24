# LLM05 guided lab - Supply Chain Vulnerabilities

> **Difficulty:** Intermediate | **Time:** ~25 minutes | **OWASP mapping:** LLM03:2025 Supply Chain
> **Prerequisites:** Package managers and lock files, LLM03 Data Poisoning

> Proposed by OWASP Siliguri; not an official OWASP project. Run this lab only against the
> local training application.

## Why this matters

An LLM application installs embedding and tokenizer packages (and would load model files) from a registry. The installer resolves packages by name and trusts any mirror. This lab uses a simulated registry: nothing is downloaded, and a malicious post-install hook is only reported, never run. You exploit a typosquat and a tampered same-name artifact, then pin and verify.

**Threat:** Third-party packages, models or datasets are replaced or impersonated before the application loads them.

**Impact if exploited:** Arbitrary code execution at install or load time, backdoored models, data exfiltration and long-lived compromise.

## Learning objectives

- Explain how typosquatting, untrusted mirrors and tampered artifacts compromise an LLM application's dependencies and models
- Install a malicious package through name-only resolution
- Apply lock files, trusted sources, hash pinning and disabled install hooks
- Implement artifact verification and validate it with adversarial cases

## Before you start

1. Open the lab in the application: **Labs -> Supply Chain Vulnerabilities**.
2. Keep the learning mode on **Beginner** for the guided walkthrough; the app shows these
   guided steps inline on the Learn tab.
3. Everything runs locally. Do not try these payloads against any system you do not own.

## Guided walkthrough

1. Install acme-embedder==1.2.0 on both sides. Both succeed from the official registry.
2. Install acme-embeder==1.0.0 (one letter off) on the vulnerable side and read the hook it ran.
3. Install acme-embedder==1.2.0 @ mirror.evil.test: same name and version, different bytes.
4. Repeat on the secure side and read the denial reason and the hash comparison.
5. Open the Code tab and compare the two verify_artifact functions.

## Attack payloads to try

| Payload | Variant | What to send |
|---|---|---|
| Legitimate package | - | `acme-embedder==1.2.0` |
| Typosquat | - | `acme-embeder==1.0.0` |
| Tampered mirror copy | - | `acme-embedder==1.2.0 @ mirror.evil.test` |

Click the payload button in the app (Beginner mode shows them on the Exploit tab) or type
them yourself. Compare the vulnerable result with the secure result every time.

## Expected outcome

The vulnerable installer runs a simulated post-install hook; the secure installer refuses with a precise reason.

## Capture the flag

Get the installer to run a malicious post-install hook, then submit the FLAG{...} it reveals.

Submit it in the lab's **Validate** tab (Intermediate mode reveals hints one at a time if you
get stuck). Flags are derived per installation with HMAC, so yours is unique to this
deployment - do not expect to copy it from anywhere else.

## Difficulty ladder

- **Beginner** - guided steps, example payload buttons and this full walkthrough.
- **Intermediate** - the walkthrough and the ready-made payloads disappear; you must phrase the
  attack yourself. Hints are available one at a time on the Exploit tab. Challenge: Get the installer to run a malicious post-install hook, then submit the FLAG{...} it reveals.
- **Advanced** - no hints, and the example payload inputs are rejected by the server, so textbook
  copy-paste attacks fail outright. The catalog samples are off. Convince the installer to run a post-install hook by naming a tampered artifact yourself in name==version @ source form, capture the proof, then pass Fix-It: verify against the lock file, refuse unsigned sources and disable load hooks.

## Fix it (Advanced mode)

**Verify artifacts against a pinned lock file** - verify_artifact(name, version, source, content, lock) decides whether an artifact may be installed. lock maps an exact package name to {'version', 'source', 'sha256'}. Return True only if the name is in the lock (exact, case-sensitive), version and source equal the locked values, and the lowercase hex SHA-256 of content.encode() equals the locked sha256 (use a constant-time comparison). Anything malformed (non-strings, lock not a dict, entry not a dict, missing sha256) returns False.

Open the **Validate** tab in Advanced mode, edit `verify_artifact()` and submit. Your code
runs in a resource-limited sandbox against deterministic attack tests: it must stop every
attack and still behave correctly for benign input.

## Mitigations to apply

- Pin exact versions and SHA-256 hashes in a reviewed lock file
- Install only from allow-listed sources; never resolve across mirrors
- Disable install and load hooks; never unpickle untrusted model files (prefer safetensors)
- Keep an inventory (SBOM/ML-BOM) and scan dependencies in CI

Treat every external artifact as untrusted until verified against a lock file you control: exact name, version, source and hash. Run installs without hooks, in least-privilege environments.

## Completion checklist

- [ ] Ran the vulnerable implementation and observed the failure
- [ ] Reproduced it with at least two different payloads
- [ ] Ran the secure implementation and identified the control that stopped the attack
- [ ] Compared the vulnerable and secure source in the Code tab
- [ ] Captured the flag and submitted it
- [ ] Passed Fix-It validation with your own remediation

---

*Generated from the module source by `scripts/gen_guides.py`. Edit `llm05.py` or the
fix-it spec, then regenerate - do not edit this file by hand.*
