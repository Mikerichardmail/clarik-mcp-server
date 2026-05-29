import { jest, describe, it, expect, beforeEach, afterAll, beforeAll } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { MemoryStore, MemoryFact } from '../types.js';

// Redirect homedir to a local temp folder inside the workspace to isolate file writes
jest.mock('os', () => {
  const original = jest.requireActual('os') as any;
  return {
    __esModule: true,
    ...original,
    homedir: () => path.join(process.cwd(), 'temp-jest-test-recall'),
  };
});

describe('Clarik Memory: Ranked Recall Engine', () => {
  let recallMemories: any;
  let getProjectDir: any;
  let writeJsonAtomic: any;

  let projectId: string;
  let projectDir: string;
  let activePath: string;
  let archivePath: string;

  beforeAll(async () => {
    const storageMod = await import('../storage.js');
    getProjectDir = storageMod.getProjectDir;
    writeJsonAtomic = storageMod.writeJsonAtomic;

    const recallMod = await import('./recall.js');
    recallMemories = recallMod.recallMemories;

    projectId = 'testproj123';
    projectDir = getProjectDir(projectId);
    activePath = path.join(projectDir, 'active_memory.json');
    archivePath = path.join(projectDir, 'archive_memory.json');
  });

  const sampleFacts: MemoryFact[] = [
    {
      id: 'mem_1',
      category: 'project',
      fact: 'The project is built using React and TypeScript.',
      confidence: 0.9,
      timesReferenced: 0,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days old
      lastUsed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      projectId,
      source: 'assistant_final',
      tags: ['react', 'typescript', 'project'],
    },
    {
      id: 'mem_2',
      category: 'decision',
      fact: 'We decided to use TailwindCSS for layout formatting.',
      confidence: 0.8,
      timesReferenced: 5, // highly referenced
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days old
      lastUsed: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      projectId,
      source: 'assistant_final',
      tags: ['tailwind', 'css', 'decision'],
    },
    {
      id: 'mem_3',
      category: 'gotcha',
      fact: 'Warning: the third-party billing API is unstable in dev mode.',
      confidence: 0.95,
      timesReferenced: 2,
      createdAt: new Date().toISOString(), // fresh today
      lastUsed: new Date().toISOString(),
      status: 'active',
      projectId,
      source: 'user',
      tags: ['warning', 'billing', 'api', 'gotcha'],
    },
  ];

  beforeEach(async () => {
    // Ensure clean state before each test
    await fs.mkdir(projectDir, { recursive: true });

    // Seed mock active memory json
    const activeStore: MemoryStore = {
      version: 1,
      projectId,
      facts: sampleFacts,
      lastUpdated: new Date().toISOString(),
    };
    await writeJsonAtomic(activePath, activeStore);

    // Seed empty archive
    const archiveStore: MemoryStore = {
      version: 1,
      projectId,
      facts: [],
      lastUpdated: new Date().toISOString(),
    };
    await writeJsonAtomic(archivePath, archiveStore);
  });

  afterAll(async () => {
    // Clean up temp test directory
    try {
      await fs.rm(path.join(process.cwd(), 'temp-jest-test-recall'), { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  describe('recallMemories', () => {
    it('should return empty results for unmatched query terms', async () => {
      const results = await recallMemories('nonexistentterm', projectId);
      expect(results.length).toBe(0);
    });

    it('should prioritize fresh and highly matching facts', async () => {
      // Search for "billing" should match the gotcha warning, which is fresh (createdAt = now)
      const results = await recallMemories('billing', projectId);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].fact.id).toBe('mem_3');
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    it('should apply category boosts correctly', async () => {
      // Searching "decided" includes a category hint keyword.
      // Should match the decision category fact and apply boost.
      const results = await recallMemories('decided CSS', projectId);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].fact.id).toBe('mem_2');
    });

    it('should increment reference counters and update lastUsed upon successful recall', async () => {
      const initialFacts = await recallMemories('billing', projectId);
      expect(initialFacts[0].fact.timesReferenced).toBe(3);

      // Re-query to trigger update in JSON
      const results = await recallMemories('billing', projectId);
      // Wait a moment for file I/O if needed (recallMemories handles writes synchronously awaitable)
      expect(results[0].fact.timesReferenced).toBe(4);
    });
  });
});
