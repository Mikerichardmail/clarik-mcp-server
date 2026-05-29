// ─── Clarik Checkpoint Save ───
// Structured checkpoint generation with auto-pruning.
// Keeps the last 20 checkpoints per project.

import { Checkpoint, CheckpointStore } from '../types.js';
import {
  getCheckpointDir,
  writeJsonAtomic,
  readJson,
  generateId,
} from '../storage.js';
import * as path from 'node:path';

const MAX_CHECKPOINTS_PER_PROJECT = 20;

export interface SaveCheckpointInput {
  projectId: string;
  goal: string;
  progress: string[];
  decisions: string[];
  nextStep: string;
  openFiles: string[];
  openQuestions: string[];
}

/**
 * Save a new checkpoint for a project.
 *
 * - Generates a unique ID with prefix 'chk'
 * - Stores in ~/.clarik/checkpoints/{projectId}/checkpoints.json
 * - Auto-prunes to keep only the last 20 checkpoints per project
 * - Uses atomic writes to prevent corruption
 *
 * @param input  Checkpoint data to save
 * @returns The newly created Checkpoint object
 */
export async function saveCheckpoint(input: SaveCheckpointInput): Promise<Checkpoint> {
  try {
    const checkpointId = generateId('chk');
    const now = new Date().toISOString();

    const checkpoint: Checkpoint = {
      id: checkpointId,
      created: now,
      projectId: input.projectId,
      goal: input.goal,
      progress: input.progress ?? [],
      decisions: input.decisions ?? [],
      nextStep: input.nextStep,
      openFiles: input.openFiles ?? [],
      openQuestions: input.openQuestions ?? [],
      contextUsedPct: 0, // can be updated later by context system
    };

    // Load existing checkpoint store for this project
    const storePath = path.join(
      getCheckpointDir(),
      input.projectId,
      'checkpoints.json'
    );

    const store = await readJson<CheckpointStore>(storePath, {
      version: 1,
      projectId: input.projectId,
      checkpoints: [],
    });

    // Add the new checkpoint
    store.checkpoints.push(checkpoint);

    // Prune: keep only the most recent MAX_CHECKPOINTS_PER_PROJECT
    if (store.checkpoints.length > MAX_CHECKPOINTS_PER_PROJECT) {
      // Sort by creation date descending, keep newest
      store.checkpoints.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );
      store.checkpoints = store.checkpoints.slice(0, MAX_CHECKPOINTS_PER_PROJECT);
    }

    // Ensure version and projectId are current
    store.version = 1;
    store.projectId = input.projectId;

    // Atomic write
    await writeJsonAtomic(storePath, store);

    return checkpoint;
  } catch (error) {
    console.error('[clarik] Error saving checkpoint:', error);
    throw new Error(
      `Failed to save checkpoint: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
