// ─── Repo Guard ───
// Checks file operations against protected patterns.
// ALWAYS asks for confirmation, NEVER hard blocks.
// Protected patterns: migrations/, .env*, *secrets*, .github/workflows/, production configs.

import * as path from 'node:path';
import { RepoGuardResult } from '../types.js';

/** Protected path patterns — glob-like matching */
const PROTECTED_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  {
    pattern: /(?:^|[/\\])migrations[/\\]/i,
    description: 'Database migration file — changes may affect production data',
  },
  {
    pattern: /[/\\]?\.env($|\..*)/i,
    description: 'Environment configuration — may contain secrets',
  },
  {
    pattern: /secret/i,
    description: 'File appears to contain secrets or sensitive data',
  },
  {
    pattern: /(?:^|[/\\])\.github[/\\]workflows[/\\]/i,
    description: 'CI/CD workflow — changes may affect deployment pipeline',
  },
  {
    pattern: /[/\\]?production\.(json|ya?ml|toml|ini|conf|cfg)/i,
    description: 'Production configuration file',
  },
  {
    pattern: /[/\\]?prod\.(json|ya?ml|toml|ini|conf|cfg)/i,
    description: 'Production configuration file',
  },
  {
    pattern: /[/\\]?docker-compose\.prod/i,
    description: 'Production Docker Compose — changes may affect live services',
  },
  {
    pattern: /[/\\]?Dockerfile\.prod/i,
    description: 'Production Dockerfile — changes may affect live services',
  },
  {
    pattern: /[/\\]?\.pem$|[/\\]?\.key$|[/\\]?\.cert$|[/\\]?\.crt$/i,
    description: 'Certificate or key file — contains sensitive cryptographic material',
  },
  {
    pattern: /[/\\]?credentials/i,
    description: 'Credentials file — may contain authentication data',
  },
];

/**
 * Find the first protected pattern that matches a file path.
 * Returns null if the file is not protected.
 */
function findMatchingPattern(filePath: string): { pattern: RegExp; description: string } | null {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const entry of PROTECTED_PATTERNS) {
    if (entry.pattern.test(normalizedPath)) {
      return entry;
    }
  }

  return null;
}

/**
 * Check if a file operation triggers repo guard protection.
 * ALWAYS asks for confirmation — NEVER hard blocks.
 *
 * @param filePath - The file being modified
 * @param action - The action being performed (e.g., 'edit', 'delete', 'create')
 * @returns RepoGuardResult with allowed flag, reason, and confirmation status
 */
export async function checkRepoGuard(filePath: string, action: string): Promise<RepoGuardResult> {
  try {
    const normalizedPath = path.normalize(filePath);
    const match = findMatchingPattern(normalizedPath);

    if (!match) {
      // Not a protected file — allow freely
      return {
        allowed: true,
        filePath: normalizedPath,
        reason: 'File is not in a protected pattern',
        userConfirmed: false,
      };
    }

    // Protected file found — ask for confirmation, NEVER hard block
    return {
      allowed: false,
      filePath: normalizedPath,
      reason: `⚠️ Protected file detected: ${match.description}. Action '${action}' on '${path.basename(normalizedPath)}' requires confirmation.`,
      userConfirmed: false,
    };
  } catch (error) {
    console.error('[clarik] Error in repo guard check:', error);
    // On error, allow but warn — never block work
    return {
      allowed: true,
      filePath,
      reason: `Repo guard check failed: ${error}. Allowing action by default.`,
      userConfirmed: false,
    };
  }
}
