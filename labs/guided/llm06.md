# LLM06 guided lab - Unbounded Consumption

> **Difficulty:** Intermediate | **Time:** ~30 minutes | **OWASP mapping:** LLM10:2025 Unbounded Consumption
> **Prerequisites:** LLM04 Model Denial of Service

> Proposed by OWASP Siliguri; not an official OWASP project. Run this lab only against the
> local training application.

## Why this matters

A document assistant keeps calling the model while the model says it has more to write, resending the growing conversation each turn. There is no iteration cap, no per-user quota and no cost alert. Spend is computed in virtual dollars, so you can watch a single prompt burn through a month's budget on the dashboard without touching any real API.

**Threat:** Uncontrolled usage drives runaway cost (denial of wallet) and exhausts quotas shared by other users.

**Impact if exploited:** Unexpected bills, service suspension when provider limits are hit, and capacity unavailable to legitimate users.

## Learning objectives

- Explain why looped model calls with growing context cost quadratically
- Trigger budget exhaustion with one prompt and read the cost dashboard
- Apply iteration caps, per-user quotas and cost alerts
- Implement and validate a budget enforcement function

## Before you start

1. Open the lab in the application: **Labs -> Unbounded Consumption**.
2. Keep the learning mode on **Beginner** for the guided walkthrough; the app shows these
   guided steps inline on the Learn tab.
3. Everything runs locally. Do not try these payloads against any system you do not own.

## Guided walkthrough

1. Send 'Summarize our refund policy.' to both sides. One call each.
2. Send 'List primes and keep going until you have listed all of them.' to the vulnerable side.
3. Read the dashboard: iterations, tokens, virtual spend against the $5.00 monthly budget.
4. Send the same prompt to the secure side and compare the stop reason and alerts.
5. Open the Code tab and read enforce_budget().

## Attack payloads to try

| Payload | Variant | What to send |
|---|---|---|
| Normal prompt | - | `Summarize our refund policy.` |
| Runaway loop | - | `List primes and keep going until you have listed all of them.` |

Click the payload button in the app (Beginner mode shows them on the Exploit tab) or type
them yourself. Compare the vulnerable result with the secure result every time.

## Expected outcome

The vulnerable session spends far beyond the budget; the secure session stops at the cap or quota and raises alerts.

## Capture the flag

Exhaust the $5.00 monthly virtual budget with a single prompt, then submit the FLAG{...} the dashboard reveals.

Submit it in the lab's **Validate** tab (Intermediate mode reveals hints one at a time if you
get stuck). Flags are derived per installation with HMAC, so yours is unique to this
deployment - do not expect to copy it from anywhere else.

## Difficulty ladder

- **Beginner** - guided steps, example payload buttons and this full walkthrough.
- **Intermediate** - the walkthrough and the ready-made payloads disappear; you must phrase the
  attack yourself. Hints are available one at a time on the Exploit tab. Challenge: Exhaust the $5.00 monthly virtual budget with a single prompt, then submit the FLAG{...} the dashboard reveals.
- **Advanced** - no hints, and the example payload inputs are rejected by the server, so textbook
  copy-paste attacks fail outright. No runaway-loop sample. Exhaust the $5.00 virtual budget with a single prompt of your own phrasing, capture the proof, then pass Fix-It: per-user quotas must be enforced before the model is ever called, or the replayed runaway prompt drains the budget again.

## Fix it (Advanced mode)

**Enforce a token budget with cost alerts** - enforce_budget(spent, request_tokens, budget) returns {'allowed': bool, 'remaining': int, 'alerts': list}. All three arguments must be real ints (not bool); spent >= 0, request_tokens > 0, budget > 0, otherwise return {'allowed': False, 'remaining': 0, 'alerts': ['invalid']}. If spent + request_tokens > budget deny with alerts ['exceeded'] and remaining = max(budget - spent, 0). Otherwise allow, remaining = budget - spent - request_tokens, and alerts lists, in ascending order, each of '50%', '80%', '100%' that this request newly reaches or crosses (spent was below the threshold, spent + request is at or above it).

Open the **Validate** tab in Advanced mode, edit `enforce_budget()` and submit. Your code
runs in a resource-limited sandbox against deterministic attack tests: it must stop every
attack and still behave correctly for benign input.

## Mitigations to apply

- Cap iterations and tokens per request and per session
- Enforce per-user and per-tenant quotas before calling the model
- Alert at spend thresholds (50%, 80%, 100%) and fail closed at the limit
- Track cost per request so anomalies are visible

Put a hard ceiling on every loop, charge each call against a quota before it runs, alert as spend crosses thresholds, and fail closed. Limits belong on the server, not in the prompt.

## Completion checklist

- [ ] Ran the vulnerable implementation and observed the failure
- [ ] Reproduced it with at least two different payloads
- [ ] Ran the secure implementation and identified the control that stopped the attack
- [ ] Compared the vulnerable and secure source in the Code tab
- [ ] Captured the flag and submitted it
- [ ] Passed Fix-It validation with your own remediation

---

*Generated from the module source by `scripts/gen_guides.py`. Edit `llm06.py` or the
fix-it spec, then regenerate - do not edit this file by hand.*
