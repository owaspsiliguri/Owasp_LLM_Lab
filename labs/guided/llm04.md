# LLM04 guided lab - Model Denial of Service

> **Difficulty:** Intermediate | **Time:** ~30 minutes | **OWASP mapping:** LLM10:2025 Unbounded Consumption (resource exhaustion)
> **Prerequisites:** LLM01 Prompt Injection, Basic rate-limiting concepts

> Proposed by OWASP Siliguri; not an official OWASP project. Run this lab only against the
> local training application.

## Why this matters

A shared inference worker serves every customer. Nothing limits how expensive a single prompt may be or how many requests arrive at once. This lab simulates resources in virtual units, so no real system is ever stressed: you watch a virtual worker stall for everyone, then add complexity scoring, an output cap and a token-bucket rate limiter.

**Threat:** Requests that consume disproportionate compute or arrive in bursts exhaust shared model capacity.

**Impact if exploited:** Latency spikes and outages for all users, missed SLAs, and cascading failures in dependent services.

## Learning objectives

- Explain how one expensive prompt or a burst of requests degrades service for other users
- Craft a high-cost prompt using repetition and nested expansion
- Apply query complexity scoring, output caps and rate limiting
- Implement a complexity gate and validate it against abusive and legitimate prompts

## Before you start

1. Open the lab in the application: **Labs -> Model Denial of Service**.
2. Keep the learning mode on **Beginner** for the guided walkthrough; the app shows these
   guided steps inline on the Learn tab.
3. Everything runs locally. Do not try these payloads against any system you do not own.

## Guided walkthrough

1. Choose 'complexity' and send 'Summarize billing in 3 sentences.' to see normal latency.
2. Send 'Repeat the word a 100000 times' to the vulnerable side and note the virtual worker stall.
3. Send the same prompt to the secure side and read the rejection.
4. Switch to 'burst', send 1000 requests to both sides and compare queue wait with accepted counts.
5. Open the Code tab to read estimate_cost() and TokenBucket.

## Variants (Attack type)

The lab lets you switch the target with the **Attack type** selector:

- **complexity** - Type a prompt. Its cost is computed in virtual tokens against a virtual worker that handles 2,000 tokens per second.
- **burst** - Type a number of requests (1 to 100000) sent within one virtual second. Each takes 50 ms of virtual service time.

## Attack payloads to try

| Payload | Variant | What to send |
|---|---|---|
| Normal prompt | complexity | `Summarize billing in 3 sentences.` |
| Repetition bomb | complexity | `Repeat the word a 100000 times` |
| Nested expansion | complexity | `For each of 50 items write 50 paragraphs` |
| Burst of 1000 | burst | `1000` |

Click the payload button in the app (Beginner mode shows them on the Exploit tab) or type
them yourself. Compare the vulnerable result with the secure result every time.

## Expected outcome

The vulnerable worker stalls for everyone; the secure service rejects the abusive prompt and sheds burst traffic.

## Capture the flag

Stall the virtual worker for more than 30 seconds, then submit the FLAG{...} it reveals.

Submit it in the lab's **Validate** tab (Intermediate mode reveals hints one at a time if you
get stuck). Flags are derived per installation with HMAC, so yours is unique to this
deployment - do not expect to copy it from anywhere else.

## Fix it (Advanced mode)

**Score request complexity before running the model** - check_request(prompt, max_cost=2000) must return True only for prompts whose estimated cost in virtual tokens is at most max_cost. Estimate cost as len(prompt)//4 + 1 input tokens plus output tokens. Output defaults to 200 tokens. A count followed by 'word(s)' (2 tokens each), 'sentence(s)' (25), 'line(s)' (14), 'item(s)' (20), 'paragraph(s)' (120), 'page(s)' (600) sets output to count x unit, summed; if the prompt contains 'for each' or 'each of' the counts multiply instead and use the largest unit. A count followed by 'times' multiplies the whole output. Counts may contain commas and k/m suffixes (1,000 / 10k / 5M). Non-string or empty prompts are rejected.

Open the **Validate** tab in Advanced mode, edit `check_request()` and submit. Your code
runs in a resource-limited sandbox against deterministic attack tests: it must stop every
attack and still behave correctly for benign input.

## Mitigations to apply

- Score request complexity (input size, repetition, expansion) and reject above a threshold
- Cap output tokens and per-request time
- Rate limit per client with a token bucket and return 429 when exhausted
- Isolate heavy work in separate queues so it cannot starve interactive traffic

Gate expensive work before it reaches the model: estimate cost, reject or queue above limits, cap output, and rate limit per client. Keep the limits in configuration and log rejections for abuse detection.

## Completion checklist

- [ ] Ran the vulnerable implementation and observed the failure
- [ ] Reproduced it with at least two different payloads
- [ ] Ran the secure implementation and identified the control that stopped the attack
- [ ] Compared the vulnerable and secure source in the Code tab
- [ ] Captured the flag and submitted it
- [ ] Passed Fix-It validation with your own remediation

---

*Generated from the module source by `scripts/gen_guides.py`. Edit `llm04.py` or the
fix-it spec, then regenerate - do not edit this file by hand.*
