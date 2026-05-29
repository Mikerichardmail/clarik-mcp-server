// ─── Clarik Memory: Conflict Detection & Resolution ───
// Detects contradictions between memory facts and resolves them.
// Rules:
//   - New fact wins if confidence > 0.7 AND existing is > 30 days old
//   - 'decision' category always overrides older decisions
//   - Otherwise: mark both 'conflicting' and surface to user

import type { MemoryFact } from '../types.js';

// ─── Types ───

export interface ConflictPair {
  factA: MemoryFact;
  factB: MemoryFact;
  suggestion: string;
}

// ─── Constants ───

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_KEYWORD_OVERLAP = 0.3; // 30% overlap threshold for "similar"

// ─── Helpers ───

/**
 * Tokenize text to lowercase words for comparison.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s._-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

/**
 * Calculate keyword overlap ratio between two sets of tokens.
 * Returns a value 0.0 - 1.0 (Jaccard-like similarity).
 */
function keywordOverlap(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Check if a fact is older than a given number of days.
 */
function isOlderThanMs(fact: MemoryFact, ms: number): boolean {
  const age = Date.now() - new Date(fact.createdAt).getTime();
  return age > ms;
}

// ─── Public API ───

/**
 * Detect if a new fact contradicts any existing fact.
 *
 * Two facts are considered potentially conflicting when:
 *   1. They share the same category
 *   2. They have significant keyword overlap (≥30%)
 *   3. They are not the exact same statement
 *
 * @param newFact  - The incoming fact to check
 * @param existing - Array of existing facts to check against
 * @returns The conflicting existing fact, or null if no conflict found
 */
export async function detectConflict(
  newFact: MemoryFact,
  existing: MemoryFact[],
): Promise<MemoryFact | null> {
  try {
    const newTokens = tokenize(newFact.fact);

    for (const fact of existing) {
      // Skip inactive facts
      if (fact.status === 'deprecated') continue;

      // Must be same category to conflict
      if (fact.category !== newFact.category) continue;

      // Skip exact duplicates (not a conflict, just a duplicate)
      if (fact.fact.toLowerCase() === newFact.fact.toLowerCase()) continue;

      // Check keyword overlap
      const existingTokens = tokenize(fact.fact);
      const overlap = keywordOverlap(newTokens, existingTokens);

      if (overlap >= MIN_KEYWORD_OVERLAP) {
        return fact;
      }
    }

    return null;
  } catch (error) {
    console.error('[clarik] detectConflict error:', error);
    return null;
  }
}

/**
 * Scan all active facts for a project and find conflicting pairs.
 * Applies resolution rules:
 *   - Decisions: newer always wins, older gets deprecated
 *   - High confidence + old fact: new wins
 *   - Otherwise: both marked conflicting, surfaced for user review
 *
 * @param projectId - Project scope
 * @returns Array of conflict pairs with resolution suggestions
 */
export async function resolveConflicts(
  projectId: string,
): Promise<ConflictPair[]> {
  // Lazy import to avoid circular dependency
  const { getProjectDir, readJson, writeJsonAtomic } = await import(
    '../storage.js'
  );
  const { MemoryStore } = await (async () => {
    // We only need the type at runtime for the store structure
    return { MemoryStore: null };
  })();

  try {
    const storePath =
      (await import('node:path')).join(
        getProjectDir(projectId),
        'active_memory.json',
      );

    const store = await readJson<{
      version: number;
      projectId: string;
      facts: MemoryFact[];
      lastUpdated: string;
    }>(storePath, {
      version: 1,
      projectId,
      facts: [],
      lastUpdated: new Date().toISOString(),
    });

    const conflicts: ConflictPair[] = [];
    const facts = store.facts.filter((f) => f.status !== 'deprecated');

    // Pairwise comparison
    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const factA = facts[i];
        const factB = facts[j];

        // Must be same category
        if (factA.category !== factB.category) continue;

        // Check keyword overlap
        const tokensA = tokenize(factA.fact);
        const tokensB = tokenize(factB.fact);
        const overlap = keywordOverlap(tokensA, tokensB);

        if (overlap < MIN_KEYWORD_OVERLAP) continue;

        // Determine which is newer
        const aIsNewer =
          new Date(factA.createdAt).getTime() >
          new Date(factB.createdAt).getTime();
        const newer = aIsNewer ? factA : factB;
        const older = aIsNewer ? factB : factA;

        let suggestion: string;

        // Resolution rule 1: Decisions always auto-resolve (newer wins)
        if (factA.category === 'decision') {
          older.status = 'deprecated';
          newer.status = 'active';
          suggestion = `Decision updated: "${newer.fact}" supersedes "${older.fact}". Older decision auto-deprecated.`;
        }
        // Resolution rule 2: High confidence new + old existing
        else if (newer.confidence > 0.7 && isOlderThanMs(older, THIRTY_DAYS_MS)) {
          older.status = 'deprecated';
          newer.status = 'active';
          suggestion = `"${newer.fact}" (confidence ${newer.confidence.toFixed(2)}) replaces stale fact "${older.fact}" (${Math.round((Date.now() - new Date(older.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days old).`;
        }
        // Resolution rule 3: Surface to user
        else {
          factA.status = 'conflicting';
          factB.status = 'conflicting';
          suggestion = `Conflict detected between "${factA.fact}" and "${factB.fact}". Please review and resolve manually.`;
        }

        conflicts.push({ factA, factB, suggestion });
      }
    }

    // Persist any status changes
    if (conflicts.length > 0) {
      store.lastUpdated = new Date().toISOString();
      await writeJsonAtomic(storePath, store);
    }

    return conflicts;
  } catch (error) {
    console.error('[clarik] resolveConflicts error:', error);
    return [];
  }
}
