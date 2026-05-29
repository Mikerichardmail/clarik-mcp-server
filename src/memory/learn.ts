// ─── Clarik Memory: Learn & Extract Facts ───
// Extracts facts from conversation content and persists them.
// ALWAYS strips <thinking>/<antml-thinking> blocks before extraction.

import * as path from 'node:path';
import type {
  MemoryFact,
  MemoryStore,
  MemoryCategory,
  MemorySource,
} from '../types.js';
import {
  getProjectDir,
  ensureProjectDir,
  writeJsonAtomic,
  readJson,
  generateId,
} from '../storage.js';
import { detectConflict } from './conflict.js';

// ─── Constants ───

const MAX_ACTIVE_FACTS = 200;
const ACTIVE_FILE = 'active_memory.json';

// ─── Thinking Block Sanitization ───

/**
 * Strip all <thinking>, </thinking>, <antml-thinking>, </antml-thinking>
 * blocks and everything between them from content.
 */
function stripThinkingBlocks(content: string): string {
  // Remove <thinking>...</thinking> (including multiline, non-greedy)
  let cleaned = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  // Remove <antml-thinking>...</antml-thinking>
  cleaned = cleaned.replace(/<antml-thinking>[\s\S]*?<\/antml-thinking>/gi, '');
  // Remove any orphaned opening/closing tags
  cleaned = cleaned.replace(/<\/?thinking>/gi, '');
  cleaned = cleaned.replace(/<\/?antml-thinking>/gi, '');
  return cleaned.trim();
}

// ─── Extraction Patterns ───

interface ExtractionRule {
  category: MemoryCategory;
  patterns: RegExp[];
  priority: number; // lower = higher priority
}

const EXTRACTION_RULES: ExtractionRule[] = [
  {
    // 1. Stack and framework mentions
    category: 'project',
    patterns: [
      /(?:using|use|built with|stack(?:ed)? (?:on|with)|powered by|running(?: on)?|framework[:\s]+)\s+([A-Za-z][A-Za-z0-9./ -]{1,60})/gi,
      /(?:tech stack|tooling|dependencies)[:\s]+(.+)/gi,
    ],
    priority: 1,
  },
  {
    // 2. Explicit decisions with reasoning
    category: 'decision',
    patterns: [
      /(?:we decided|let'?s use|going with|decided to|we chose|choosing|let'?s go with|we'?ll use|agreed to|decision:)\s+(.+?)(?:\.|$)/gim,
      /(?:yes|exactly|correct)[,.]?\s+(?:we(?:'ll| will| should)?|let'?s)\s+(.+?)(?:\.|$)/gim,
    ],
    priority: 2,
  },
  {
    // 3. File-to-purpose mappings
    category: 'file',
    patterns: [
      /(\S+\.(?:ts|js|tsx|jsx|py|rs|go|java|rb|vue|svelte|css|scss|json|yaml|yml|toml|md))\s+(?:is|handles|manages|contains|does|serves as|responsible for|for)\s+(.+?)(?:\.|$)/gim,
      /(?:file|module|component)\s+(\S+)\s+(?:is|handles|does)\s+(.+?)(?:\.|$)/gim,
    ],
    priority: 3,
  },
  {
    // 4. Gotchas and warnings
    category: 'gotcha',
    patterns: [
      /(?:gotcha|watch out|be careful|caution|warning|don'?t forget|note:|important:|caveat|heads up|be aware)[:\s]+(.+?)(?:\.|$)/gim,
      /(?:bug|issue|problem|pitfall|trap|footgun)[:\s]+(.+?)(?:\.|$)/gim,
    ],
    priority: 4,
  },
  {
    // 5. Architecture patterns
    category: 'project',
    patterns: [
      /(?:architecture|pattern|approach|structure|design)[:\s]+(.+?)(?:\.|$)/gim,
      /(?:we follow|following|adopting|using(?: the)?)\s+(?:a |the )?([A-Za-z][\w -]+ pattern|architecture|approach)/gim,
    ],
    priority: 5,
  },
];

// ─── Signal Phrases ───

const SIGNAL_PHRASES = [
  'we decided',
  "let's use",
  'going with',
  'yes',
  'exactly',
  'correct',
  'agreed',
  'confirmed',
  "we'll use",
  'decision:',
  'choosing',
  'we chose',
];

/**
 * Check if content contains signal phrases indicating decisions or confirmations.
 */
function hasSignalPhrase(content: string): boolean {
  const lower = content.toLowerCase();
  return SIGNAL_PHRASES.some((phrase) => lower.includes(phrase));
}

// ─── Helpers ───

function getActiveMemoryPath(projectId: string): string {
  return path.join(getProjectDir(projectId), ACTIVE_FILE);
}

async function loadActiveStore(projectId: string): Promise<MemoryStore> {
  const filePath = getActiveMemoryPath(projectId);
  return readJson<MemoryStore>(filePath, {
    version: 1,
    projectId,
    facts: [],
    lastUpdated: new Date().toISOString(),
  });
}

async function saveActiveStore(
  projectId: string,
  store: MemoryStore,
): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  const filePath = getActiveMemoryPath(projectId);
  await writeJsonAtomic(filePath, store);
}

/**
 * Extract unique tags/keywords from a text string.
 */
function extractTags(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return [...new Set(words)].slice(0, 15);
}

/**
 * Enforce the 200-fact cap by evicting lowest-value facts.
 * Eviction score: lower confidence + least recently used = evicted first.
 */
function evictIfNeeded(facts: MemoryFact[]): MemoryFact[] {
  if (facts.length <= MAX_ACTIVE_FACTS) return facts;

  // Sort by eviction priority: low confidence and old lastUsed get evicted
  const scored = facts.map((f) => {
    const recency =
      (Date.now() - new Date(f.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    // Higher eviction score = more likely to be evicted
    const evictionScore = (1 - f.confidence) + (recency / 30);
    return { fact: f, evictionScore };
  });

  scored.sort((a, b) => a.evictionScore - b.evictionScore);
  return scored.slice(0, MAX_ACTIVE_FACTS).map((s) => s.fact);
}

// ─── Public API ───

/**
 * Extract facts from conversation content and store them.
 *
 * @param content   - Raw conversation text (thinking blocks are stripped)
 * @param source    - 'user' or 'assistant_final'
 * @param projectId - Hashed project identifier
 * @returns Array of newly created MemoryFacts
 */
export async function learnFacts(
  content: string,
  source: MemorySource,
  projectId: string,
): Promise<MemoryFact[]> {
  try {
    // ALWAYS strip thinking blocks first
    const cleanContent = stripThinkingBlocks(content);

    if (!cleanContent || cleanContent.length < 5) {
      return [];
    }

    await ensureProjectDir(projectId);
    const store = await loadActiveStore(projectId);
    const newFacts: MemoryFact[] = [];
    const now = new Date().toISOString();

    // Extract facts by priority rules
    for (const rule of EXTRACTION_RULES) {
      for (const pattern of rule.patterns) {
        // Reset regex state
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(cleanContent)) !== null) {
          // Use the first capture group, or the full matched text
          const factText = (match[1] || match[0]).trim();

          if (factText.length < 5 || factText.length > 500) continue;

          // Skip duplicates (same category + very similar text)
          const isDuplicate = store.facts.some(
            (f) =>
              f.category === rule.category &&
              f.fact.toLowerCase() === factText.toLowerCase(),
          );
          if (isDuplicate) continue;

          // Also skip within this batch
          const isDuplicateInBatch = newFacts.some(
            (f) =>
              f.category === rule.category &&
              f.fact.toLowerCase() === factText.toLowerCase(),
          );
          if (isDuplicateInBatch) continue;

          // Boost confidence if signal phrases present nearby
          const baseConfidence = 0.7;
          const confidence = hasSignalPhrase(cleanContent)
            ? Math.min(baseConfidence + 0.15, 1.0)
            : baseConfidence;

          const fact: MemoryFact = {
            id: generateId('mem'),
            category: rule.category,
            fact: factText,
            confidence,
            timesReferenced: 0,
            createdAt: now,
            lastUsed: now,
            status: 'active',
            projectId,
            source,
            tags: extractTags(factText),
          };

          // Check for conflicts with existing facts
          const conflicting = await detectConflict(fact, store.facts);
          if (conflicting) {
            // If the new fact auto-wins, deprecate the old one
            if (
              fact.confidence > 0.7 &&
              isOlderThanDays(conflicting, 30)
            ) {
              conflicting.status = 'deprecated';
              fact.status = 'active';
            } else if (fact.category === 'decision') {
              // Decisions always override older decisions
              conflicting.status = 'deprecated';
              fact.status = 'active';
            } else {
              // Mark both as conflicting — surface to user
              conflicting.status = 'conflicting';
              fact.status = 'conflicting';
            }
          }

          newFacts.push(fact);
        }
      }
    }

    if (newFacts.length === 0) {
      return [];
    }

    // Add new facts and enforce cap
    store.facts.push(...newFacts);
    store.facts = evictIfNeeded(store.facts);

    await saveActiveStore(projectId, store);
    return newFacts;
  } catch (error) {
    console.error('[clarik] learnFacts error:', error);
    return [];
  }
}

/**
 * Edit an existing memory fact.
 *
 * @param factId    - ID of the fact to edit
 * @param projectId - Project scope
 * @param updates   - Fields to update
 * @returns true if the fact was found and updated
 */
export async function editMemory(
  factId: string,
  projectId: string,
  updates: {
    fact?: string;
    category?: MemoryCategory;
    confidence?: number;
    status?: MemoryFact['status'];
    tags?: string[];
  },
): Promise<boolean> {
  try {
    await ensureProjectDir(projectId);
    const store = await loadActiveStore(projectId);
    const idx = store.facts.findIndex((f) => f.id === factId);

    if (idx === -1) return false;

    const existing = store.facts[idx];

    if (updates.fact !== undefined) existing.fact = updates.fact;
    if (updates.category !== undefined) existing.category = updates.category;
    if (updates.confidence !== undefined)
      existing.confidence = Math.max(0, Math.min(1, updates.confidence));
    if (updates.status !== undefined) existing.status = updates.status;
    if (updates.tags !== undefined) existing.tags = updates.tags;

    existing.lastUsed = new Date().toISOString();

    await saveActiveStore(projectId, store);
    return true;
  } catch (error) {
    console.error('[clarik] editMemory error:', error);
    return false;
  }
}

/**
 * Clear all memories in a specific category for a project.
 *
 * @param projectId - Project scope
 * @param category  - Category to clear (or 'all' for everything)
 * @returns Number of facts removed
 */
export async function clearMemories(
  projectId: string,
  category: string,
): Promise<number> {
  try {
    await ensureProjectDir(projectId);
    const store = await loadActiveStore(projectId);
    const before = store.facts.length;

    if (category === 'all') {
      store.facts = [];
    } else {
      store.facts = store.facts.filter((f) => f.category !== category);
    }

    const removed = before - store.facts.length;
    await saveActiveStore(projectId, store);
    return removed;
  } catch (error) {
    console.error('[clarik] clearMemories error:', error);
    return 0;
  }
}

// ─── Internal Helpers ───

function isOlderThanDays(fact: MemoryFact, days: number): boolean {
  const age = Date.now() - new Date(fact.createdAt).getTime();
  return age > days * 24 * 60 * 60 * 1000;
}
