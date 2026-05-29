// ─── Safety Modes ───
// Four modes controlling guard behavior, memory, and checkpoints.
// safe: default — guards active, memory on, checkpoints on
// strict: repo_guard requires confirmation, no assumptions
// minimal: memory off, context trim only, maximum privacy
// creative: guards relaxed, wider scope, experimental

import { SafeMode, SafeModeConfig, ClarikConfig } from '../types.js';
import { getConfigPath, readJson, writeJsonAtomic } from '../storage.js';

/** Static mode configurations — no runtime mutation */
const MODE_CONFIGS: Record<SafeMode, SafeModeConfig> = {
  safe: {
    mode: 'safe',
    memoryEnabled: true,
    checkpointsEnabled: true,
    repoGuardEnabled: true,
    confirmProtectedFiles: true,
    allowAssumptions: true,
  },
  strict: {
    mode: 'strict',
    memoryEnabled: true,
    checkpointsEnabled: true,
    repoGuardEnabled: true,
    confirmProtectedFiles: true,
    allowAssumptions: false,
  },
  minimal: {
    mode: 'minimal',
    memoryEnabled: false,
    checkpointsEnabled: false,
    repoGuardEnabled: false,
    confirmProtectedFiles: false,
    allowAssumptions: true,
  },
  creative: {
    mode: 'creative',
    memoryEnabled: true,
    checkpointsEnabled: true,
    repoGuardEnabled: false,
    confirmProtectedFiles: false,
    allowAssumptions: true,
  },
};

const DEFAULT_CONFIG: ClarikConfig = {
  disclaimerShown: false,
  mode: 'safe',
  projectId: '',
  version: '1.0.0',
  installedAt: new Date().toISOString(),
};

/**
 * Get the SafeModeConfig for a given mode.
 * Defaults to 'safe' if no mode is specified.
 */
export function getSafeModeConfig(mode?: SafeMode): SafeModeConfig {
  const resolvedMode = mode ?? 'safe';
  return { ...MODE_CONFIGS[resolvedMode] };
}

/**
 * Get the current safety mode from persisted config.
 * Returns 'safe' if no config exists.
 */
export async function getCurrentMode(): Promise<SafeMode> {
  try {
    const config = await readJson<ClarikConfig>(getConfigPath(), DEFAULT_CONFIG);
    return config.mode ?? 'safe';
  } catch (error) {
    console.error('[clarik] Error reading current mode:', error);
    return 'safe';
  }
}

/**
 * Set the safety mode and persist to config.
 */
export async function setMode(mode: SafeMode): Promise<void> {
  try {
    const config = await readJson<ClarikConfig>(getConfigPath(), DEFAULT_CONFIG);
    const updated: ClarikConfig = {
      ...config,
      mode,
    };
    await writeJsonAtomic(getConfigPath(), updated);
  } catch (error) {
    console.error('[clarik] Error setting mode:', error);
    throw new Error(`Failed to set safety mode to '${mode}': ${error}`);
  }
}
