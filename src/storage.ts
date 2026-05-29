// ─── Clarik Storage Layer ───
// All file I/O for memory, checkpoints, config, etc.
// ALWAYS uses path.join / os.homedir() — never hardcoded ~/ or platform-specific separators.
// Atomic writes: write to .tmp then rename to prevent corruption.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

// ─── Base Paths ───

const CLARIK_DIR = '.clarik';

export function getBaseDir(): string {
  return path.join(os.homedir(), CLARIK_DIR);
}

export function getProjectDir(projectId: string): string {
  return path.join(getBaseDir(), 'projects', projectId);
}

export function getCheckpointDir(): string {
  return path.join(getBaseDir(), 'checkpoints');
}

export function getSessionDir(): string {
  return path.join(getBaseDir(), 'sessions');
}

export function getConfigPath(): string {
  return path.join(getBaseDir(), 'config.json');
}

export function getLicensePath(): string {
  return path.join(getBaseDir(), 'license.json');
}

export function getPromptsPath(): string {
  return path.join(getBaseDir(), 'prompts.json');
}

export function getAnalyticsPath(): string {
  return path.join(getBaseDir(), 'analytics.json');
}

export function getStoragePath(...segments: string[]): string {
  return path.join(getBaseDir(), ...segments);
}

// ─── Directory Setup ───

export async function ensureStorageDir(): Promise<void> {
  const dirs = [
    getBaseDir(),
    path.join(getBaseDir(), 'projects'),
    getCheckpointDir(),
    getSessionDir(),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function ensureProjectDir(projectId: string): Promise<void> {
  const dir = getProjectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
}

// ─── Atomic File I/O ───
// Write to .tmp first, then rename. Prevents corruption from partial writes.

export async function writeJsonAtomic<T>(filePath: string, data: T): Promise<void> {
  const tmpPath = filePath + '.tmp';
  const backupPath = filePath + '.bak';
  const content = JSON.stringify(data, null, 2);

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Write to temp file
  await fs.writeFile(tmpPath, content, 'utf-8');

  // Backup existing file if it exists
  try {
    await fs.access(filePath);
    await fs.copyFile(filePath, backupPath);
  } catch {
    // File doesn't exist yet, no backup needed
  }

  // Rename temp to target (atomic on most filesystems)
  await fs.rename(tmpPath, filePath);
}

export async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    // Try backup if main file is corrupted or missing
    try {
      const backupPath = filePath + '.bak';
      const content = await fs.readFile(backupPath, 'utf-8');
      console.error(`[clarik] Recovered from backup: ${filePath}`);
      return JSON.parse(content) as T;
    } catch {
      return defaultValue;
    }
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Hashing Utilities ───

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateId(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hash = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${date}_${hash}`;
}

// ─── Export Path ───
// ALWAYS ./clarik-exports/ — NEVER ~/Downloads

export function getExportDir(projectRoot?: string): string {
  const base = projectRoot || process.cwd();
  return path.join(base, 'clarik-exports');
}
