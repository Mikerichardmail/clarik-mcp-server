// ─── Clarik Memory: Archive Management ───
// Moves old, low-value facts from active to archive storage.
// Keeps active_memory.json lean (target: 200 facts).
// Archive is loaded on demand only.

import * as path from 'node:path';
import type { MemoryFact, MemoryStore } from '../types.js';
import {
  getProjectDir,
  ensureProjectDir,
  writeJsonAtomic,
  readJson,
} from '../storage.js';

// ─── Constants ───

const ACTIVE_FILE = 'active_memory.json';
const ARCHIVE_FILE = 'archive_memory.json';
const MAX_ACTIVE_TARGET = 200;

// ─── Helpers ───

function getActiveMemoryPath(projectId: string): string {
  return path.join(getProjectDir(projectId), ACTIVE_FILE);
}

function getArchiveMemoryPath(projectId: string): string {
  return path.join(getProjectDir(projectId), ARCHIVE_FILE);
}

async function loadStore(filePath: string, projectId: string): Promise<MemoryStore> {
  return readJson<MemoryStore>(filePath, {
    version: 1,
    projectId,
    facts: [],
    lastUpdated: new Date().toISOString(),
  });
}

/**
 * Determine if a fact should be archived based on age and usage.
 *
 * A fact is archivable when:
 *   - It is older than maxAgeDays AND has low references (≤ 2)
 *   - OR it has status 'deprecated'
 */
function isArchivable(
  fact: MemoryFact,
  maxAgeDays: number,
  referenceThreshold: number,
): boolean {
  // Always archive deprecated facts
  if (fact.status === 'deprecated') return true;

  const ageDays =
    (Date.now() - new Date(fact.lastUsed).getTime()) / (1000 * 60 * 60 * 24);

  return ageDays > maxAgeDays && fact.timesReferenced <= referenceThreshold;
}

// ─── Public API ───

/**
 * Move old, low-value facts from active memory to archive.
 *
 * Archival criteria:
 *   - Facts older than maxAgeDays with ≤ 2 references
 *   - All deprecated facts
 *   - If active store still exceeds 200 facts after archival,
 *     the lowest-value excess facts are also archived
 *
 * @param projectId  - Project scope
 * @param maxAgeDays - Maximum age in days before considering archival (default: 30)
 * @returns Number of facts moved to archive
 */
export async function archiveMemories(
  projectId: string,
  maxAgeDays: number = 30,
): Promise<number> {
  try {
    await ensureProjectDir(projectId);

    const activePath = getActiveMemoryPath(projectId);
    const archivePath = getArchiveMemoryPath(projectId);

    const activeStore = await loadStore(activePath, projectId);
    const archiveStore = await loadStore(archivePath, projectId);

    // Determine a dynamic reference threshold
    // If we have many facts, be more aggressive
    const referenceThreshold = activeStore.facts.length > MAX_ACTIVE_TARGET ? 3 : 2;

    // Partition facts into keep and archive
    const toKeep: MemoryFact[] = [];
    const toArchive: MemoryFact[] = [];

    for (const fact of activeStore.facts) {
      if (isArchivable(fact, maxAgeDays, referenceThreshold)) {
        toArchive.push(fact);
      } else {
        toKeep.push(fact);
      }
    }

    // If we're still over the target, archive lowest-value active facts
    if (toKeep.length > MAX_ACTIVE_TARGET) {
      // Score: lower is more archivable
      const scored = toKeep.map((f) => {
        const recencyDays =
          (Date.now() - new Date(f.lastUsed).getTime()) /
          (1000 * 60 * 60 * 24);
        const value = f.confidence * 0.4 + (1 / (1 + recencyDays)) * 0.3 +
          Math.min(f.timesReferenced / 10, 1) * 0.3;
        return { fact: f, value };
      });

      // Sort by value descending — keep the best
      scored.sort((a, b) => b.value - a.value);

      const kept = scored.slice(0, MAX_ACTIVE_TARGET).map((s) => s.fact);
      const overflow = scored.slice(MAX_ACTIVE_TARGET).map((s) => s.fact);

      toKeep.length = 0;
      toKeep.push(...kept);
      toArchive.push(...overflow);
    }

    if (toArchive.length === 0) {
      return 0;
    }

    // Move facts to archive
    archiveStore.facts.push(...toArchive);
    archiveStore.lastUpdated = new Date().toISOString();

    activeStore.facts = toKeep;
    activeStore.lastUpdated = new Date().toISOString();

    // Write both stores atomically
    await writeJsonAtomic(archivePath, archiveStore);
    await writeJsonAtomic(activePath, activeStore);

    return toArchive.length;
  } catch (error) {
    console.error('[clarik] archiveMemories error:', error);
    return 0;
  }
}

/**
 * Retrieve all archived facts for a project.
 * Archive is loaded on demand only — never preloaded.
 *
 * @param projectId - Project scope
 * @returns Array of archived MemoryFact objects
 */
export async function getArchived(projectId: string): Promise<MemoryFact[]> {
  try {
    await ensureProjectDir(projectId);
    const archivePath = getArchiveMemoryPath(projectId);
    const archiveStore = await loadStore(archivePath, projectId);
    return archiveStore.facts;
  } catch (error) {
    console.error('[clarik] getArchived error:', error);
    return [];
  }
}
