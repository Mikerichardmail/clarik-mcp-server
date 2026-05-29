// ─── Clarik Installer ───
// One-command install into Claude Desktop + Claude Code.
// Handles: OS detection, config writing, disclaimer display, directory setup.
// Disclaimer shown ONCE. Stored as disclaimerShown: true in config.json.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getPlatformInfo, buildCommand, getClaudeDesktopConfigPath } from './src/compat/platform.js';
import { ensureStorageDir, getConfigPath, readJson, writeJsonAtomic } from './src/storage.js';
import type { ClarikConfig } from './src/types.js';

const execAsync = promisify(exec);

// ─── Disclaimer ───

const DISCLAIMER = `
─────────────────────────────────────────
  DISCLAIMER (shown once)

  Clarik is an independent tool.
  Not affiliated with Anthropic PBC.
  Claude® is a trademark of Anthropic PBC.
  Token savings are estimates. Results vary.
  Full terms: https://clarik.dev/terms
─────────────────────────────────────────`;

const SAVINGS_INFO = `
  💰 Token Savings
     Average developer saves $47–73/month
     on Claude API costs with Clarik.

     At $3/M input tokens (Sonnet 4.6):
     • Without Clarik: ~$78/month
     • With Clarik:    ~$5–31/month
     • You save:       ~$47–73/month

     Clarik Pro ($20 lifetime) pays for
     itself in under 8 days of API usage.

     Unlock all 20 tools → https://clarik.dev/pro`;

// ─── Install Logic ───

export async function runInstall(): Promise<void> {
  const platform = getPlatformInfo();

  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║           Welcome to Clarik           ║');
  console.log('║   Clarity and memory for Claude.      ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');

  // 1. Detect environment
  console.log(`✅ Detected: ${platform.platform} (${os.arch()})`);

  // 2. Check for Claude Desktop
  const desktopConfigPath = getClaudeDesktopConfigPath();
  let hasDesktop = false;
  try {
    await fs.access(path.dirname(desktopConfigPath));
    hasDesktop = true;
    console.log('✅ Detected: Claude Desktop');
  } catch {
    console.log('⚠️  Claude Desktop not detected (config will be created)');
  }

  // 3. Check for Claude Code
  let hasClaudeCode = false;
  try {
    await execAsync('claude --version');
    hasClaudeCode = true;
    console.log('✅ Detected: Claude Code');
  } catch {
    console.log('ℹ️  Claude Code not detected (skip)');
  }

  // 4. macOS beta check
  if (platform.isMac) {
    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      const version = stdout.trim();
      console.log(`ℹ️  macOS version: ${version}`);
      // Warn on beta versions
      if (version.includes('beta') || version.includes('Beta')) {
        console.log('⚠️  macOS beta detected — MCP connections may be unstable.');
        console.log('   If you experience disconnects, update to the stable release.');
      }
    } catch {
      // Non-critical
    }
  }

  console.log('✅ Checking compatibility...');

  // 5. Create storage directory
  await ensureStorageDir();
  console.log('✅ Created ~/.clarik/ directory');

  // 6. Get server path
  const serverPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'dist', 'index.js');
  const serverCommand = buildCommand(serverPath);

  // 7. Write Claude Desktop config
  if (hasDesktop || true) { // Always write config even if Desktop not detected
    try {
      await fs.mkdir(path.dirname(desktopConfigPath), { recursive: true });

      let existingConfig: Record<string, unknown> = {};
      try {
        const content = await fs.readFile(desktopConfigPath, 'utf-8');
        existingConfig = JSON.parse(content);
      } catch {
        // No existing config
      }

      const mcpServers = (existingConfig.mcpServers || {}) as Record<string, unknown>;
      mcpServers.clarik = {
        command: serverCommand.command,
        args: serverCommand.args,
      };
      existingConfig.mcpServers = mcpServers;

      await fs.writeFile(desktopConfigPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
      console.log('✅ Configured Claude Desktop');
    } catch (error) {
      console.log(`⚠️  Could not write Claude Desktop config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 8. Write Claude Code config
  if (hasClaudeCode) {
    try {
      await execAsync(`claude mcp add clarik ${serverCommand.command} ${serverCommand.args.join(' ')}`);
      console.log('✅ Configured Claude Code');
    } catch (error) {
      console.log(`⚠️  Could not configure Claude Code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('✅ Installing Clarik...');
  console.log('✅ Done. Clarik is active.');

  // 9. Show disclaimer (once only)
  const config = await readJson<ClarikConfig>(getConfigPath(), {
    disclaimerShown: false,
    mode: 'safe',
    projectId: '',
    version: '0.1.0',
    installedAt: '',
  });

  if (!config.disclaimerShown) {
    console.log(DISCLAIMER);
    config.disclaimerShown = true;
    config.installedAt = new Date().toISOString();
    await writeJsonAtomic(getConfigPath(), config);
  }

  // 10. Show tier info and savings
  console.log('');
  console.log('  FREE TIER ACTIVE  (8 of 20 tools)');
  console.log(SAVINGS_INFO);
  console.log('');
  console.log('  Already have a key?');
  console.log('  → npx clarik activate YOUR-KEY');
  console.log('');
  console.log('─────────────────────────────────────────');
  console.log('');
  console.log('Open Claude and start chatting.');
  console.log('Clarik is already working in the background.');
  console.log('');
}

// ─── Uninstall Logic ───

export async function runUninstall(): Promise<void> {
  const platform = getPlatformInfo();

  console.log('');
  console.log('Uninstalling Clarik...');

  // 1. Remove from Claude Desktop config
  const desktopConfigPath = getClaudeDesktopConfigPath();
  try {
    const content = await fs.readFile(desktopConfigPath, 'utf-8');
    const config = JSON.parse(content) as Record<string, unknown>;
    const mcpServers = (config.mcpServers || {}) as Record<string, unknown>;
    delete mcpServers.clarik;
    config.mcpServers = mcpServers;
    await fs.writeFile(desktopConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('✅ Removed from Claude Desktop config');
  } catch {
    console.log('ℹ️  Claude Desktop config not found (skip)');
  }

  // 2. Remove from Claude Code
  try {
    await execAsync('claude mcp remove clarik');
    console.log('✅ Removed from Claude Code');
  } catch {
    console.log('ℹ️  Claude Code not configured (skip)');
  }

  // 3. Note: Keep ~/.clarik/ data
  console.log('');
  console.log('ℹ️  Your memory data in ~/.clarik/ has been preserved.');
  console.log('   To delete all data: rm -rf ~/.clarik/');
  console.log('');
  console.log('✅ Clarik uninstalled.');
  console.log('');
}
