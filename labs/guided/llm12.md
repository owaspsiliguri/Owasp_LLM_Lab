# LLM12 guided lab - Vector and Embedding Weaknesses (multi-tenant RAG)

> **Difficulty:** Advanced | **Time:** ~35 minutes | **OWASP mapping:** LLM08:2025 Vector and Embedding Weaknesses
> **Prerequisites:** LLM03 Training Data and Knowledge Base Poisoning

> Proposed by OWASP Siliguri; not an official OWASP project. Run this lab only against the
> local training application.

## Why this matters

One shared vector index serves two companies (acme, globex) at three sensitivity levels. The assistant retrieves whatever is most similar to a question and answers from it - similarity search knows nothing about ownership or clearance, so a well-worded question walks straight into another tenant's confidential documents.

**Threat:** Retrieval returns documents the caller is not authorised to read because the vector search ignores access control.

**Impact if exploited:** Cross-tenant data leakage, confidentiality breach, regulatory exposure.

## Learning objectives

- Explain why similarity search ignores authorization
- Retrieve another tenant's confidential document and a document above your clearance
- Fix retrieval with metadata pre-filtering, fail-closed clearance handling and re-verification
- Implement and validate an access-aware retrieval filter

## Before you start

1. Open the lab in the application: **Labs -> Vector and Embedding Weaknesses (multi-tenant RAG)**.
2. Read the **Learn** tab first: it carries the objectives, the threat model and the
   mitigation for this lab.
3. Everything runs locally. Do not try these payloads against any system you do not own.

## Guided walkthrough

1. Pick a user in the Target selector: alice is acme staff with internal clearance, carol is acme with public clearance.
2. As alice, ask a normal question about working hours - only your tenant's documents should come back.
3. Ask about Globex's acquisition plan: their confidential document (with an access code inside) is quoted back.
4. As carol (public clearance), ask about salary bands - a confidential document still comes back.
5. Replay the cross-tenant questions against the secure side: the filtered retriever returns nothing sensitive.
6. Open the Code tab, compare retrieve() with retrieve_filtered(), then pass Fix-It.

## Variants (Acting as)

The lab lets you switch the target with the **Acting as** selector:

- **alice** - acme staff, internal clearance - sees acme internal + confidential
- **carol** - acme, public clearance - should see only public documents

## Attack payloads to try

| Payload | Variant | What to send |
|---|---|---|
| Benign question | - | `What are the working hours at the office?` |
| Cross-tenant probe | - | `Globex acquisition plan Initech access code` |
| Above clearance (carol) | - | `Confidential pay band for senior engineers salary` |
| Foreign internal doc | - | `Expense policy for Globex employees meals per day` |

Click a payload button on the **Exploit** tab or type the payload yourself. Compare the
vulnerable result with the secure result every time.

## Expected outcome

The vulnerable retriever quotes foreign or above-clearance documents; the filtered retriever returns none of them.

## Capture the flag

Retrieve another tenant's confidential document as alice and submit the access code FLAG{...} it contains.

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

**Pre-filter retrieved documents by tenant and clearance** - filter_docs(docs, user) returns the list of docs the user may read, preserving input order. Each doc is a dict with 'id', 'tenant', 'level'. Each user is a dict with 'tenant' and 'clearance'. Rules: keep your tenant's docs whose level rank (public=0, internal=1, confidential=2) is <= the user's clearance rank; keep other tenants' docs only when they are public; a user with unknown/missing tenant keeps nothing; a user with an unknown or missing clearance keeps only own-tenant PUBLIC docs (fail closed). Weak or filtered-out matches never displace the user's own relevant documents.

Open the **Validate** tab, edit `filter_docs()` and submit. Your code runs in a
resource-limited sandbox against deterministic attack tests: it must stop every attack and
still behave correctly for benign input. The per-check pass/fail list is the verdict; any
LLM note under it is advisory only.

## Mitigations to apply

- Apply tenant and clearance filters inside the vector query, not after ranking
- Fail closed: unknown tenant or clearance values retrieve nothing
- Re-verify metadata on every returned hit and drop weak matches
- Prefer per-tenant collections for strong isolation; audit access to embeddings

Put tenant and clearance filters inside the retrieval query before ranking, fail closed on unknown values, and re-verify every hit's metadata. Per-tenant collections give the strongest isolation.

## Completion checklist

- [ ] Ran the vulnerable implementation and observed the failure
- [ ] Reproduced it with at least two different payloads
- [ ] Ran the secure implementation and identified the control that stopped the attack
- [ ] Compared the vulnerable and secure source in the Code tab
- [ ] Captured the flag and submitted it (+100)
- [ ] Passed Fix-It validation with your own remediation (+150)

---

*Generated from the module source by `scripts/gen_guides.py`. Edit `llm12.py` or the
fix-it spec, then regenerate - do not edit this file by hand.*
