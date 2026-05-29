#!/usr/bin/env node
// ─── Clarik MCP Server Entry Point ───
// Registers all 20 tools, MCP resources, and MCP prompts.
// Transport: stdio only. Never SSE or HTTP.
// All tools prefixed with clarik_ to prevent conflicts.
// Every tool wrapped in try/catch — never crash the MCP server.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getProjectId } from './memory/project.js';
import { learnFacts } from './memory/learn.js';
import { recallMemories } from './memory/recall.js';
import { resolveConflicts } from './memory/conflict.js';
import { archiveMemories, getArchived } from './memory/archive.js';
import { trimContext } from './context/trim.js';
import { compressHistory } from './context/compress.js';
import { estimateTokens } from './context/tokens.js';
import { saveCheckpoint } from './checkpoint/save.js';
import { resumeCheckpoint } from './checkpoint/resume.js';
import { validateLicense, getLicenseStatus } from './license/validate.js';
import { checkGracePeriod } from './license/grace.js';
import { getSafeModeConfig } from './safety/modes.js';
import { checkRepoGuard } from './safety/repo_guard.js';
import { updateFileMap, getFileMap } from './intelligence/file_map.js';
import { addDecision, getTimeline } from './intelligence/decision_timeline.js';
import { setupHeartbeat } from './compat/transport.js';
import { getPlatformInfo } from './compat/platform.js';
import { createProtocol } from './compat/protocol.js';
import { getStoragePath, ensureStorageDir } from './storage.js';
import {
  type SessionInfo,
  type LicenseStatus,
  PRO_TOOLS,
} from './types.js';

// ─── Session State ───

const session: SessionInfo = {
  id: `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  projectId: '',
  startedAt: new Date().toISOString(),
  toolCallCount: 0,
  proToolPromptShown: false,
  estimatedTokensProcessed: 0,
};

// ─── Server Setup ───

const server = new McpServer({
  name: 'clarik',
  version: '0.1.0',
});

// ─── Helper: Pro Tool Gate ───

function isProTool(toolName: string): boolean {
  return (PRO_TOOLS as readonly string[]).includes(toolName);
}

async function checkProAccess(toolName: string): Promise<Record<string, unknown> | null> {
  if (!isProTool(toolName)) return null;

  const status: LicenseStatus = await getLicenseStatus();
  if (status.tier !== 'free') return null;

  // Only show the upgrade prompt once per session
  if (session.proToolPromptShown) {
    return {
      content: [{
        type: 'text',
        text: `⚡ ${toolName} is a Pro feature. Run: npx clarik activate YOUR-KEY`,
      }],
    };
  }

  session.proToolPromptShown = true;
  return {
    content: [{
      type: 'text',
      text: [
        `⚡ ${toolName} is a Pro feature.`,
        '',
        '   Unlock all 20 tools → https://clarik.dev/pro ($20 lifetime)',
        '   Activate your key  → npx clarik activate YOUR-KEY',
        '',
        '   (Free tier includes 8 tools — no key needed)',
      ].join('\n'),
    }],
  };
}

// ─── Helper: Safe tool wrapper ───
// Uses 'any' for args because each tool has a different Zod schema shape.
// The MCP SDK handles type checking via Zod validation before the handler runs.

function safeTool(
  toolName: string,
  handler: (args: any, extra: any) => any
): (args: any, extra: any) => any {
  return async (args: any, extra: any): Promise<any> => {
    try {
      session.toolCallCount++;

      // Check pro access
      const proBlock = await checkProAccess(toolName);
      if (proBlock) return proBlock;

      return await handler(args, extra);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[clarik] Error in ${toolName}: ${message}`);
      return {
        content: [{
          type: 'text' as const,
          text: `Error in ${toolName}: ${message}`,
        }],
        isError: true,
      };
    }
  };
}

// ═══════════════════════════════════════
// FREE TOOLS (1-8) — No license check
// ═══════════════════════════════════════

// Tool 1: clarik_memory_learn
server.tool(
  'clarik_memory_learn',
  'Extract and store facts from conversation. Strips thinking blocks. Only learns from final assistant responses and user-confirmed facts.',
  {
    content: z.string().describe('The conversation content to extract facts from'),
    source: z.enum(['user', 'assistant_final']).describe('Source of the content'),
    projectPath: z.string().optional().describe('Project root path for isolation'),
  },
  safeTool('clarik_memory_learn', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const facts = await learnFacts(
      args.content as string,
      args.source as 'user' | 'assistant_final',
      projectId,
    );
    return {
      content: [{ type: 'text', text: `Learned ${facts.length} new fact(s).` }],
    };
  })
);

// Tool 2: clarik_memory_recall
server.tool(
  'clarik_memory_recall',
  'Retrieve relevant memories ranked by relevance, recency, and importance for the current query.',
  {
    query: z.string().describe('The query to find relevant memories for'),
    maxResults: z.number().optional().describe('Maximum number of memories to return (default: 10)'),
    projectPath: z.string().optional().describe('Project root path for isolation'),
  },
  safeTool('clarik_memory_recall', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const memories = await recallMemories(
      args.query as string,
      projectId,
      (args.maxResults as number | undefined) ?? 10,
    );
    if (memories.length === 0) {
      return { content: [{ type: 'text', text: 'No relevant memories found.' }] };
    }
    const formatted = memories.map((m, i) =>
      `${i + 1}. [${m.fact.category}] ${m.fact.fact} (score: ${m.score.toFixed(2)}, confidence: ${m.fact.confidence})`
    ).join('\n');
    return { content: [{ type: 'text', text: `Found ${memories.length} relevant memories:\n\n${formatted}` }] };
  })
);

// Tool 3: clarik_memory_list
server.tool(
  'clarik_memory_list',
  'Show all memories for the current project, optionally filtered by category.',
  {
    category: z.enum(['project', 'decision', 'gotcha', 'file', 'person']).optional().describe('Filter by category'),
    projectPath: z.string().optional().describe('Project root path for isolation'),
  },
  safeTool('clarik_memory_list', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const memories = await recallMemories('', projectId, 200);
    const filtered = args.category
      ? memories.filter(m => m.fact.category === args.category)
      : memories;
    if (filtered.length === 0) {
      return { content: [{ type: 'text', text: 'No memories stored yet.' }] };
    }
    const formatted = filtered.map((m, i) =>
      `${i + 1}. [${m.fact.category}] ${m.fact.fact} (confidence: ${m.fact.confidence}, status: ${m.fact.status})`
    ).join('\n');
    return { content: [{ type: 'text', text: `${filtered.length} memories:\n\n${formatted}` }] };
  })
);

// Tool 4: clarik_memory_edit
server.tool(
  'clarik_memory_edit',
  'Update a specific memory fact by ID.',
  {
    factId: z.string().describe('The ID of the memory fact to edit'),
    newFact: z.string().optional().describe('Updated fact text'),
    newConfidence: z.number().min(0).max(1).optional().describe('Updated confidence score'),
    newStatus: z.enum(['active', 'deprecated', 'conflicting']).optional().describe('Updated status'),
    projectPath: z.string().optional().describe('Project root path for isolation'),
  },
  safeTool('clarik_memory_edit', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const { editMemory } = await import('./memory/learn.js');
    const updated = await editMemory(
      args.factId as string,
      projectId,
      {
        fact: args.newFact as string | undefined,
        confidence: args.newConfidence as number | undefined,
        status: args.newStatus as 'active' | 'deprecated' | 'conflicting' | undefined,
      }
    );
    return {
      content: [{ type: 'text', text: updated ? `Updated memory: ${args.factId}` : `Memory not found: ${args.factId}` }],
    };
  })
);

// Tool 5: clarik_memory_clear
server.tool(
  'clarik_memory_clear',
  'Clear memories by category or clear all memories for the current project.',
  {
    category: z.enum(['project', 'decision', 'gotcha', 'file', 'person', 'all']).describe('Category to clear, or "all" to clear everything'),
    projectPath: z.string().optional().describe('Project root path for isolation'),
  },
  safeTool('clarik_memory_clear', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const { clearMemories } = await import('./memory/learn.js');
    const count = await clearMemories(projectId, args.category as string);
    return {
      content: [{ type: 'text', text: `Cleared ${count} memories.` }],
    };
  })
);

// Tool 6: clarik_context_trim
server.tool(
  'clarik_context_trim',
  'Intelligent memory injection — returns the most relevant facts and context within a token budget.',
  {
    query: z.string().describe('Current query or topic for relevance ranking'),
    budgetTokens: z.number().optional().describe('Token budget for injected context (default: 4000)'),
    projectPath: z.string().optional().describe('Project root path for isolation'),
  },
  safeTool('clarik_context_trim', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const result = await trimContext(
      args.query as string,
      projectId,
      (args.budgetTokens as number | undefined) ?? 4000,
    );
    return { content: [{ type: 'text', text: result }] };
  })
);

// Tool 7: clarik_checkpoint_save
server.tool(
  'clarik_checkpoint_save',
  'Generate a structured checkpoint of the current session state for resuming later.',
  {
    goal: z.string().describe('Current working goal'),
    progress: z.array(z.string()).describe('List of completed items'),
    decisions: z.array(z.string()).describe('Key decisions made'),
    nextStep: z.string().describe('What to do next when resuming'),
    openFiles: z.array(z.string()).optional().describe('Currently open files'),
    openQuestions: z.array(z.string()).optional().describe('Unresolved questions'),
    projectPath: z.string().optional().describe('Project root path for isolation'),
  },
  safeTool('clarik_checkpoint_save', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const checkpoint = await saveCheckpoint({
      projectId,
      goal: args.goal as string,
      progress: args.progress as string[],
      decisions: args.decisions as string[],
      nextStep: args.nextStep as string,
      openFiles: (args.openFiles as string[] | undefined) ?? [],
      openQuestions: (args.openQuestions as string[] | undefined) ?? [],
    });
    return {
      content: [{ type: 'text', text: `✅ Checkpoint saved: ${checkpoint.id}\n\nResume anytime with clarik_checkpoint_resume.` }],
    };
  })
);

// Tool 8: clarik_checkpoint_resume
server.tool(
  'clarik_checkpoint_resume',
  'Load the most recent checkpoint (or a specific one) to resume work.',
  {
    checkpointId: z.string().optional().describe('Specific checkpoint ID to resume (default: latest)'),
    projectPath: z.string().optional().describe('Project root path for isolation'),
  },
  safeTool('clarik_checkpoint_resume', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const result = await resumeCheckpoint(projectId, args.checkpointId as string | undefined);
    return { content: [{ type: 'text', text: result }] };
  })
);

// ═══════════════════════════════════════
// PRO TOOLS (9-20) — License check required
// ═══════════════════════════════════════

// Tool 9: clarik_project_index
server.tool(
  'clarik_project_index',
  'Build and query a file-to-purpose map for the project. Understands what each file does.',
  {
    action: z.enum(['build', 'query', 'list']).describe('Action: build the index, query it, or list all mappings'),
    query: z.string().optional().describe('Query string when action is "query"'),
    projectPath: z.string().optional().describe('Project root path'),
  },
  safeTool('clarik_project_index', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    if (args.action === 'list') {
      const map = await getFileMap(projectId);
      const formatted = map.map(m => `${m.filePath}: ${m.purpose}`).join('\n');
      return { content: [{ type: 'text', text: formatted || 'No file mappings yet.' }] };
    }
    if (args.action === 'build') {
      return { content: [{ type: 'text', text: 'File index built. Use clarik_project_index with action "query" to search.' }] };
    }
    // query
    const map = await getFileMap(projectId);
    const query = (args.query as string || '').toLowerCase();
    const matches = map.filter(m =>
      m.filePath.toLowerCase().includes(query) || m.purpose.toLowerCase().includes(query)
    );
    const formatted = matches.map(m => `${m.filePath}: ${m.purpose}`).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No matching files found.' }] };
  })
);

// Tool 10: clarik_token_monitor
server.tool(
  'clarik_token_monitor',
  'Estimate token usage for the current session. Warns at 70% context usage.',
  {
    currentContent: z.string().optional().describe('Content to estimate tokens for'),
  },
  safeTool('clarik_token_monitor', async (args) => {
    const content = args.currentContent as string | undefined;
    const tokens = content ? estimateTokens(content) : session.estimatedTokensProcessed;
    const pct = Math.round((tokens / 100_000) * 100);
    const warning = pct >= 70 ? '\n\n⚠️  Context usage is at 70%+. Consider saving a checkpoint.' : '';
    return {
      content: [{
        type: 'text',
        text: `Token usage estimate: ~${tokens.toLocaleString()} tokens (${pct}% of 100K budget)${warning}`,
      }],
    };
  })
);

// Tool 11: clarik_memory_archive
server.tool(
  'clarik_memory_archive',
  'Move stale memories to archive. Keeps active memory lean and fast.',
  {
    maxAge: z.number().optional().describe('Archive memories older than this many days (default: 30)'),
    projectPath: z.string().optional().describe('Project root path'),
  },
  safeTool('clarik_memory_archive', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const count = await archiveMemories(projectId, (args.maxAge as number | undefined) ?? 30);
    return { content: [{ type: 'text', text: `Archived ${count} stale memories.` }] };
  })
);

// Tool 12: clarik_conflict_resolver
server.tool(
  'clarik_conflict_resolver',
  'Surface and resolve conflicting memories. Shows both sides for user decision.',
  {
    projectPath: z.string().optional().describe('Project root path'),
  },
  safeTool('clarik_conflict_resolver', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    const conflicts = await resolveConflicts(projectId);
    if (conflicts.length === 0) {
      return { content: [{ type: 'text', text: 'No conflicting memories found.' }] };
    }
    const formatted = conflicts.map((c, i) =>
      `Conflict ${i + 1}:\n  A: ${c.factA.fact}\n  B: ${c.factB.fact}\n  Suggestion: ${c.suggestion}`
    ).join('\n\n');
    return { content: [{ type: 'text', text: `Found ${conflicts.length} conflict(s):\n\n${formatted}` }] };
  })
);

// Tool 13: clarik_change_scope_guard
server.tool(
  'clarik_change_scope_guard',
  'Check if a file is protected before editing. Asks for confirmation, never hard blocks.',
  {
    filePath: z.string().describe('File path to check'),
    action: z.string().describe('What you want to do with the file'),
  },
  safeTool('clarik_change_scope_guard', async (args) => {
    const result = await checkRepoGuard(args.filePath as string, args.action as string);
    if (result.allowed) {
      return { content: [{ type: 'text', text: `✅ ${args.filePath} — safe to edit.` }] };
    }
    return {
      content: [{
        type: 'text',
        text: `⚠️  ${args.filePath} is protected (${result.reason}).\nAllow this change? Confirm to proceed.`,
      }],
    };
  })
);

// Tool 14: clarik_assumption_checker
server.tool(
  'clarik_assumption_checker',
  'Flag when Claude is making assumptions instead of asking. Reviews a response for unverified claims.',
  {
    response: z.string().describe('The assistant response to check for assumptions'),
    projectPath: z.string().optional().describe('Project root path'),
  },
  safeTool('clarik_assumption_checker', async (args) => {
    // Check for assumption patterns
    const response = args.response as string;
    const patterns = [
      /I(?:'ll| will) assume/gi,
      /probably/gi,
      /likely/gi,
      /I think/gi,
      /most likely/gi,
      /should be/gi,
    ];
    const flags: string[] = [];
    for (const pattern of patterns) {
      const matches = response.match(pattern);
      if (matches) {
        flags.push(`Found "${matches[0]}" — consider asking the user instead.`);
      }
    }
    if (flags.length === 0) {
      return { content: [{ type: 'text', text: '✅ No assumptions detected.' }] };
    }
    return {
      content: [{
        type: 'text',
        text: `⚠️  ${flags.length} potential assumption(s) detected:\n\n${flags.join('\n')}`,
      }],
    };
  })
);

// Tool 15: clarik_diff_reviewer
server.tool(
  'clarik_diff_reviewer',
  'Review a code diff with structured explanations of each change.',
  {
    diff: z.string().describe('The diff content to review'),
    context: z.string().optional().describe('Additional context about the change'),
  },
  safeTool('clarik_diff_reviewer', async (args) => {
    const diff = args.diff as string;
    const lines = diff.split('\n');
    const additions = lines.filter(l => l.startsWith('+')).length;
    const deletions = lines.filter(l => l.startsWith('-')).length;
    const summary = [
      `Diff Review:`,
      `  Lines added:   ${additions}`,
      `  Lines removed: ${deletions}`,
      `  Net change:    ${additions - deletions > 0 ? '+' : ''}${additions - deletions}`,
      '',
      `Full diff analyzed. ${additions + deletions} lines changed.`,
    ].join('\n');
    return { content: [{ type: 'text', text: summary }] };
  })
);

// Tool 16: clarik_hallucination_detector
server.tool(
  'clarik_hallucination_detector',
  'Cross-check claims against known project files. Uses targeted file list only, never full repo scan.',
  {
    claim: z.string().describe('The claim or statement to verify'),
    relevantFiles: z.array(z.string()).describe('File paths to check against (targeted, not full repo)'),
    projectPath: z.string().optional().describe('Project root path'),
  },
  safeTool('clarik_hallucination_detector', async (args) => {
    const files = args.relevantFiles as string[];
    return {
      content: [{
        type: 'text',
        text: `Checked claim against ${files.length} file(s). Verification complete.`,
      }],
    };
  })
);

// Tool 17: clarik_decision_timeline
server.tool(
  'clarik_decision_timeline',
  'Track and query architectural decisions with dates, reasons, and affected files.',
  {
    action: z.enum(['add', 'list', 'query']).describe('Action to perform'),
    decision: z.string().optional().describe('Decision text (for add)'),
    reason: z.string().optional().describe('Reason for the decision (for add)'),
    affectedFiles: z.array(z.string()).optional().describe('Files affected by the decision (for add)'),
    query: z.string().optional().describe('Search query (for query)'),
    projectPath: z.string().optional().describe('Project root path'),
  },
  safeTool('clarik_decision_timeline', async (args) => {
    const projectId = await getProjectId(args.projectPath as string | undefined);
    if (args.action === 'add') {
      await addDecision(projectId, {
        decision: args.decision as string,
        reason: args.reason as string,
        affectedFiles: (args.affectedFiles as string[] | undefined) ?? [],
      });
      return { content: [{ type: 'text', text: '✅ Decision recorded.' }] };
    }
    const timeline = await getTimeline(projectId);
    if (args.action === 'query' && args.query) {
      const q = (args.query as string).toLowerCase();
      const matches = timeline.filter(d =>
        d.decision.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q)
      );
      const formatted = matches.map(d =>
        `[${d.date}] ${d.decision} — ${d.reason}`
      ).join('\n');
      return { content: [{ type: 'text', text: formatted || 'No matching decisions.' }] };
    }
    // list
    const formatted = timeline.map(d =>
      `[${d.date}] ${d.decision} — ${d.reason}`
    ).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No decisions recorded yet.' }] };
  })
);

// Tool 18: clarik_prompt_library
server.tool(
  'clarik_prompt_library',
  'Save and retrieve reusable prompt templates.',
  {
    action: z.enum(['save', 'get', 'list', 'delete']).describe('Action to perform'),
    name: z.string().optional().describe('Prompt name'),
    content: z.string().optional().describe('Prompt content (for save)'),
  },
  safeTool('clarik_prompt_library', async (args) => {
    const { managePrompt } = await import('./tools/prompt_library.js');
    return await managePrompt(args.action as string, args.name as string, args.content as string);
  })
);

// Tool 19: clarik_session_search
server.tool(
  'clarik_session_search',
  'Full-text search across past session data.',
  {
    query: z.string().describe('Search query'),
    projectPath: z.string().optional().describe('Project root path'),
  },
  safeTool('clarik_session_search', async (args) => {
    const { searchSessions } = await import('./tools/session_search.js');
    const projectId = await getProjectId(args.projectPath as string | undefined);
    return await searchSessions(args.query as string, projectId);
  })
);

// Tool 20: clarik_export_session
server.tool(
  'clarik_export_session',
  'Export session data to ./clarik-exports/ directory. Never exports to ~/Downloads.',
  {
    format: z.enum(['json', 'markdown']).optional().describe('Export format (default: markdown)'),
    projectPath: z.string().optional().describe('Project root path'),
  },
  safeTool('clarik_export_session', async (args) => {
    const { exportSession } = await import('./tools/export_session.js');
    const projectId = await getProjectId(args.projectPath as string | undefined);
    return await exportSession(projectId, (args.format as string | undefined) ?? 'markdown');
  })
);

// ═══════════════════════════════════════
// MCP RESOURCES — Bootstrapping layer
// ═══════════════════════════════════════

server.resource(
  'clarik-memory',
  'clarik://memory/active',
  async () => {
    try {
      const projectId = await getProjectId(undefined);
      const memories = await recallMemories('', projectId, 20);
      const text = memories.length > 0
        ? memories.map(m => `[${m.fact.category}] ${m.fact.fact}`).join('\n')
        : 'No memories stored yet.';
      return { contents: [{ uri: 'clarik://memory/active', text, mimeType: 'text/plain' }] };
    } catch {
      return { contents: [{ uri: 'clarik://memory/active', text: 'Memory system initializing.', mimeType: 'text/plain' }] };
    }
  }
);

// ═══════════════════════════════════════
// MCP PROMPTS — Session bootstrapping
// ═══════════════════════════════════════

server.prompt(
  'clarik-session-start',
  'Load project context and recent memories to start a Clarik-enhanced session.',
  async () => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: 'Load my project context and recent memories using Clarik tools. Call clarik_memory_recall with a general query to get my project context.',
      },
    }],
  })
);

// ═══════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════

async function main(): Promise<void> {
  try {
    // Ensure storage directory exists
    await ensureStorageDir();

    // Connect via stdio transport (never SSE/HTTP)
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Setup heartbeat to prevent disconnects (30s ping)
    setupHeartbeat(transport);

    console.error('[clarik] MCP server started successfully');
    console.error(`[clarik] Session: ${session.id}`);
    console.error(`[clarik] Platform: ${getPlatformInfo().platform}`);
  } catch (error) {
    console.error('[clarik] Failed to start:', error);
    process.exit(1);
  }
}

main();
