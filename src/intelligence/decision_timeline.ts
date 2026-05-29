// ─── Decision Timeline ───
// Tracks decisions with date, reason, and affected files.
// Uses generateId('dec') for IDs. Stored per project.

import { Decision, DecisionTimeline } from '../types.js';
import {
  getProjectDir,
  ensureProjectDir,
  readJson,
  writeJsonAtomic,
  generateId,
} from '../storage.js';
import * as path from 'node:path';

function getTimelinePath(projectId: string): string {
  return path.join(getProjectDir(projectId), 'decisions.json');
}

function createDefaultTimeline(projectId: string): DecisionTimeline {
  return {
    version: 1,
    projectId,
    decisions: [],
  };
}

/**
 * Add a new decision to the project's timeline.
 *
 * @param projectId - The project identifier
 * @param input - Decision data: decision text, reason, and affected files
 * @returns The created Decision with generated ID and timestamp
 */
export async function addDecision(
  projectId: string,
  input: { decision: string; reason: string; affectedFiles: string[] }
): Promise<Decision> {
  try {
    await ensureProjectDir(projectId);
    const timelinePath = getTimelinePath(projectId);
    const timeline = await readJson<DecisionTimeline>(
      timelinePath,
      createDefaultTimeline(projectId)
    );

    const decision: Decision = {
      id: generateId('dec'),
      date: new Date().toISOString(),
      decision: input.decision,
      reason: input.reason,
      affectedFiles: input.affectedFiles,
    };

    timeline.decisions.push(decision);
    timeline.version = 1;
    timeline.projectId = projectId;

    await writeJsonAtomic(timelinePath, timeline);

    return decision;
  } catch (error) {
    console.error('[clarik] Error adding decision:', error);
    throw new Error(`Failed to add decision: ${error}`);
  }
}

/**
 * Get the full decision timeline for a project.
 *
 * @param projectId - The project identifier
 * @returns Array of Decision entries in chronological order
 */
export async function getTimeline(projectId: string): Promise<Decision[]> {
  try {
    const timelinePath = getTimelinePath(projectId);
    const timeline = await readJson<DecisionTimeline>(
      timelinePath,
      createDefaultTimeline(projectId)
    );
    return timeline.decisions;
  } catch (error) {
    console.error('[clarik] Error reading decision timeline:', error);
    return [];
  }
}
