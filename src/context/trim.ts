// ─── Clarik Context Trim ───
// Intelligent memory injection within a token budget.
// Recalls memories ranked by relevance, adds file map entries,
// and fills remaining budget with lower-ranked memories.

import { MemoryStore, MemoryFact, FileMapStore, RankedMemory } from '../types.js';
import { getProjectDir, readJson } from '../storage.js';
import { estimateTokens } from './tokens.js';
import * as path from 'node:path';

/**
 * Score a memory fact against a query for relevance ranking.
 * Returns a RankedMemory with a composite score.
 */
function rankMemory(fact: MemoryFact, query: string): RankedMemory {
  const queryLower = query.toLowerCase();
  const factLower = fact.fact.toLowerCase();
  const tagsLower = (fact.tags ?? []).map(t => t.toLowerCase());

  // ── Relevance: keyword overlap between query and fact ──
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  let matchCount = 0;
  for (const word of queryWords) {
    if (factLower.includes(word)) matchCount++;
    if (tagsLower.some(t => t.includes(word))) matchCount++;
  }
  const relevance = queryWords.length > 0
    ? Math.min(matchCount / queryWords.length, 1.0)
    : 0;

  // ── Recency: newer facts score higher ──
  const lastUsedMs = new Date(fact.lastUsed).getTime();
  const nowMs = Date.now();
  const hoursSinceUsed = (nowMs - lastUsedMs) / (1000 * 60 * 60);
  // Decay: full score for <1hr, falls off over 168hrs (1 week)
  const recency = Math.max(0, 1 - hoursSinceUsed / 168);

  // ── Importance: based on confidence and reference count ──
  const refScore = Math.min(fact.timesReferenced / 10, 1.0);
  const importance = fact.confidence * 0.6 + refScore * 0.4;

  // ── Composite score ──
  const score = relevance * 0.5 + recency * 0.2 + importance * 0.3;

  return {
    fact,
    score,
    breakdown: { relevance, recency, importance },
  };
}

/**
 * Trim and assemble context that fits within a token budget.
 *
 * Strategy:
 *   1. Always include top 5 most relevant memories
 *   2. Add file map entries if space allows
 *   3. Fill remaining budget with additional ranked memories
 *
 * @param query        The current user query (for relevance ranking)
 * @param projectId    The project to pull memories/filemap from
 * @param budgetTokens Maximum tokens to use
 * @returns Formatted context string that fits within budget
 */
export async function trimContext(
  query: string,
  projectId: string,
  budgetTokens: number
): Promise<string> {
  try {
    const projectDir = getProjectDir(projectId);

    // ── Load memories ──
    const memoryPath = path.join(projectDir, 'active_memory.json');
    const memoryStore = await readJson<MemoryStore>(memoryPath, {
      version: 1,
      projectId,
      facts: [],
      lastUpdated: new Date().toISOString(),
    });

    // ── Load file map ──
    const fileMapPath = path.join(projectDir, 'file_map.json');
    const fileMapStore = await readJson<FileMapStore>(fileMapPath, {
      version: 1,
      projectId,
      mappings: [],
    });

    // ── Rank memories by relevance to query ──
    const activeFacts = memoryStore.facts.filter(f => f.status === 'active');
    const ranked = activeFacts
      .map(f => rankMemory(f, query))
      .sort((a, b) => b.score - a.score);

    // ── Build context within budget ──
    const sections: string[] = [];
    let usedTokens = 0;

    // Header
    const header = `── Clarik Context (project: ${projectId}) ──\n`;
    usedTokens += estimateTokens(header);
    sections.push(header);

    // 1. Top 5 most relevant memories (always included)
    const TOP_COUNT = 5;
    const topMemories = ranked.slice(0, TOP_COUNT);

    if (topMemories.length > 0) {
      const memHeader = '📌 Key Memories:\n';
      usedTokens += estimateTokens(memHeader);
      sections.push(memHeader);

      for (const rm of topMemories) {
        const line = `  • [${rm.fact.category}] ${rm.fact.fact} (confidence: ${rm.fact.confidence})\n`;
        const lineTokens = estimateTokens(line);

        if (usedTokens + lineTokens > budgetTokens) break;

        sections.push(line);
        usedTokens += lineTokens;
      }

      sections.push('');
    }

    // 2. File map entries (if space allows)
    if (fileMapStore.mappings.length > 0) {
      const fmHeader = '📂 File Map:\n';
      const fmHeaderTokens = estimateTokens(fmHeader);

      if (usedTokens + fmHeaderTokens < budgetTokens) {
        sections.push(fmHeader);
        usedTokens += fmHeaderTokens;

        for (const mapping of fileMapStore.mappings) {
          const line = `  • ${mapping.filePath} — ${mapping.purpose}\n`;
          const lineTokens = estimateTokens(line);

          if (usedTokens + lineTokens > budgetTokens) break;

          sections.push(line);
          usedTokens += lineTokens;
        }

        sections.push('');
      }
    }

    // 3. Additional ranked memories (fill remaining budget)
    const remaining = ranked.slice(TOP_COUNT);

    if (remaining.length > 0) {
      const extraHeader = '📝 Additional Context:\n';
      const extraHeaderTokens = estimateTokens(extraHeader);

      if (usedTokens + extraHeaderTokens < budgetTokens) {
        sections.push(extraHeader);
        usedTokens += extraHeaderTokens;

        for (const rm of remaining) {
          const line = `  • [${rm.fact.category}] ${rm.fact.fact}\n`;
          const lineTokens = estimateTokens(line);

          if (usedTokens + lineTokens > budgetTokens) break;

          sections.push(line);
          usedTokens += lineTokens;
        }
      }
    }

    return sections.join('');
  } catch (error) {
    console.error('[clarik] Error trimming context:', error);
    return `── Clarik Context ──\nUnable to load context: ${error instanceof Error ? error.message : String(error)}\n`;
  }
}
