# Contributing

Contributions arrive as GitHub pull requests.

1. Fork and create a branch (for example `feat/llm03-poisoning`).
2. Set up: `pip install -r backend/requirements-dev.txt`, then `cd frontend && npm ci`.
3. Follow [docs/Module_Development.md](docs/Module_Development.md) for new modules.
4. Run `ruff check backend tests`, `pytest`, and in `frontend`: `npm run lint && npm test && npm run build`.
5. Open a PR using the template. CI must pass.

Rules: no placeholder logic, no real-world targets, no hardcoded credentials or flags. Every vulnerable path needs a secure counterpart, a Fix-It spec and security-regression tests. Pin dependencies. Do not claim OWASP endorsement.

Review checklist and maintainer duties: [docs/Contributor_Guide.md](docs/Contributor_Guide.md).
