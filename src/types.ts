// ─── Clarik Shared Types ───
// All core interfaces and types used across the system.

// ─── Memory Types ───

export type MemoryCategory = 'project' | 'decision' | 'gotcha' | 'file' | 'person';
export type MemoryStatus = 'active' | 'deprecated' | 'conflicting';
export type MemorySource = 'user' | 'assistant_final';

export interface MemoryFact {
  id: string;
  category: MemoryCategory;
  fact: string;
  confidence: number;         // 0.0 - 1.0
  timesReferenced: number;
  createdAt: string;          // ISO date
  lastUsed: string;           // ISO date
  status: MemoryStatus;
  projectId: string;          // repo/workspace hash
  source: MemorySource;       // never from thinking blocks
  tags?: string[];            // optional keyword tags for search
}

export interface MemoryStore {
  version: number;
  projectId: string;
  facts: MemoryFact[];
  lastUpdated: string;
}

// ─── Checkpoint Types ───

export interface Checkpoint {
  id: string;                  // chk_{date}_{hash}
  created: string;             // ISO timestamp
  projectId: string;
  goal: string;
  progress: string[];
  decisions: string[];
  nextStep: string;
  openFiles: string[];
  openQuestions: string[];
  contextUsedPct: number;
}

export interface CheckpointStore {
  version: number;
  projectId: string;
  checkpoints: Checkpoint[];
}

// ─── License Types ───

export interface LicenseCache {
  signedResponse: string;      // raw Gumroad response
  responseHash: string;        // SHA-256 of response
  validUntil: string;          // ISO date
  offlineGraceExpiry: string;  // 5 days from last valid check
}

export type LicenseTier = 'free' | 'pro' | 'team';

export interface LicenseStatus {
  tier: LicenseTier;
  isValid: boolean;
  isOffline: boolean;
  graceDaysRemaining: number;
  expiresAt?: string;
}

// ─── Safety Types ───

export type SafeMode = 'safe' | 'strict' | 'minimal' | 'creative';

export interface SafeModeConfig {
  mode: SafeMode;
  memoryEnabled: boolean;
  checkpointsEnabled: boolean;
  repoGuardEnabled: boolean;
  confirmProtectedFiles: boolean;
  allowAssumptions: boolean;
}

export interface RepoGuardResult {
  allowed: boolean;
  filePath: string;
  reason: string;
  userConfirmed: boolean;
}

// ─── Context Types ───

export interface TokenBudget {
  total: number;
  systemMemory: number;
  fileMap: number;
  currentMessage: number;
  recentHistory: number;
  rankedHistory: number;
  fileContext: number;
  safetyBuffer: number;
}

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  total: 100_000,
  systemMemory: 4_000,
  fileMap: 1_000,
  currentMessage: 2_000,
  recentHistory: 20_000,
  rankedHistory: 15_000,
  fileContext: 50_000,
  safetyBuffer: 8_000,
};

export interface RankedMemory {
  fact: MemoryFact;
  score: number;
  breakdown: {
    relevance: number;
    recency: number;
    importance: number;
  };
}

// ─── Intelligence Types ───

export interface FileMapping {
  filePath: string;
  purpose: string;
  lastUpdated: string;
}

export interface FileMapStore {
  version: number;
  projectId: string;
  mappings: FileMapping[];
}

export interface Decision {
  id: string;
  date: string;
  decision: string;
  reason: string;
  affectedFiles: string[];
  supersedes?: string;       // ID of decision this replaces
}

export interface DecisionTimeline {
  version: number;
  projectId: string;
  decisions: Decision[];
}

// ─── Config Types ───

export interface ClarikConfig {
  disclaimerShown: boolean;
  mode: SafeMode;
  projectId: string;
  version: string;
  installedAt: string;
}

// ─── Session Types ───

export interface SessionInfo {
  id: string;
  projectId: string;
  startedAt: string;
  toolCallCount: number;
  proToolPromptShown: boolean;  // only show once per session
  estimatedTokensProcessed: number;
}

// ─── Analytics Types ───

export interface ToolUsageStats {
  toolName: string;
  callCount: number;
  lastUsed: string;
}

export interface Analytics {
  version: number;
  totalSessions: number;
  toolUsage: ToolUsageStats[];
  memoriesCreated: number;
  memoriesRecalled: number;
  checkpointsSaved: number;
  checkpointsResumed: number;
}

// ─── Tool Result Types ───

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// ─── Free vs Pro Tool Classification ───

export const FREE_TOOLS = [
  'clarik_memory_learn',
  'clarik_memory_recall',
  'clarik_memory_list',
  'clarik_memory_edit',
  'clarik_memory_clear',
  'clarik_context_trim',
  'clarik_checkpoint_save',
  'clarik_checkpoint_resume',
] as const;

export const PRO_TOOLS = [
  'clarik_project_index',
  'clarik_token_monitor',
  'clarik_memory_archive',
  'clarik_conflict_resolver',
  'clarik_change_scope_guard',
  'clarik_assumption_checker',
  'clarik_diff_reviewer',
  'clarik_hallucination_detector',
  'clarik_decision_timeline',
  'clarik_prompt_library',
  'clarik_session_search',
  'clarik_export_session',
] as const;

export type FreeToolName = typeof FREE_TOOLS[number];
export type ProToolName = typeof PRO_TOOLS[number];
export type ClarikToolName = FreeToolName | ProToolName;
