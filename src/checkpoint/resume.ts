// ─── Clarik Checkpoint Resume ───
// Load and format checkpoints for context injection.

import { Checkpoint, CheckpointStore } from '../types.js';
import { getCheckpointDir, readJson } from '../storage.js';
import * as path from 'node:path';

/**
 * Format a Checkpoint into a human-readable summary string.
 */
function formatCheckpoint(checkpoint: Checkpoint): string {
  const sections: string[] = [];

  sections.push(`── Checkpoint: ${checkpoint.id} ──`);
  sections.push(`Created: ${checkpoint.created}`);
  sections.push(`Project: ${checkpoint.projectId}`);
  sections.push('');

  // Goal
  sections.push(`🎯 Goal:`);
  sections.push(`  ${checkpoint.goal}`);
  sections.push('');

  // Progress
  if (checkpoint.progress.length > 0) {
    sections.push('✅ Progress:');
    for (const item of checkpoint.progress) {
      sections.push(`  • ${item}`);
    }
    sections.push('');
  }

  // Decisions
  if (checkpoint.decisions.length > 0) {
    sections.push('📋 Decisions Made:');
    for (const decision of checkpoint.decisions) {
      sections.push(`  • ${decision}`);
    }
    sections.push('');
  }

  // Next step
  sections.push('➡️ Next Step:');
  sections.push(`  ${checkpoint.nextStep}`);
  sections.push('');

  // Open files
  if (checkpoint.openFiles.length > 0) {
    sections.push('📂 Open Files:');
    for (const file of checkpoint.openFiles) {
      sections.push(`  • ${file}`);
    }
    sections.push('');
  }

  // Open questions
  if (checkpoint.openQuestions.length > 0) {
    sections.push('❓ Open Questions:');
    for (const question of checkpoint.openQuestions) {
      sections.push(`  • ${question}`);
    }
    sections.push('');
  }

  // Context usage
  if (checkpoint.contextUsedPct > 0) {
    sections.push(`📊 Context Usage: ${checkpoint.contextUsedPct}%`);
  }

  return sections.join('\n');
}

/**
 * Resume from a checkpoint.
 *
 * - If `checkpointId` is provided, loads that specific checkpoint.
 * - Otherwise, loads the most recent checkpoint for the project.
 * - Returns a formatted string ready for context injection.
 * - Returns a helpful message if no checkpoints are found.
 *
 * @param projectId     The project to load checkpoints from
 * @param checkpointId  Optional specific checkpoint to load
 * @returns Formatted checkpoint summary string
 */
export async function resumeCheckpoint(
  projectId: string,
  checkpointId?: string
): Promise<string> {
  try {
    const storePath = path.join(
      getCheckpointDir(),
      projectId,
      'checkpoints.json'
    );

    const store = await readJson<CheckpointStore>(storePath, {
      version: 1,
      projectId,
      checkpoints: [],
    });

    if (store.checkpoints.length === 0) {
      return `No checkpoints found for project "${projectId}". Use clarik_checkpoint_save to create one.`;
    }

    let checkpoint: Checkpoint | undefined;

    if (checkpointId) {
      // Find specific checkpoint
      checkpoint = store.checkpoints.find(c => c.id === checkpointId);
      if (!checkpoint) {
        const available = store.checkpoints
          .slice(-5)
          .map(c => `  • ${c.id} (${c.created}) — ${c.goal}`)
          .join('\n');
        return [
          `Checkpoint "${checkpointId}" not found for project "${projectId}".`,
          '',
          'Recent checkpoints:',
          available,
        ].join('\n');
      }
    } else {
      // Load most recent checkpoint
      const sorted = [...store.checkpoints].sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );
      checkpoint = sorted[0];
    }

    return formatCheckpoint(checkpoint);
  } catch (error) {
    console.error('[clarik] Error resuming checkpoint:', error);
    return `Error loading checkpoint: ${error instanceof Error ? error.message : String(error)}`;
  }
}
