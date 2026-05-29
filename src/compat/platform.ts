// ─── Platform Compatibility ───
// OS detection, command building, and Claude Desktop config path resolution.
// Windows: cmd /c wrapper for stdio
// Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
// Windows: %APPDATA%/Claude/claude_desktop_config.json
// Linux: ~/.config/Claude/claude_desktop_config.json

import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Get platform information for the current OS.
 */
export function getPlatformInfo(): {
  platform: string;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
} {
  const platform = process.platform;
  return {
    platform,
    isWindows: platform === 'win32',
    isMac: platform === 'darwin',
    isLinux: platform === 'linux',
  };
}

/**
 * Build the command and args to launch the Clarik MCP server.
 * Windows uses cmd /c wrapper for proper stdio handling.
 *
 * @param serverPath - Absolute path to the server entry point
 */
export function buildCommand(serverPath: string): {
  command: string;
  args: string[];
} {
  const { isWindows } = getPlatformInfo();

  if (isWindows) {
    return {
      command: 'cmd',
      args: ['/c', 'node', serverPath],
    };
  }

  return {
    command: 'node',
    args: [serverPath],
  };
}

/**
 * Get the Claude Desktop config file path for the current OS.
 * - Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
 * - Windows: %APPDATA%/Claude/claude_desktop_config.json
 * - Linux: ~/.config/Claude/claude_desktop_config.json
 */
export function getClaudeDesktopConfigPath(): string {
  const { isWindows, isMac } = getPlatformInfo();
  const home = os.homedir();

  if (isMac) {
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }

  if (isWindows) {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Claude', 'claude_desktop_config.json');
  }

  // Linux
  return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
}
