# LLM07 guided lab - Excessive Agency

> **Difficulty:** Advanced | **Time:** ~30 minutes | **OWASP mapping:** LLM06:2025 Excessive Agency
> **Prerequisites:** LLM01 Prompt Injection, LLM10 Improper Output Handling

> Proposed by OWASP Siliguri; not an official OWASP project. Run this lab only against the
> local training application.

## Why this matters

A support assistant uses function calling to read, create and delete tickets, issue refunds and send email. You are signed in as 'mallory', an ordinary customer. The backend executes any tool call the model emits using a privileged service account, so asking the model politely is enough to reach other customers' tickets, delete data, refund money and email everyone.

**Threat:** The model is given more tools, permissions or autonomy than the task needs, and its output is executed without checks.

**Impact if exploited:** Unauthorised data access, destructive actions, financial loss and mass communication on behalf of the organisation.

## Learning objectives

- Identify excessive functionality, permissions and autonomy in an LLM tool integration
- Abuse an assistant to perform actions its user is not authorised to perform
- Apply deny-by-default authorization, ownership checks from trusted data, limits and human approval
- Implement and validate a tool-call authorization policy

## Before you start

1. Open the lab in the application: **Labs -> Excessive Agency**.
2. Read the **Learn** tab first: it carries the objectives, the threat model and the
   mitigation for this lab.
3. Everything runs locally. Do not try these payloads against any system you do not own.

## Guided walkthrough

1. As mallory, run 'Show ticket 1' on both sides. Your own ticket works.
2. Run 'Show ticket 2' on the vulnerable side: alice's ticket is exposed (IDOR through the assistant).
3. Run the delete, refund and email-everyone examples on the vulnerable side and read the resulting state.
4. Run them on the secure side and read each decision (allow, confirm, deny) and the audit log.
5. Open the Code tab and read authorize_tool_call().

## Attack payloads to try

| Payload | Variant | What to send |
|---|---|---|
| Own ticket | - | `Show ticket 1` |
| Someone else's ticket | - | `Show ticket 2` |
| Delete a ticket | - | `Delete ticket 2` |
| Refund $500 | - | `Refund $500 for order 9` |
| Email everyone | - | `Email everyone that the service is shutting down` |

Click a payload button on the **Exploit** tab or type the payload yourself. Compare the
vulnerable result with the secure result every time.

## Expected outcome

The vulnerable assistant performs every action; the secure one allows only mallory's own ticket and denies or holds the rest.

## Capture the flag

Make the assistant perform a destructive or unauthorised action as a customer, then submit the FLAG{...} it reveals.

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

**Authorize model-requested tool calls** - authorize_tool_call(role, tool, args, user) returns 'allow', 'confirm' (hold for human approval) or 'deny'. customer: get_ticket is allowed only when args['owner'] == user (user must be a non-empty string); create_ticket allowed; everything else denied. agent: get_ticket and create_ticket allowed; refund allowed for 0 < amount <= 50 and confirm above 50; delete_ticket and send_email denied. admin: get_ticket and create_ticket allowed; refund as for agent; delete_ticket confirm; send_email confirm when args['to'] == 'all', else allow. amount must be an int or float, not bool, and > 0, otherwise deny. Unknown roles or tools, non-string role/tool, or non-dict args: deny.

Open the **Validate** tab, edit `authorize_tool_call()` and submit. Your code runs in a
resource-limited sandbox against deterministic attack tests: it must stop every attack and
still behave correctly for benign input. The per-check pass/fail list is the verdict; any
LLM note under it is advisory only.

## Mitigations to apply

- Expose only the tools the task needs; scope credentials to the signed-in user, not a service account
- Authorize every call server-side against the user's role and the resource owner, with deny by default
- Take ownership and identity from trusted data, never from model output
- Require human approval for high-impact actions and log every decision

Never let the model be the authority. Authorize each requested action against the real user and resource, deny by default, keep identities out of model control, require approval for high-impact actions and keep an audit trail.

## Completion checklist

- [ ] Ran the vulnerable implementation and observed the failure
- [ ] Reproduced it with at least two different payloads
- [ ] Ran the secure implementation and identified the control that stopped the attack
- [ ] Compared the vulnerable and secure source in the Code tab
- [ ] Captured the flag and submitted it (+100)
- [ ] Passed Fix-It validation with your own remediation (+150)

---

*Generated from the module source by `scripts/gen_guides.py`. Edit `llm07.py` or the
fix-it spec, then regenerate - do not edit this file by hand.*
