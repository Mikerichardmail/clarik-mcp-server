# Contributing to Clarik

We are excited that you want to contribute to Clarik! As a premium, local-first open-core MCP server, we hold our code, documentation, and safety standards to a very high level. 

Follow this guide to set up your development environment, understand our design decisions, and submit successful Pull Requests.

---

## 1. Development Setup

Clarik requires **Node.js (>= 18.0.0)** and **npm**.

### Clone and Setup
```bash
# 1. Clone the repository
git clone https://github.com/YOUR-USERNAME/clarik.git
cd clarik

# 2. Install dependencies
npm install

# 3. Build the server
npm run build
```

### Run Locally (Watch Mode)
While working, run the watch compiler to automatically build your TypeScript changes:
```bash
npm run dev
```

---

## 2. Codebase Guidelines & Standards

To ensure safety, cross-platform compatibility, and optimal performance, all contributions must respect the following rules:

### Standard I/O Constraints
* 🚫 **Never use `console.log`** in server modules or tool handlers. Clarik uses standard input/output (`stdio`) to communicate with Claude via JSON-RPC. A random `console.log` will corrupt the communication stream and disconnect the server.
* ✅ **Always use `console.error`** for logging messages, diagnostics, or warning traces. Claude captures standard error and redirects it safely to log files.

### Cross-Platform Path Rules
* 🚫 **Never hardcode `/` or `\` paths**, and never use `~/` directly.
* ✅ **Always use standard Node path utilities** (such as `path.join`, `path.resolve`, `os.homedir()`) to make sure memory directories load successfully on Windows, macOS, and Linux.

### Dependency Management
* 🚫 **Never introduce large dependencies** that bloat startup time. MCP servers are spawned on-demand and must start in under **100ms**.
* ✅ Keep additions restricted to lightweight, native, or highly optimized libraries.

---

## 3. Creating a Pull Request

1. **Create a branch** off of `main`:
   ```bash
   git checkout -b feat/your-awesome-feature
   ```
2. **Implement your changes**: Keep your code clean, functional, and well-typed.
3. **Verify the build compiles successfully**:
   ```bash
   npm run build
   ```
4. **Commit your work**: Use clear, concise commit messages:
   ```bash
   git commit -m "feat(memory): add support for custom category tagging"
   ```
5. **Push and open a Pull Request** against our `main` branch.

---

## 4. Open-Core Code Boundary

Clarik is built on an open-core architecture:
* **Open Source** (Contributable): MCP plumbing, stdio transports, OS compatibility layers, safety modes, CLI commands, and the core 8 Free tools (`clarik_memory_*`, `clarik_checkpoint_*`, and `clarik_context_trim`).
* **Proprietary Moat** (Closed Source): Advanced semantic ranking scores, conflict resolution heuristics, local license validation flows, and Pro tools 9-20.

If your proposed change intersects with the proprietary layer, open an issue first to discuss the design before writing code!
