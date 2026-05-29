# Security & Privacy Policy

We take the security and privacy of your local workstation, source code, and API keys extremely seriously. Because Clarik operates locally as a developer companion, we enforce strict boundaries to protect your system.

---

## 1. Local-First Privacy Guarantee

Clarik is designed with **zero-telemetry, local-first privacy**:
* 🔒 **Local Data Only**: All memory facts (`active_memory.json`, `archive_memory.json`), checkpoints, prompts, and file maps are stored completely locally in your system's user directory (`~/.clarik/`).
* 🌐 **No Cloud Sync or Telemetry**: Clarik does **not** run an analytics server, tracking telemetry, or cloud database synchronization. No data is transmitted to our servers.
* 📦 **Your API Keys**: Claude processes model context using **your own Anthropic API keys**. Clarik never intercepts, stores, or forwards your API tokens.
* 🔑 **License Checks**: License checks are the only network calls made by Clarik (contacting Gumroad API once every 24 hours to renew your Pro keys).

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability or bug that affects local memory safety, sandbox isolation, or license integrity, please do **not** open a public GitHub issue. 

Instead, report it directly to our security response team:
* ✉️ **Email**: `security@clarik.dev`
* 🕒 **Response SLA**: We review and acknowledge all critical security reports within **24 hours**.

Please include in your report:
1. A detailed description of the vulnerability.
2. Steps or a proof-of-concept script to reproduce the issue.
3. System details (OS version, Claude version, Clarik version).

---

## 3. Safe Mode Boundaries

Clarik includes **Safe Modes** (`src/safety/modes.ts`) and **Repo Guard** (`src/safety/repo_guard.ts`) to prevent AI agents from executing destructive file modifications without your knowledge. 

If you are working on highly sensitive repositories, production configurations, or database migration files, we highly recommend switching to **Strict Mode**:
```bash
# Switch safety mode to Strict
npx clarik status
```
In Strict Mode, any attempts to modify critical paths will be intercepted and require your explicit, manual terminal confirmation before any modifications are executed.
