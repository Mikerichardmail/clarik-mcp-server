<div align="center">

# ✨ Clarik

### Clarity and memory for Claude. One install.

[![NPM Version](https://img.shields.io/npm/v/clarik?style=flat-square&color=7c3aed)](https://npmjs.com/package/clarik)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Mac%20%7C%20Windows%20%7C%20Linux-brightgreen?style=flat-square)](https://clarik.dev)

**Claude forgets everything between sessions. Clarik fixes that.**

Memory that persists · Context that stays lean · Sessions that never die

[Get Started](#-quick-start) · [All 20 Tools](#-all-20-tools) · [How It Saves You Money](#-token-savings) · [Go Pro](https://clarik.dev/pro)

</div>

---

## 🚀 Quick Start

```bash
npx clarik install
```

That's it. Clarik detects Claude Desktop and Claude Code, configures both,
and starts working silently in the background.

```
╔═══════════════════════════════════════╗
║           Welcome to Clarik           ║
║   Clarity and memory for Claude.      ║
╚═══════════════════════════════════════╝

✅ Detected: Claude Desktop
✅ Detected: Claude Code
✅ Checking compatibility...
✅ Done. Clarik is active.
```

Open Claude and start chatting. Clarik remembers everything.

---

## 💡 What It Does

Clarik is an [MCP server](https://modelcontextprotocol.io) that silently fixes the biggest problems developers have with Claude:

| Problem | How Clarik Fixes It |
|---------|-------------------|
| 🧠 Claude forgets everything between sessions | **Persistent memory** — facts, decisions, and gotchas survive forever |
| 📄 Context fills up and quality drops | **Intelligent injection** — only the most relevant memories are loaded |
| 💸 Repeating context wastes tokens | **Token optimization** — saves $47–73/month on API costs |
| 🔄 Lost progress when context fills up | **Checkpoints** — save and resume exactly where you left off |
| 🗂️ Memories from one project leak into another | **Project isolation** — each repo has its own memory space |
| ⚠️ Claude edits files it shouldn't | **Repo guard** — protected files require your confirmation |
| 🤔 Claude assumes instead of asking | **Assumption checker** — flags unverified claims |

---

## 🔧 All 20 Tools

### Free Tools (no license needed)

| Tool | What It Does |
|------|-------------|
| `clarik_memory_learn` | Extract and store facts from conversations. Strips thinking blocks. |
| `clarik_memory_recall` | Retrieve relevant memories ranked by relevance, recency, and importance. |
| `clarik_memory_list` | Show all memories for the current project. |
| `clarik_memory_edit` | Update a specific memory fact. |
| `clarik_memory_clear` | Clear memories by category or all. |
| `clarik_context_trim` | Intelligent memory injection within a token budget. |
| `clarik_checkpoint_save` | Save a structured snapshot of your session state. |
| `clarik_checkpoint_resume` | Resume from a checkpoint — pick up exactly where you left off. |

### Pro Tools ($20 lifetime)

| Tool | What It Does |
|------|-------------|
| `clarik_project_index` | File-to-purpose map — Claude understands your entire codebase. |
| `clarik_token_monitor` | Live token usage tracking. Warns at 70% context. |
| `clarik_memory_archive` | Move stale memories to archive. Keeps active memory fast. |
| `clarik_conflict_resolver` | Surface and resolve contradicting memories. |
| `clarik_change_scope_guard` | Protected file confirmation before edits. |
| `clarik_assumption_checker` | Flag when Claude assumes instead of asking. |
| `clarik_diff_reviewer` | Structured diff review with explanations. |
| `clarik_hallucination_detector` | Cross-check claims against your actual code. |
| `clarik_decision_timeline` | Track architectural decisions with dates and reasons. |
| `clarik_prompt_library` | Save and reuse prompt templates. |
| `clarik_session_search` | Full-text search across past sessions. |
| `clarik_export_session` | Export session data as JSON or Markdown. |

---

## 💰 Token Savings

Clarik's intelligent memory injection means Claude processes fewer redundant tokens.

### Real Numbers (Sonnet 4.6 at $3/M input tokens)

| | Without Clarik | With Clarik |
|--|---------------|-------------|
| Input tokens/session | ~800K | ~320K |
| Cost per session | ~$3.90 | ~$1.50 |
| **Monthly cost (20 days)** | **~$78/mo** | **~$5–31/mo** |
| **Monthly savings** | — | **$47–73/mo** |

```
Clarik Pro costs $20 once.
Saves $47–73/month.
Pays for itself in 8 days.
```

---

## 🏷️ Pricing

| Tier | Price | What You Get |
|------|-------|-------------|
| **Free** | $0 forever | 8 core tools — memory, context, checkpoints |
| **Pro Lifetime** | $20 | All 20 tools. One payment. Forever. |
| **Pro Monthly** | $8/mo | All 20 tools. Cancel anytime. |

<p align="center">
  <a href="https://clarik.dev/pro"><strong>→ Get Clarik Pro</strong></a>
</p>

Already have a key?

```bash
npx clarik activate YOUR-KEY
```

---

## 🛡️ Safe Modes

Clarik includes four safety modes to match your workflow:

| Mode | Memory | Guards | Best For |
|------|--------|--------|----------|
| **Safe** (default) | ✅ On | ✅ Active | Normal development |
| **Strict** | ✅ On | 🔒 Confirm all | Production code, sensitive repos |
| **Minimal** | ❌ Off | ❌ Off | Maximum privacy, quick tasks |
| **Creative** | ✅ On | 🟡 Relaxed | Prototyping, exploration |

---

## 🖥️ CLI Commands

```bash
npx clarik install          # Install into Claude Desktop + Claude Code
npx clarik activate KEY     # Unlock Pro tools with license key
npx clarik status           # Show plan, tools, savings, grace period
npx clarik upgrade          # Open clarik.dev/pro in browser
npx clarik uninstall        # Clean removal from all configs
```

---

## 🔒 Privacy & Data

**Your data never leaves your machine.**

- All memory stored locally in `~/.clarik/`
- No telemetry, no analytics server, no cloud sync
- No data transmitted except to Anthropic's API using **your own API key**
- You own your memory files — they're plain JSON you can read, edit, or delete
- License validation is the only network call (Gumroad, once per 24 hours)

---

## ❓ FAQ

### Does Clarik send my code anywhere?
**No.** Everything stays on your machine. Clarik stores memories as local JSON files.
The only network request is license validation via Gumroad (Pro users, once/day).

### Does it work with Claude Desktop and Claude Code?
**Yes.** The installer detects and configures both automatically.

### What happens when my context fills up?
Clarik can save a **checkpoint** of your current session — goal, progress, decisions,
next steps. Start a fresh session and resume instantly with `clarik_checkpoint_resume`.

### Can I use it offline?
**Yes.** Free tools work offline always. Pro tools have a 5-day offline grace period
after your last successful license check.

### Does it work on Windows?
**Yes.** Full Windows support with automatic `cmd /c` wrapper for stdio compatibility.
Also works on macOS and Linux.

### Will it conflict with other MCP servers?
**No.** All tools are prefixed with `clarik_` to prevent naming conflicts.

### Can I see what Clarik has memorized?
**Yes.** Use `clarik_memory_list` to see all stored memories, or browse the JSON
files directly in `~/.clarik/projects/`.

### How do I delete my data?
```bash
npx clarik uninstall        # Remove from Claude configs
rm -rf ~/.clarik/           # Delete all stored data
```

---

## 🔧 Compatibility

| Platform | Status |
|----------|--------|
| macOS | ✅ Fully supported |
| Windows | ✅ Fully supported (cmd /c wrapper) |
| Linux | ✅ Fully supported |
| Claude Desktop | ✅ Auto-configured |
| Claude Code | ✅ Auto-configured |

### Known Issues

- **macOS beta**: MCP connections may be unstable on macOS beta releases.
  The installer will warn you if a beta version is detected.
- **Transport**: Clarik uses stdio transport only. SSE and HTTP transports
  are not supported due to known MCP compatibility issues.

---

## 🔍 Troubleshooting

### Clarik tools don't appear in Claude

1. Make sure the install completed successfully: `npx clarik status`
2. Restart Claude Desktop / Claude Code
3. Check that the MCP config file was written correctly:
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

### "Connection lost" or frequent disconnects

Clarik includes a 30-second heartbeat ping to keep the connection alive.
If you still experience disconnects:
1. Update Claude Desktop to the latest version
2. Avoid macOS beta releases if possible
3. Check `~/.clarik/` directory permissions

### License activation fails

1. Check your internet connection
2. Verify the key format: `CLARIK-XXXX-XXXX-XXXX`
3. Try again — Gumroad's API occasionally has brief outages
4. Pro tools work offline for 5 days after last successful check

---

## 📊 How Memory Works

### What Clarik Learns
- ✅ Stack and framework choices ("We're using Next.js 14 with App Router")
- ✅ Architectural decisions ("Moved from REST to tRPC")
- ✅ File purposes ("lib/auth.ts handles JWT and sessions")
- ✅ Gotchas and warnings ("Don't use the v2 API — it's broken")
- ✅ User-confirmed facts

### What Clarik Never Learns
- ❌ Thinking blocks (`<thinking>`, `<antml-thinking>`)
- ❌ Chain-of-thought traces
- ❌ Speculative guesses
- ❌ Content before a user correction

### Memory Ranking

When recalling memories, Clarik scores each fact:

```
score = (relevance × 0.5) + (recency × 0.3) + (importance × 0.2)
```

Only the highest-scoring facts are injected into context — never everything at once.

### Project Isolation

Each project gets its own memory space, derived from:
```
git remote URL → workspace root → package.json name
```

React project memories never appear in your Python project.

---

## Legal

Clarik is an independent, community-built tool.
It is not affiliated with, endorsed by, or associated
with Anthropic PBC in any way.

Claude® is a registered trademark of Anthropic PBC.
All references to Claude, Claude Desktop, and Claude Code
are for compatibility identification purposes only.

Token cost savings are estimates based on typical developer
usage patterns. Actual savings depend on your workflow,
model choice, and usage volume.

Clarik stores all data locally on your device.
No data is transmitted to any server except the Anthropic
API using your own API key.

Provided as-is without warranty of any kind.

Full terms: [https://clarik.dev/terms](https://clarik.dev/terms)

---

<div align="center">

**Built for developers who use Claude every day.**

[Get Started](https://npmjs.com/package/clarik) · [Go Pro](https://clarik.dev/pro) · [Report Issues](https://github.com/clarik-dev/clarik/issues)

</div>
