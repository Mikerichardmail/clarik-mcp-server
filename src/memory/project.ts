// ─── Clarik Memory: Project Isolation ───
// Generates a stable projectId from repo/workspace identity.
// Uses SHA-256 hash of the best available identifier.

import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';

/**
 * Attempt to run a command and capture stdout.
 * Returns trimmed stdout or null on any failure.
 */
function runCommand(cmd: string, args: string[], cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { cwd, timeout: 5000 }, (error, stdout) => {
        if (error || !stdout) {
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Try to read the "name" field from a package.json in the given directory.
 */
async function readPackageName(dir: string): Promise<string | null> {
  try {
    const pkgPath = path.join(dir, 'package.json');
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (typeof pkg.name === 'string' && pkg.name.length > 0) {
      return pkg.name;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Hash an identifier string to a 12-char hex project ID.
 */
function hashIdentifier(identifier: string): string {
  return crypto
    .createHash('sha256')
    .update(identifier)
    .digest('hex')
    .slice(0, 12);
}

/**
 * Get a stable project identifier for memory isolation.
 *
 * Resolution order:
 *   1. Explicit projectPath (hashed directly)
 *   2. Git remote origin URL
 *   3. Workspace / cwd root path
 *   4. package.json "name" field
 *   5. Fallback: 'default'
 *
 * @param projectPath - Optional explicit path to hash
 * @returns 12-character hex string derived from SHA-256
 */
export async function getProjectId(projectPath?: string): Promise<string> {
  try {
    // 1. If an explicit path is provided, hash it directly
    if (projectPath) {
      const normalized = path.resolve(projectPath);
      return hashIdentifier(normalized);
    }

    const cwd = process.cwd();

    // 2. Try git remote origin URL
    const gitRemote = await runCommand('git', ['config', '--get', 'remote.origin.url'], cwd);
    if (gitRemote) {
      return hashIdentifier(gitRemote);
    }

    // 3. Try git repo root (even without a remote)
    const gitRoot = await runCommand('git', ['rev-parse', '--show-toplevel'], cwd);
    if (gitRoot) {
      return hashIdentifier(gitRoot);
    }

    // 4. Try package.json name in cwd
    const pkgName = await readPackageName(cwd);
    if (pkgName) {
      return hashIdentifier(pkgName);
    }

    // 5. Fall back to cwd itself
    return hashIdentifier(cwd);
  } catch {
    // Ultimate fallback — never crash
    return hashIdentifier('default');
  }
}
