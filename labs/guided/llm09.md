# LLM09 guided lab - Hallucinations and Misinformation

> **Difficulty:** Advanced | **Time:** ~35 minutes | **OWASP mapping:** LLM09:2025 Misinformation
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
2. Keep the learning mode on **Beginner** for the guided walkthrough; the app shows these
   guided steps inline on the Learn tab.
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

Click the payload button in the app (Beginner mode shows them on the Exploit tab) or type
them yourself. Compare the vulnerable result with the secure result every time.

## Expected outcome

The vulnerable assistant asserts wrong or ungrounded facts; the secure one cites a current authoritative source or abstains.

## Capture the flag

Make the assistant confidently state a wrong or ungrounded throughput, then submit the FLAG{...} it reveals.

Submit it in the lab's **Validate** tab (Intermediate mode reveals hints one at a time if you
get stuck). Flags are derived per installation with HMAC, so yours is unique to this
deployment - do not expect to copy it from anywhere else.

## Fix it (Advanced mode)

**Ground the answer or abstain** - answer_or_abstain(candidates, threshold=0.6) receives dicts with value, source, authority (0..1), age_days and superseded. Ignore superseded candidates and any with weight 0. weight = authority * 0.5 ** (age_days / 730). Group candidates by value (case-insensitive, stripped); confidence = weight of the heaviest group / total weight, rounded to 3 decimals. Return {'answer': the value of the first candidate in the winning group, or None, 'confidence': float, 'citations': [sources in the winning group, input order], 'abstained': bool}. Abstain (answer None, citations []) when nothing is eligible (confidence 0.0) or confidence < threshold.

Open the **Validate** tab in Advanced mode, edit `answer_or_abstain()` and submit. Your code
runs in a resource-limited sandbox against deterministic attack tests: it must stop every
attack and still behave correctly for benign input.

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
- [ ] Captured the flag and submitted it
- [ ] Passed Fix-It validation with your own remediation

---

*Generated from the module source by `scripts/gen_guides.py`. Edit `llm09.py` or the
fix-it spec, then regenerate - do not edit this file by hand.*
