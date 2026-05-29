// ─── File Map ───
// Stores file-to-purpose mappings per project.
// Uses writeJsonAtomic for safe, corruption-resistant writes.

import { FileMapping, FileMapStore } from '../types.js';
import {
  getProjectDir,
  ensureProjectDir,
  readJson,
  writeJsonAtomic,
} from '../storage.js';
import * as path from 'node:path';

function getFileMapPath(projectId: string): string {
  return path.join(getProjectDir(projectId), 'file_map.json');
}

function createDefaultStore(projectId: string): FileMapStore {
  return {
    version: 1,
    projectId,
    mappings: [],
  };
}

/**
 * Update or add a file-to-purpose mapping for a project.
 * If the file already exists in the map, its purpose and timestamp are updated.
 * Otherwise, a new entry is added.
 *
 * @param projectId - The project identifier
 * @param filePath - Path of the file being mapped
 * @param purpose - Description of the file's purpose
 */
export async function updateFileMap(
  projectId: string,
  filePath: string,
  purpose: string
): Promise<void> {
  try {
    await ensureProjectDir(projectId);
    const storePath = getFileMapPath(projectId);
    const store = await readJson<FileMapStore>(storePath, createDefaultStore(projectId));

    const now = new Date().toISOString();
    const existingIndex = store.mappings.findIndex(
      (m) => m.filePath === filePath
    );

    if (existingIndex >= 0) {
      // Update existing mapping
      store.mappings[existingIndex] = {
        filePath,
        purpose,
        lastUpdated: now,
      };
    } else {
      // Add new mapping
      store.mappings.push({
        filePath,
        purpose,
        lastUpdated: now,
      });
    }

    store.version = 1;
    store.projectId = projectId;

    await writeJsonAtomic(storePath, store);
  } catch (error) {
    console.error('[clarik] Error updating file map:', error);
    throw new Error(`Failed to update file map for '${filePath}': ${error}`);
  }
}

/**
 * Get all file-to-purpose mappings for a project.
 *
 * @param projectId - The project identifier
 * @returns Array of FileMapping entries
 */
export async function getFileMap(projectId: string): Promise<FileMapping[]> {
  try {
    const storePath = getFileMapPath(projectId);
    const store = await readJson<FileMapStore>(storePath, createDefaultStore(projectId));
    return store.mappings;
  } catch (error) {
    console.error('[clarik] Error reading file map:', error);
    return [];
  }
}
