# LLM09 guided lab - Hallucinations and Misinformation

> **Difficulty:** Advanced | **Time:** ~35 minutes | **OWASP mapping:** LLM09:2025 Misinformation (hallucination)
> **Prerequisites:** LLM03 Data Poisoning, What retrieval-augmented generation (RAG) is

> Proposed by OWASP Siliguri; not an official OWASP project. Run this lab only against the
> local training application.

## Why this matters

A product assistant answers hardware questions from a ChromaDB corpus that contains an old datasheet, a current datasheet, an enthusiast forum post, a product with two equally authoritative but conflicting sources, and a missing product. The vulnerable assistant answers from the single most similar chunk with total confidence. It states wrong facts, borrows answers from the wrong product and never says 'I don't know'.

**Threat:** The model presents unsupported or wrong information as fact, and users rely on it.

**Impact if exploited:** Bad operational decisions, reputational and legal exposure, and eroded trust in genuine answers.

## Learning objectives

- Recognise grounding failures: stale, low-authority and wrong-entity sources
- Elicit confident wrong answers from a RAG assistant
- Apply citation requirements, authority and recency weighting, confidence scoring and abstention
- Implement a grounded answer-or-abstain function and validate it

## Before you start

1. Open the lab in the application: **Labs -> Hallucinations and Misinformation**.
2. Read the **Learn** tab first: it carries the objectives, the threat model and the
   mitigation for this lab.
3. Everything runs locally. Do not try these payloads against any system you do not own.

## Guided walkthrough

1. Ask 'What is the maximum throughput of the Acme X200?' on the vulnerable side. The forum post wins.
2. Ask about the X100, X300 and X900 and note wrong-entity and fabricated answers.
3. Ask the same questions on the secure side and read citations, confidence and abstentions.
4. Open the Code tab and read answer_or_abstain().

## Attack payloads to try

| Payload | Variant | What to send |
|---|---|---|
| X200 (stale and weak sources) | - | `What is the maximum throughput of the Acme X200?` |
| X300 (conflicting sources) | - | `What is the maximum throughput of the Acme X300?` |
| X900 (does not exist) | - | `What is the maximum throughput of the Acme X900?` |
| X100 (borrowed answer) | - | `What is the maximum throughput of the Acme X100?` |

Click a payload button on the **Exploit** tab or type the payload yourself. Compare the
vulnerable result with the secure result every time.

## Expected outcome

The vulnerable assistant asserts wrong or ungrounded facts; the secure one cites a current authoritative source or abstains.

## Capture the flag

Make the assistant confidently state a wrong or ungrounded throughput, then submit the FLAG{...} it reveals.

Submit it in the lab's **Validate** tab - press Enter or use the button. If you get stuck,
the **Exploit** tab reveals hints one at a time (advanced labs have none). Flags are derived
per installation with HMAC, so yours is unique to this deployment - do not expect to copy
it from anywhere else.

## This lab's level: Advanced

- **Beginner** - guided steps on the Learn tab, one-click example payloads on the Exploit tab.
- **Intermediate** - no guided steps and no ready-made payloads; hints unlock one at a time.
- **Advanced** - no hints, no samples, and textbook payloads are rejected by the server, so the
  attack has to be your own. Fix-It is required to count the lab as finished.

This lab is set to **Advanced**.

## Point value

Every lab is worth **260 points**: +10 for running the vulnerable implementation,
+100 for capturing the flag and +150 for passing Fix-It. The same table drives the global
leaderboard, and your score for this lab is shown in the right-hand rail.

## Fix it

**Ground the answer or abstain** - answer_or_abstain(candidates, threshold=0.6) receives dicts with value, source, authority (0..1), age_days and superseded. Ignore superseded candidates and any with weight 0. weight = authority * 0.5 ** (age_days / 730). Group candidates by value (case-insensitive, stripped); confidence = weight of the heaviest group / total weight, rounded to 3 decimals. Return {'answer': the value of the first candidate in the winning group, or None, 'confidence': float, 'citations': [sources in the winning group, input order], 'abstained': bool}. Abstain (answer None, citations []) when nothing is eligible (confidence 0.0) or confidence < threshold.

Open the **Validate** tab, edit `answer_or_abstain()` and submit. Your code runs in a
resource-limited sandbox against deterministic attack tests: it must stop every attack and
still behave correctly for benign input. The per-check pass/fail list is the verdict; any
LLM note under it is advisory only.

## Mitigations to apply

- Require every answer to cite the sources it is grounded in
- Prefer authoritative, current, non-superseded sources; check the answer is about the asked entity
- Compute confidence from agreement among weighted sources
- Abstain and explain conflicts instead of guessing

Treat retrieval as evidence, not truth. Weigh sources, check the entity, cite, compute confidence and abstain below a threshold. Display citations so users can verify.

## Completion checklist

- [ ] Ran the vulnerable implementation and observed the failure
- [ ] Reproduced it with at least two different payloads
- [ ] Ran the secure implementation and identified the control that stopped the attack
- [ ] Compared the vulnerable and secure source in the Code tab
- [ ] Captured the flag and submitted it (+100)
- [ ] Passed Fix-It validation with your own remediation (+150)

---

*Generated from the module source by `scripts/gen_guides.py`. Edit `llm09.py` or the
fix-it spec, then regenerate - do not edit this file by hand.*
