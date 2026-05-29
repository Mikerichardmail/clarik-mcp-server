// ─── Prompt Library Tool ───
// Save, get, list, delete prompt templates.
// Stored in ~/.clarik/prompts.json

import { ToolResult } from '../types.js';
import { getPromptsPath, readJson, writeJsonAtomic } from '../storage.js';

interface PromptEntry {
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface PromptStore {
  version: number;
  prompts: PromptEntry[];
}

const DEFAULT_STORE: PromptStore = {
  version: 1,
  prompts: [],
};

/**
 * Manage prompt templates: save, get, list, or delete.
 *
 * @param action - One of: 'save', 'get', 'list', 'delete'
 * @param name - Prompt name (required for save, get, delete)
 * @param content - Prompt content (required for save)
 */
export async function managePrompt(
  action: string,
  name?: string,
  content?: string
): Promise<ToolResult> {
  try {
    const storePath = getPromptsPath();
    const store = await readJson<PromptStore>(storePath, DEFAULT_STORE);

    switch (action.toLowerCase()) {
      case 'save': {
        if (!name || !content) {
          return {
            content: [{ type: 'text', text: 'Error: Both name and content are required to save a prompt.' }],
            isError: true,
          };
        }

        const now = new Date().toISOString();
        const existingIndex = store.prompts.findIndex((p) => p.name === name);

        if (existingIndex >= 0) {
          store.prompts[existingIndex] = {
            name,
            content,
            createdAt: store.prompts[existingIndex].createdAt,
            updatedAt: now,
          };
        } else {
          store.prompts.push({
            name,
            content,
            createdAt: now,
            updatedAt: now,
          });
        }

        await writeJsonAtomic(storePath, store);

        return {
          content: [{ type: 'text', text: `Prompt '${name}' saved successfully.` }],
        };
      }

      case 'get': {
        if (!name) {
          return {
            content: [{ type: 'text', text: 'Error: Prompt name is required.' }],
            isError: true,
          };
        }

        const prompt = store.prompts.find((p) => p.name === name);
        if (!prompt) {
          return {
            content: [{ type: 'text', text: `Prompt '${name}' not found.` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: `**${prompt.name}**\n\n${prompt.content}` }],
        };
      }

      case 'list': {
        if (store.prompts.length === 0) {
          return {
            content: [{ type: 'text', text: 'No prompts saved yet.' }],
          };
        }

        const list = store.prompts
          .map((p) => `- **${p.name}** (updated: ${p.updatedAt})`)
          .join('\n');

        return {
          content: [{ type: 'text', text: `Saved prompts:\n${list}` }],
        };
      }

      case 'delete': {
        if (!name) {
          return {
            content: [{ type: 'text', text: 'Error: Prompt name is required.' }],
            isError: true,
          };
        }

        const deleteIndex = store.prompts.findIndex((p) => p.name === name);
        if (deleteIndex < 0) {
          return {
            content: [{ type: 'text', text: `Prompt '${name}' not found.` }],
            isError: true,
          };
        }

        store.prompts.splice(deleteIndex, 1);
        await writeJsonAtomic(storePath, store);

        return {
          content: [{ type: 'text', text: `Prompt '${name}' deleted.` }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown action '${action}'. Use: save, get, list, delete.` }],
          isError: true,
        };
    }
  } catch (error) {
    console.error('[clarik] Error in prompt library:', error);
    return {
      content: [{ type: 'text', text: `Prompt library error: ${error}` }],
      isError: true,
    };
  }
}
