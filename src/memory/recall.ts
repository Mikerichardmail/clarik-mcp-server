// ─── Clarik Memory: Ranked Recall ───
// Retrieves memories ranked by relevance, recency, and importance.
// Score = (relevance × 0.5) + (recency × 0.3) + (importance × 0.2)

import * as path from 'node:path';
import type { MemoryFact, MemoryStore, RankedMemory } from '../types.js';
import {
  getProjectDir,
  ensureProjectDir,
  writeJsonAtomic,
  readJson,
} from '../storage.js';

// ─── Constants ───

const ACTIVE_FILE = 'active_memory.json';
const ARCHIVE_FILE = 'archive_memory.json';
const RECENCY_DECAY_DAYS = 30;

/** Category boosts applied when the query matches a category keyword. */
const CATEGORY_BOOSTS: Record<string, number> = {
  decision: 0.15,
  gotcha: 0.10,
  project: 0.05,
  file: 0.05,
  person: 0.05,
};

/** Keywords that hint at a specific category. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  decision: ['decided', 'decision', 'chose', 'choosing', 'agreed', 'why'],
  gotcha: ['gotcha', 'warning', 'bug', 'issue', 'careful', 'caveat', 'problem'],
  project: ['stack', 'framework', 'architecture', 'tech', 'pattern', 'tool'],
  file: ['file', 'module', 'component', 'handles', 'purpose'],
  person: ['who', 'person', 'team', 'member', 'owner'],
};

// ─── Helpers ───

function getActiveMemoryPath(projectId: string): string {
  return path.join(getProjectDir(projectId), ACTIVE_FILE);
}

function getArchiveMemoryPath(projectId: string): string {
  return path.join(getProjectDir(projectId), ARCHIVE_FILE);
}

async function loadFacts(projectId: string): Promise<MemoryStore> {
  const filePath = getActiveMemoryPath(projectId);
  return readJson<MemoryStore>(filePath, {
    version: 1,
    projectId,
    facts: [],
    lastUpdated: new Date().toISOString(),
  });
}

async function loadArchiveFacts(projectId: string): Promise<MemoryStore> {
  const filePath = getArchiveMemoryPath(projectId);
  return readJson<MemoryStore>(filePath, {
    version: 1,
    projectId,
    facts: [],
    lastUpdated: new Date().toISOString(),
  });
}

/**
 * Tokenize a string into lowercase words for comparison.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Calculate keyword overlap relevance between query and fact.
 * Returns a value 0.0 - 1.0.
 */
function calculateRelevance(
  queryTokens: string[],
  fact: MemoryFact,
  queryCategoryBoost: string | null,
): number {
  if (queryTokens.length === 0) return 0;

  // Tokenize the fact text + tags
  const factTokens = new Set([
    ...tokenize(fact.fact),
    ...(fact.tags || []).map((t) => t.toLowerCase()),
  ]);

  // Count matching query words
  let matches = 0;
  for (const qt of queryTokens) {
    if (factTokens.has(qt)) {
      matches++;
    } else {
      // Partial match: check if any fact token starts with the query token
      for (const ft of factTokens) {
        if (ft.startsWith(qt) || qt.startsWith(ft)) {
          matches += 0.5;
          break;
        }
      }
    }
  }

  let relevance = matches / queryTokens.length;

  // Apply category boost if the query hints at this fact's category
  if (queryCategoryBoost && queryCategoryBoost === fact.category) {
    relevance += CATEGORY_BOOSTS[fact.category] || 0;
  }

  return Math.min(relevance, 1.0);
}

/**
 * Calculate recency score with exponential decay.
 * 1.0 for today, approaches 0 over RECENCY_DECAY_DAYS.
 */
function calculateRecency(lastUsed: string): number {
  const ageMs = Date.now() - new Date(lastUsed).getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  // Exponential decay: e^(-ageDays / decayConstant)
  return Math.exp(-ageDays / RECENCY_DECAY_DAYS);
}

/**
 * Calculate importance score from timesReferenced, normalized 0-1.
 */
function calculateImportance(
  timesReferenced: number,
  maxReferences: number,
): number {
  if (maxReferences === 0) return 0;
  return Math.min(timesReferenced / maxReferences, 1.0);
}

/**
 * Detect which category the query is hinting at.
 */
function detectQueryCategory(queryTokens: string[]): string | null {
  let bestCategory: string | null = null;
  let bestCount = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const count = queryTokens.filter((qt) => keywords.includes(qt)).length;
    if (count > bestCount) {
      bestCount = count;
      bestCategory = category;
    }
  }

  return bestCount > 0 ? bestCategory : null;
}

// ─── Public API ───

/**
 * Recall memories ranked by relevance, recency, and importance.
 *
 * Score formula:
 *   score = (relevance × 0.5) + (recency × 0.3) + (importance × 0.2)
 *
 * @param query      - Search query text
 * @param projectId  - Project scope
 * @param maxResults - Maximum number of results to return
 * @returns Ranked memory results with score breakdowns
 */
export async function recallMemories(
  query: string,
  projectId: string,
  maxResults: number = 10,
): Promise<RankedMemory[]> {
  try {
    await ensureProjectDir(projectId);

    // Load active facts
    const store = await loadFacts(projectId);
    let allFacts = store.facts.filter((f) => f.status === 'active');

    // Also search archive if query is very specific (optional enhancement)
    const archiveStore = await loadArchiveFacts(projectId);
    const archivedActive = archiveStore.facts.filter(
      (f) => f.status === 'active' || f.status === 'deprecated',
    );

    // Combine but prioritize active facts
    allFacts = [...allFacts, ...archivedActive];

    if (allFacts.length === 0) {
      return [];
    }

    // Prepare query tokens
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    // Detect category hint in query
    const queryCategoryBoost = detectQueryCategory(queryTokens);

    // Find max references for normalization
    const maxReferences = Math.max(
      1,
      ...allFacts.map((f) => f.timesReferenced),
    );

    // Score all facts
    const ranked: RankedMemory[] = allFacts.map((fact) => {
      const relevance = calculateRelevance(queryTokens, fact, queryCategoryBoost);
      const recency = calculateRecency(fact.lastUsed);
      const importance = calculateImportance(
        fact.timesReferenced,
        maxReferences,
      );

      const score =
        relevance * 0.5 + recency * 0.3 + importance * 0.2;

      return {
        fact,
        score,
        breakdown: { relevance, recency, importance },
      };
    });

    // Sort by score descending and take top results
    ranked.sort((a, b) => b.score - a.score);
    const topResults = ranked.slice(0, maxResults);

    // Update timesReferenced and lastUsed for returned facts
    const now = new Date().toISOString();
    const returnedIds = new Set(topResults.map((r) => r.fact.id));

    let storeModified = false;
    for (const fact of store.facts) {
      if (returnedIds.has(fact.id)) {
        fact.timesReferenced++;
        fact.lastUsed = now;
        storeModified = true;
      }
    }

    if (storeModified) {
      store.lastUpdated = now;
      await writeJsonAtomic(getActiveMemoryPath(projectId), store);
    }

    return topResults;
  } catch (error) {
    console.error('[clarik] recallMemories error:', error);
    return [];
  }
}
