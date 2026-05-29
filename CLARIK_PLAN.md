# Clarik — Master Build Plan v3.0 (Final)

> Clarity and memory for Claude. One install.
> Claude Code builds everything marked 🤖. You build only what's marked 🧠.

---

## The Product

Clarik is an MCP server that installs into Claude Desktop and Claude Code in one command.
It silently fixes the 20 biggest problems developers have with Claude — memory, context,
quality, limits, and workflow.

```bash
npx clarik install
# Enter license key (optional — skip for free tier)
# ✅ Clarik active. Claude now remembers everything.
```

**The real moat is NOT the installer or tool count.**
**The real moat is: memory quality + intelligent context ranking + repo understanding + trust.**

---

## What You Build vs What Claude Code Builds

| 🧠 You decide | 🤖 Claude Code builds |
|--------------|----------------------|
| Memory schema design | All TypeScript source files |
| Trimming and ranking rules | MCP server boilerplate |
| License validation flow | File I/O and storage layer |
| Safe mode definitions | All 20 tool implementations |
| Pricing and Gumroad setup | Install script + CLI |
| README positioning | Test suite |
| Open-core boundary | Cross-platform path handling |
| | Compatibility safeguards |
| | Disclaimer display logic |

---

## File Structure

```
clarik/
├── CLARIK_PLAN.md               ← this file (your north star)
├── src/
│   ├── index.ts                 ← 🤖 MCP server entry point
│   ├── memory/
│   │   ├── learn.ts             ← 🤖 extract facts from conversations
│   │   ├── recall.ts            ← 🤖 ranked memory retrieval
│   │   ├── conflict.ts          ← 🤖 conflict resolution engine
│   │   ├── archive.ts           ← 🤖 active/archive memory management
│   │   └── project.ts           ← 🤖 project isolation by repo/workspace
│   ├── context/
│   │   ├── trim.ts              ← 🤖 ranked context trimmer
│   │   ├── compress.ts          ← 🤖 stale context summarizer
│   │   └── tokens.ts            ← 🤖 Anthropic-native token estimation
│   ├── checkpoint/
│   │   ├── save.ts              ← 🤖 structured checkpoint generator
│   │   └── resume.ts            ← 🤖 checkpoint loader
│   ├── license/
│   │   ├── validate.ts          ← 🤖 Gumroad validation + signed cache
│   │   └── grace.ts             ← 🤖 offline grace period (5 days)
│   ├── safety/
│   │   ├── modes.ts             ← 🤖 safe/strict/minimal/creative modes
│   │   └── repo_guard.ts        ← 🤖 protected file confirmation flow
│   ├── intelligence/
│   │   ├── file_map.ts          ← 🤖 file-to-purpose mapping
│   │   └── decision_timeline.ts ← 🤖 architectural decision tracker
│   ├── compat/
│   │   ├── transport.ts         ← 🤖 stdio-only transport, heartbeat
│   │   ├── platform.ts          ← 🤖 OS detection, Windows cmd/c wrapper
│   │   └── protocol.ts          ← 🤖 per-connection Protocol instances
│   └── tools/                   ← 🤖 all 20 MCP tool registrations
├── install.ts                   ← 🤖 one-command installer
├── package.json                 ← 🤖
├── tsconfig.json                ← 🤖
└── README.md                    ← 🤖
```

---

## The 4 Core Systems

Everything else is scaffolding. These 4 are the product.

---

### CORE 1 — Memory System
**The single most important feature. This is why people pay.**

#### Memory Schema
```typescript
interface MemoryFact {
  id: string
  category: "project" | "decision" | "gotcha" | "file" | "person"
  fact: string
  confidence: number        // 0.0 - 1.0
  timesReferenced: number
  createdAt: string         // ISO date
  lastUsed: string          // ISO date
  status: "active" | "deprecated" | "conflicting"
  projectId: string         // repo/workspace hash
  source: "user" | "assistant_final" // never from thinking blocks
}
```

#### Storage Structure
```
~/.clarik/
├── projects/
│   ├── {project_id}/
│   │   ├── active_memory.json     ← top facts, always loaded
│   │   ├── archive_memory.json    ← older facts, loaded on demand
│   │   └── file_map.json          ← file-to-purpose mapping
│   └── {project_id_2}/            ← completely isolated
├── checkpoints/
├── prompts.json
├── sessions/
├── license.json                   ← signed, hash-validated
└── config.json                    ← { disclaimerShown, mode, projectId }
```

#### Memory Rules (🧠 you define, 🤖 Claude Code implements)

**What to learn from:**
- Final assistant responses only
- User-confirmed facts ("yes", "exactly", "correct")
- Explicit decisions ("we decided", "let's use", "going with")

**What to NEVER learn from:**
- `<thinking>` blocks
- `<antml-thinking>` tags
- Chain-of-thought / scratchpad traces
- Speculative assistant guesses
- Anything before a user correction

**Extraction priorities:**
1. Stack and framework mentions
2. Explicit decisions with reasoning
3. File-to-purpose mappings
4. Gotchas and warnings
5. Architecture patterns

**Memory limits:**
- Active memory: 200 facts per project (ranked, not hard capped)
- Archive: unlimited, compressed summaries
- Eviction: lowest confidence + least recently used first

#### Memory Conflict Resolution
- New fact wins if confidence > 0.7 and existing fact > 30 days old
- Otherwise: mark both "conflicting", surface to user on next session
- Architectural decisions always override older ones automatically
- Never inject conflicting memories simultaneously

#### Project Isolation
```typescript
const projectId = hash(
  git_remote_url ||
  workspace_root_path ||
  package_json_name
)
// React project memories NEVER appear in Python project
```

---

### CORE 2 — Context & Retrieval System
**Makes Claude output 10x better. Reduces token cost 40-60%.**

#### Token Estimation
```typescript
// ALWAYS use Anthropic-native estimation
import { countTokens } from '@anthropic-ai/tokenizer'
// Never use tiktoken — causes incorrect thresholds
```

#### Memory Injection Budget
```
Total budget:         100,000 tokens
├── System memory:      4,000 tokens  (top-ranked facts only)
├── File map:           1,000 tokens  (relevant files only)
├── Current message:    2,000 tokens
├── Recent history:    20,000 tokens  (last 5 messages always)
├── Ranked history:    15,000 tokens  (scored by relevance)
├── File context:      50,000 tokens
└── Safety buffer:      8,000 tokens
```

#### Memory Ranking Algorithm
```
score = (relevance × 0.5) + (recency × 0.3) + (importance × 0.2)

relevance  = semantic similarity to current query
recency    = exponential decay from lastUsed date
importance = timesReferenced normalized 0-1
```
Inject only top-scoring facts. Never inject all memories blindly.

#### Context Compression
- Summarize messages older than 10 turns
- Always preserve: explicit decisions, accepted code, error resolutions
- Never summarize: last 3 messages, user-starred messages

---

### CORE 3 — Checkpoint System
**Solves "context fills up and you lose everything."**

#### Checkpoint Schema
```typescript
interface Checkpoint {
  id: string                    // chk_{date}_{hash}
  created: string               // ISO timestamp
  projectId: string
  goal: string
  progress: string[]
  decisions: string[]
  nextStep: string
  openFiles: string[]
  openQuestions: string[]
  contextUsedPct: number
}
```

#### Checkpoint Triggers
- At 70% context: auto-generate checkpoint silently
- At 85%: warn user, offer fresh session with checkpoint loaded
- Manual: `/checkpoint` anytime

---

### CORE 4 — License & Safety System

#### License Validation (Hardened)
```typescript
interface LicenseCache {
  signedResponse: string      // raw Gumroad response
  responseHash: string        // SHA-256 of response
  validUntil: string          // ISO date
  offlineGraceExpiry: string  // 5 days from last valid check
}
// NEVER store { "valid": true } — trivially bypassable
```

#### Offline Grace Period
- 5 days offline allowed after last successful validation
- Shown to user: "Offline mode — X days remaining"
- Never blocks work during grace period

#### Safe Modes
```
Safe Mode     → default. Guards active, memory on, checkpoints on
Strict Mode   → repo_guard blocks require confirmation, no assumptions
Minimal Mode  → memory off, context trim only, maximum privacy
Creative Mode → guards relaxed, wider scope, experimental
```

#### repo_guard (Confirmation, NOT hard blocking)
```
Claude wants to edit: migrations/001_users.sql
→ "⚠️  This file is protected (migrations).
    Allow this change? [y/N]"
→ User confirms → change allowed + logged
→ User denies  → change skipped + explained
```
Protected by default: `migrations/`, `.env*`, `*secrets*`,
`.github/workflows/`, production configs.

---

## Compatibility System
**Every known MCP incompatibility — handled automatically.**

### The 7 Risks & Fixes

| Risk | Severity | Fix |
|------|----------|-----|
| Protocol instance reuse | 🔴 Critical | New Protocol instance per connection |
| Claude Code config path | 🔴 Critical | Write to BOTH config locations |
| Windows stdio wrapper | 🔴 Critical | `cmd /c` wrapper on win32 |
| Auto-reconnect broken | 🟡 Medium | 30s heartbeat ping |
| Tool name conflicts | 🟡 Medium | Prefix ALL tools with `clarik_` |
| macOS beta disconnect | 🟡 Medium | OS version check + warning |
| SSE incompatibility | 🟡 Medium | stdio only, never SSE/HTTP |

### Implementation

```typescript
// platform.ts — OS-aware command builder
export function buildCommand(serverPath: string) {
  if (process.platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'node', serverPath] }
  }
  return { command: 'node', args: [serverPath] }
}

// protocol.ts — fresh instance per connection (never reuse)
export function createProtocol() {
  return new Protocol() // always new, never shared
}

// transport.ts — heartbeat to prevent disconnect
setInterval(() => {
  server.ping().catch(() => process.exit(0))
}, 30000)
```

### Config Paths Written by Installer

```typescript
const CONFIG_PATHS = {
  claudeDesktop: {
    darwin:  '~/Library/Application Support/Claude/claude_desktop_config.json',
    win32:   '%APPDATA%/Claude/claude_desktop_config.json',
    linux:   '~/.config/Claude/claude_desktop_config.json'
  },
  claudeCode: {
    // written via: claude mcp add clarik node /path/to/clarik/index.js
  }
}
```

---

## Token Cost & Savings

### Current API Pricing (May 2026)
| Model | Input | Output |
|-------|-------|--------|
| Claude Haiku 4.5 | $1.00/M | $5.00/M |
| Claude Sonnet 4.6 | $3.00/M | $15.00/M |
| Claude Opus 4.7 | $5.00/M | $25.00/M |

### Without Clarik — Typical Developer Month
| | Tokens | Cost (Sonnet 4.6) |
|--|--------|-------------------|
| Input (context repeated) | 800k/session | $2.40 |
| Output | 100k/session | $1.50 |
| Per session | 900k | $3.90 |
| Per month (20 days) | 18M | **$78/mo** |

### With Clarik — Same Workflow
| Saving source | Reduction | Monthly saving |
|---------------|-----------|----------------|
| Context trimming | -60% input | $47/mo |
| Prompt caching on memory | -90% cached input | $16/mo |
| Fewer wasted tokens | fewer lost sessions | $10/mo |
| **Total saving** | | **$73/mo** |

### The Value Proposition
```
Clarik costs $20 once.
Saves $73/month on API costs.
Pays for itself in 8 days.
```

### Show Inside Installer (after install completes)
```
💰 Token Savings
   Average developer saves $47–73/month
   on Claude API costs with Clarik.

   At $3/M input tokens (Sonnet 4.6):
   • Without Clarik: ~$78/month
   • With Clarik:    ~$5–31/month
   • You save:       ~$47–73/month

   Clarik Pro ($20 lifetime) pays for
   itself in under 8 days of API usage.

   Unlock all 20 tools → https://clarik.dev/pro
```

---

## First-Run Install Experience

```bash
$ npx clarik install

╔═══════════════════════════════════════╗
║           Welcome to Clarik           ║
║   Clarity and memory for Claude.      ║
╚═══════════════════════════════════════╝

✅ Detected: Claude Desktop
✅ Detected: Claude Code
✅ Checking compatibility...
✅ Installing Clarik...
✅ Done. Clarik is active.

─────────────────────────────────────────
  DISCLAIMER (shown once)

  Clarik is an independent tool.
  Not affiliated with Anthropic PBC.
  Claude® is a trademark of Anthropic PBC.
  Token savings are estimates. Results vary.
  Full terms: https://clarik.dev/terms
─────────────────────────────────────────

  FREE TIER ACTIVE  (8 of 20 tools)

  💰 Clarik saves developers $47–73/month
     on Claude API costs.

  Unlock all 20 tools for $20 lifetime:
  → https://clarik.dev/pro

  Already have a key?
  → npx clarik activate YOUR-KEY

─────────────────────────────────────────

Open Claude and start chatting.
Clarik is already working in the background.
```

Disclaimer shown ONCE. Stored as `disclaimerShown: true` in config.json. Never shown again.

---

## When Hitting a Pro Tool (No Key)

```
⚡ clarik_project_index is a Pro feature.

   Unlock all 20 tools → https://clarik.dev/pro ($20 lifetime)
   Activate your key  → npx clarik activate YOUR-KEY

   (Free tier includes 8 tools — no key needed)
```

One message. One link. Never repeated in same session.

---

## Key CLI Commands

```bash
npx clarik install          # install into Claude Desktop + Claude Code
npx clarik activate KEY     # unlock Pro tools with license key
npx clarik status           # show plan, tools, savings, grace period
npx clarik upgrade          # open clarik.dev/pro in browser
npx clarik uninstall        # clean removal from all configs
```

---

## Disclaimer — All 3 Locations

### 1. CLI (first install only)
```
Clarik is an independent tool. Not affiliated with,
endorsed by, or associated with Anthropic PBC.
Claude® is a trademark of Anthropic PBC.
Token savings are estimates. Results may vary.
Terms: https://clarik.dev/terms
```

### 2. README.md (bottom)
```markdown
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
```

### 3. clarik.dev/terms (simple page)
```
1. Not affiliated with Anthropic PBC
2. No warranty — provided as-is
3. Savings estimates are not guarantees
4. Your data stays on your device
5. You own your memory files
6. License is personal, non-transferable
7. Contact support within 7 days for refund exceptions
```

---

## All 20 Tools

### Free Tools (no license key)
| # | Tool name | What it does |
|---|-----------|-------------|
| 1 | `clarik_memory_learn` | Extract facts, strip thinking blocks |
| 2 | `clarik_memory_recall` | Ranked memory injection for query |
| 3 | `clarik_memory_list` | Show all memories for project |
| 4 | `clarik_memory_edit` | Update a specific memory fact |
| 5 | `clarik_memory_clear` | Clear by category or all |
| 6 | `clarik_context_trim` | Ranked trimmer with token budget |
| 7 | `clarik_checkpoint_save` | Generate structured checkpoint |
| 8 | `clarik_checkpoint_resume` | Load checkpoint into context |

### Pro Tools ($20 lifetime / $8/mo)
| # | Tool name | What it does |
|---|-----------|-------------|
| 9 | `clarik_project_index` | File map + architecture understanding |
| 10 | `clarik_token_monitor` | Live token usage, warns at 70% |
| 11 | `clarik_memory_archive` | Move stale facts, keep active lean |
| 12 | `clarik_conflict_resolver` | Surface + resolve memory conflicts |
| 13 | `clarik_change_scope_guard` | Confirm before touching protected files |
| 14 | `clarik_assumption_checker` | Flag when Claude assumes vs asks |
| 15 | `clarik_diff_reviewer` | Structured diff with explanations |
| 16 | `clarik_hallucination_detector` | Cross-check claims vs scoped files |
| 17 | `clarik_decision_timeline` | Track + query architectural decisions |
| 18 | `clarik_prompt_library` | Save and retrieve reusable prompts |
| 19 | `clarik_session_search` | Full-text search past sessions |
| 20 | `clarik_export_session` | Export to ./clarik-exports/ |

---

## Intelligence Layer (The Moat)

### File-to-Purpose Mapping
```json
{
  "lib/auth.ts": "JWT authentication, session management",
  "lib/billing.ts": "Stripe subscriptions and webhooks",
  "middleware.ts": "Auth routing, rate limiting",
  "prisma/schema.prisma": "Database schema, all models"
}
```

### Decision Timeline
```json
{
  "decisions": [
    {
      "date": "2026-03-01",
      "decision": "Moved from Pages Router to App Router",
      "reason": "Better server components support",
      "affectedFiles": ["app/", "pages/ (deleted)"]
    }
  ]
}
```

---

## Claude Code Build Prompts

Feed Claude Code this entire file first. Then use prompts in order.

---

### Prompt 0 — Global Engineering Rules
**Prepend to EVERY prompt below. No exceptions.**

```
Global rules for the entire Clarik codebase:

TOKENS:
1. ALWAYS use @anthropic-ai/tokenizer for token counting.
   NEVER use tiktoken. Ever.

MEMORY:
2. ALWAYS strip <thinking>, <antml-thinking>, and scratchpad
   blocks before any memory extraction.
3. NEVER learn from speculative or chain-of-thought content.

LICENSE:
4. NEVER store { "valid": true } in license cache.
   ALWAYS store signed Gumroad response + SHA-256 hash.

FILESYSTEM:
5. ALWAYS use Node path utilities (path.join, os.homedir()).
   NEVER hardcode ~/ or platform-specific separators.
6. Export paths: ALWAYS ./clarik-exports/ — NEVER ~/Downloads.

MCP COMPATIBILITY:
7. Transport: ALWAYS stdio. NEVER SSE or HTTP.
8. Tool names: ALWAYS prefix with clarik_ (prevents conflicts).
9. Protocol: ALWAYS create new Protocol() per connection.
   NEVER reuse a Protocol instance.
10. Windows: ALWAYS wrap stdio with cmd /c on win32 platform.
11. Heartbeat: ALWAYS add 30s ping to keep connection alive.

SAFETY:
12. NEVER crash the MCP server on tool error.
    Always catch, log to stderr, return friendly error.
13. repo_guard: ALWAYS ask for confirmation. NEVER hard block.

DISCLAIMER:
14. Show disclaimer text ONCE on first install only.
    Store disclaimerShown: true in config.json after showing.
```

---

### Prompt 1 — Project Setup
```
Apply ALL rules from Prompt 0.
Read CLARIK_PLAN.md fully. Then:
1. Create TypeScript MCP server project
2. Dependencies: @modelcontextprotocol/sdk @anthropic-ai/tokenizer
3. Set up tsconfig.json, package.json
4. Create exact folder structure from CLARIK_PLAN.md
5. Create placeholder files for all 20 tools
6. Compile with zero errors
```

### Prompt 2 — Memory Core
```
Apply ALL rules from Prompt 0.
Read CLARIK_PLAN.md CORE 1. Build full memory system:
1. MemoryFact interface exactly as defined
2. learn.ts: extract facts, strip thinking blocks, respect source rules
3. recall.ts: score = relevance×0.5 + recency×0.3 + importance×0.2
4. conflict.ts: detect contradictions, apply resolution rules
5. archive.ts: active (200 facts) / archive split with compression
6. project.ts: project isolation using repo/workspace hash
7. Storage: ~/.clarik/projects/{project_id}/
8. Full TypeScript types, error handling, unit tests
```

### Prompt 3 — Context & Token System
```
Apply ALL rules from Prompt 0.
Read CLARIK_PLAN.md CORE 2. Build context system:
1. tokens.ts: Anthropic-native token counting only
2. trim.ts: ranked trimmer with exact budget from plan
3. compress.ts: summarize old history, preserve decisions
4. Inject only top-scored memories, never all
5. Full TypeScript types, error handling, unit tests
```

### Prompt 4 — Checkpoint System
```
Apply ALL rules from Prompt 0.
Read CLARIK_PLAN.md CORE 3. Build checkpoint system:
1. Checkpoint interface exactly as defined
2. save.ts: structured checkpoint, auto-trigger at 70%
3. resume.ts: load and format for injection
4. Storage: ~/.clarik/checkpoints/
5. Full TypeScript types, error handling, unit tests
```

### Prompt 5 — License & Safety
```
Apply ALL rules from Prompt 0.
Read CLARIK_PLAN.md CORE 4. Build license and safety:
1. LicenseCache: signed response + SHA-256 (never plain valid:true)
2. 5-day offline grace period with countdown
3. validate.ts: full Gumroad validation flow
4. modes.ts: Safe/Strict/Minimal/Creative implementations
5. repo_guard.ts: confirmation flow, never hard block
6. Free tools: clarik_memory_* and clarik_context_trim and clarik_checkpoint_*
7. Pro check wrapper for tools 9-20
8. Full TypeScript types, error handling, unit tests
```

### Prompt 6 — Compatibility Layer
```
Apply ALL rules from Prompt 0.
Read CLARIK_PLAN.md Compatibility System. Build compat/:
1. transport.ts: stdio only, 30s heartbeat ping
2. platform.ts: OS detection, cmd /c on win32, path utilities
3. protocol.ts: factory that always returns new Protocol()
4. installer detects macOS beta and warns user
5. All tools prefixed clarik_ (verify in index.ts)
6. Full cross-platform tests: Mac, Windows, Linux
```

### Prompt 7 — Intelligence Layer
```
Apply ALL rules from Prompt 0.
Read CLARIK_PLAN.md Intelligence Layer. Build:
1. file_map.ts: auto-learn file-to-purpose, store per project
2. decision_timeline.ts: track decisions with date/reason/files
3. Both use project isolation
4. Full TypeScript types, error handling, unit tests
```

### Prompt 8 — All 20 Tools
```
Apply ALL rules from Prompt 0.
Read CLARIK_PLAN.md tool tables. Implement all 20 tools:
1. All tools prefixed clarik_
2. Tools 1-8: free, no license check
3. Tools 9-20: Pro check wrapper first
4. clarik_hallucination_detector: targeted file list only, never full repo scan
5. clarik_export_session: ./clarik-exports/ only, never ~/Downloads
6. clarik_token_monitor: warn at 70%, not 100%
7. Register all in index.ts
8. No tool can crash MCP server — wrap everything in try/catch
```

### Prompt 9 — Install Script
```
Apply ALL rules from Prompt 0.
Build install.ts (npx clarik install):
1. Detect OS with platform.ts utilities
2. Write to Claude Desktop config (OS-specific path)
3. Write to Claude Code config (claude mcp add)
4. Create ~/.clarik/ directory structure
5. Show disclaimer ONCE, store disclaimerShown: true
6. Show token savings estimate
7. Show upgrade link: https://clarik.dev/pro
8. Ask for license key (optional, skip for free tier)
9. Validate key if provided, show tools unlocked
10. Warn if macOS beta detected
11. Handle all errors with helpful messages
```

### Prompt 10 — Purchase Flow & CLI Commands
```
Apply ALL rules from Prompt 0.
Build full CLI and purchase flow:
1. npx clarik activate KEY → validate + unlock Pro + confirm
2. npx clarik status → plan, tools unlocked, savings, grace days
3. npx clarik upgrade → open clarik.dev/pro in default browser
4. npx clarik uninstall → clean removal from all configs
5. When Pro tool called without key:
   - One friendly message
   - One link: clarik.dev/pro
   - One activate command shown
   - Never repeat in same session
6. Never be aggressive. One clear moment, then silence.
```

### Prompt 11 — README
```
Apply ALL rules from Prompt 0.
Write README.md:
1. Tagline: "Clarity and memory for Claude. One install."
2. Install: npx clarik install (one line)
3. All 20 tools in plain English
4. Free vs Pro table
5. Token savings section with real numbers
6. Purchase: clarik.dev/pro ($20 lifetime)
7. Safe modes explained simply
8. FAQ: "Does it send my code anywhere?" → No. Local only.
9. Compatibility: Mac / Windows / Linux
10. Troubleshooting section
11. Legal disclaimer section (full text from CLARIK_PLAN.md)
Make it feel premium. Developers install based on README quality.
```

### Prompt 12 — Final Review
```
Apply ALL rules from Prompt 0.
Full codebase audit. Verify every item:

TOKENS:    @anthropic-ai/tokenizer everywhere. Zero tiktoken.
MEMORY:    Thinking blocks stripped before ALL memory operations.
LICENSE:   Signed + SHA-256 cache. Zero plain { valid: true }.
PATHS:     path.join/os.homedir() everywhere. Zero hardcoded ~/.
TRANSPORT: stdio only. Zero SSE/HTTP.
TOOLS:     All 20 prefixed clarik_. Zero name conflicts.
PROTOCOL:  new Protocol() per connection. Zero reuse.
WINDOWS:   cmd /c wrapper on win32. Zero bare node calls.
HEARTBEAT: 30s ping active. Zero idle disconnects.
SAFETY:    Zero unhandled throws. Every tool wrapped in try/catch.
GUARD:     repo_guard asks confirmation. Zero hard blocks.
DISCLAIMER:Shown once. Stored in config. Zero repeat.
EXPORTS:   ./clarik-exports/. Zero ~/Downloads.
PURCHASE:  One message, one link per session. Zero spam.

Fix everything that fails. Then: zero TypeScript errors, all tests pass.
```

---

## Open-Core Strategy

**Open source (GitHub — builds trust and installs):**
- MCP server plumbing
- Installer and CLI
- Free tools 1-8
- Basic memory schema

**Proprietary (protects the moat):**
- Memory ranking algorithm
- Conflict resolution engine
- Context scoring system
- Intelligence layer
- Pro tools 9-20

---

## Monetization

### Pricing
| Tier | Price | Who |
|------|-------|-----|
| Free | $0 | Anyone, forever |
| Pro Lifetime | $20 | First 200 users (launch only) |
| Pro Monthly | $8/mo | After launch spike ends |
| Team | $12/mo | Up to 5 devs, shared memory |

### Gumroad Setup (2 hours, no code)
1. gumroad.com → New Product → "Clarik Pro"
2. Enable: "Generate unique license keys"
3. $20 one-time + $8/mo subscription (two products)
4. Note Product ID → add to validate.ts
5. Set: "CLARIK-XXXX-XXXX-XXXX" key format

### Distribution — Submit to ALL
- NPM registry (`npm publish`)
- anthropic/claude-plugins-community
- mcpmarket.com
- glama.ai/mcp/servers
- mcp.so
- Product Hunt (launch day)

Servers on 5+ directories get 10x more installs.

---

## Launch Sequence

```
Week 1-2:  Prompts 1-5  → Memory, context, checkpoints, license
Week 3:    Prompts 6-7  → Compatibility + intelligence layer
Week 4:    Prompts 8-9  → All 20 tools + install script
Week 5:    Prompts 10-11 → Purchase flow + README
Week 6:    Prompt 12    → Final audit, test Mac/Win/Linux
Week 7:    Gumroad + GitHub public + NPM publish
Week 8:    Post: Reddit r/ClaudeAI, r/LocalLLaMA, HackerNews, X
           "$20 lifetime — first 200 users only. Ends when sold out."
Week 9+:   Switch to $8/mo. Respond to issues. Ship improvements.
```

---

## Success Metrics

| Metric | Week 8 | Month 3 | Month 6 |
|--------|--------|---------|---------|
| GitHub stars | 200 | 1,000 | 3,000 |
| Installs | 500 | 3,000 | 10,000 |
| Pro users | 50 | 200 | 600 |
| Revenue | $1,000 | $3,000 | $8,000/mo |

---

## The Real Moat

The moat is NOT:
- Having 20 tools
- A nice installer
- MCP integration

The moat IS:
- **Memory quality** — what gets learned, what gets ignored
- **Intelligent ranking** — what gets injected, what stays archived
- **Repo understanding** — knowing the codebase like a senior dev
- **Trust** — safe modes, repo guard, never touching what you didn't ask
- **Continuity** — picking up exactly where you left off, forever

That is what makes Clarik irreplaceable.

---

## The One Rule

> **Claude Code builds the code. You make the decisions.**
>
> Feed Claude Code this entire file before every prompt.
> Your job is product direction and the 4 core system designs.
> Every line of code is Claude Code's job.
> Nothing else.
