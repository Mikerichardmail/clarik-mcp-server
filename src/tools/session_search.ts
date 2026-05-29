// ─── Session Search Tool ───
// Full-text search across session data files in ~/.clarik/sessions/
// Case-insensitive matching with snippet extraction.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ToolResult } from '../types.js';
import { getSessionDir, fileExists } from '../storage.js';

interface SearchHit {
  fileName: string;
  snippet: string;
  matchCount: number;
}

/**
 * Search across all session data files for a query string.
 * Performs case-insensitive full-text search.
 *
 * @param query - The search term
 * @param projectId - The project identifier (used to filter results)
 */
export async function searchSessions(
  query: string,
  projectId: string
): Promise<ToolResult> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        content: [{ type: 'text', text: 'Error: Search query cannot be empty.' }],
        isError: true,
      };
    }

    const sessionDir = getSessionDir();
    const dirExists = await fileExists(sessionDir);

    if (!dirExists) {
      return {
        content: [{ type: 'text', text: 'No session data found.' }],
      };
    }

    const files = await fs.readdir(sessionDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      return {
        content: [{ type: 'text', text: 'No session files found.' }],
      };
    }

    const lowerQuery = query.toLowerCase();
    const hits: SearchHit[] = [];

    for (const fileName of jsonFiles) {
      try {
        const filePath = path.join(sessionDir, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        const lowerContent = content.toLowerCase();

        // Count matches
        let matchCount = 0;
        let searchPos = 0;
        while (true) {
          const idx = lowerContent.indexOf(lowerQuery, searchPos);
          if (idx === -1) break;
          matchCount++;
          searchPos = idx + 1;
        }

        if (matchCount > 0) {
          // If filtering by projectId, check if this session belongs to the project
          if (projectId) {
            const hasProject = lowerContent.includes(projectId.toLowerCase());
            if (!hasProject) continue;
          }

          // Extract a snippet around the first match
          const firstIdx = lowerContent.indexOf(lowerQuery);
          const snippetStart = Math.max(0, firstIdx - 50);
          const snippetEnd = Math.min(content.length, firstIdx + query.length + 50);
          const snippet = content.slice(snippetStart, snippetEnd).replace(/\n/g, ' ');

          hits.push({
            fileName,
            snippet: snippetStart > 0 ? `...${snippet}...` : `${snippet}...`,
            matchCount,
          });
        }
      } catch {
        // Skip files that can't be read
        continue;
      }
    }

    if (hits.length === 0) {
      return {
        content: [{ type: 'text', text: `No results found for '${query}'.` }],
      };
    }

    // Sort by match count descending
    hits.sort((a, b) => b.matchCount - a.matchCount);

    // Cap results at 20
    const topHits = hits.slice(0, 20);
    const results = topHits
      .map((h) => `**${h.fileName}** (${h.matchCount} match${h.matchCount > 1 ? 'es' : ''})\n> ${h.snippet}`)
      .join('\n\n');

    const summary = `Found ${hits.length} session${hits.length > 1 ? 's' : ''} matching '${query}'${hits.length > 20 ? ` (showing top 20)` : ''}:\n\n${results}`;

    return {
      content: [{ type: 'text', text: summary }],
    };
  } catch (error) {
    console.error('[clarik] Error searching sessions:', error);
    return {
      content: [{ type: 'text', text: `Session search error: ${error}` }],
      isError: true,
    };
  }
}
