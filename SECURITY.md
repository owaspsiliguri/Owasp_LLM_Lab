# Security Policy

This project is intentionally vulnerable **inside its lab modules**. Those weaknesses are not bugs.

Please report privately (do not open a public issue) anything that lets a lab weakness affect the host or other users: sandbox escape from Fix It, vulnerabilities in the API or frontend outside lab modules, container breakout, secret leakage, or insecure defaults in `docker-compose.yml`.

Report via GitHub Security Advisories ("Report a vulnerability") on the repository, with reproduction steps and the affected version. Maintainers aim to acknowledge within 5 business days and ship a fix or mitigation within 90 days.

Supported versions: the latest release on `main`.

Run the lab only on localhost or an isolated network. Never expose it to the internet.
