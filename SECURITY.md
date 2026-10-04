# Security Policy

This is a personal fork of [Pelski/ytzero](https://github.com/Pelski/ytzero).
It is currently a personal fork: for now there is no support, no SLA, and no
promise to read reports or fix anything. That may change. It is shared as is,
under the AGPL.

## Reporting

- Problems that also exist upstream: see [Pelski/ytzero](https://github.com/Pelski/ytzero).
- Problems in this fork: **please do not open a public issue for security
  problems.** You may use GitHub's
  [private vulnerability reporting](https://github.com/Fogbench/ytzero/security/advisories/new)
  on this repository, with the issue, its impact, steps to reproduce and the
  affected commit. It is best effort only; there may be no reply or fix.

## Scope and threat model

YT Zero can run as a single-user app on a private network (the default, no
login) or be exposed more broadly using one of the built-in authentication
methods — see [Authentication](https://github.com/Pelski/ytzero/wiki/Authentication).
Some things are intentional and **not** considered vulnerabilities:

- **No authentication by default.** With the default **None** method, the app
  has no login and assumes anyone who can reach it is the owner. If you expose
  the app beyond your LAN, activate one of the supported authentication
  methods first (shared login, per-profile login, OIDC, or a trusted
  reverse-proxy header).
- **Trusting the reverse-proxy header method.** The **Proxy header** auth
  method trusts whatever value your reverse proxy sends — it is your
  responsibility to run it behind a proxy that always sets that header and
  strips any client-supplied copy. Header spoofing due to a misconfigured or
  missing proxy is a deployment issue, not an app vulnerability.
- **The `YTZERO_AUTH_DISABLE` escape hatch.** This environment variable forces
  the **None** method for recovery purposes and is documented in
  [Authentication](https://github.com/Pelski/ytzero/wiki/Authentication#recovery-anti-lockout).
  Leaving it set in production disables login by design — this is expected
  behavior, not a bug.
- **Outbound connections to YouTube and SponsorBlock.** The app fetches RSS
  feeds, metadata, thumbnails, pages, embedded videos, and (optionally)
  SponsorBlock segments. This is expected behaviour.
- **Local data storage.** App data lives unencrypted in a local SQLite database
  and an on-disk image cache under `./data`.

Things that **are** in scope and worth reporting:

- Remote code execution, SSRF, or path traversal in the backend.
- Cross-site scripting (XSS) or injection reachable through normal use.
- Leaking local data or making requests to unintended hosts.
- Vulnerabilities in how external/untrusted content (feeds, page data) is
  parsed or rendered.
- Authentication or session bypass in any of the supported login methods
  (Shared, Per-profile, OIDC, Proxy header), including WebAuthn/passkey
  handling and OIDC token/issuer validation.
- Privilege escalation between profiles (e.g. a non-admin profile gaining
  admin powers) or between OIDC-mapped identities.
