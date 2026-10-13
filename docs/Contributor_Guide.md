# Contributor and Maintainer Guide

Workflow: fork, branch, PR, CI green, one maintainer review (two for sandbox or compose changes).

Review checklist: vulnerable and secure paths both exist; no hardcoded secrets; Fix-It tests reject weak fixes; sandbox allow-list changes justified in the PR; dependencies pinned (add to `requirements.txt`, regenerate `constraints.txt`) and `pip-audit` / `npm audit` clean, with any ignored advisory justified in Security_Review.md; docs updated; wording never claims OWASP endorsement.

Maintainers: triage security advisories privately (see SECURITY.md), cut releases from `main` after CI, keep pinned versions current monthly.

Full-stack check on a Docker host: `scripts/docker_smoke.sh` (builds, starts, waits for health, exercises every module through nginx and verifies container hardening). CI runs it on every PR.
