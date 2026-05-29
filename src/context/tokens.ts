// ─── Clarik Token Estimation ───
// Local token estimation without external API calls.
// Uses @anthropic-ai/tokenizer for true Anthropic-native token counting.

import { countTokens } from '@anthropic-ai/tokenizer';

/**
 * Estimate the number of tokens in a text string.
 * Uses @anthropic-ai/tokenizer for precise token counting.
 */
export function estimateTokens(text: string): number {
  try {
    if (!text || text.length === 0) {
      return 0;
    }
    return countTokens(text);
  } catch (error) {
    // Fallback: return a safe character-based estimate in case of error
    console.error('[clarik] Tokenizer error, falling back to heuristic:', error);
    const CHARS_PER_TOKEN = 4;
    const SAFETY_MULTIPLIER = 1.1;
    return Math.ceil(((text?.length ?? 0) / CHARS_PER_TOKEN) * SAFETY_MULTIPLIER);
  }
}

/**
 * Estimate total tokens across an array of chat messages.
 * Accounts for role labels and message structure overhead (~4 tokens per message).
 */
export function estimateTokensForMessages(
  messages: Array<{ role: string; content: string }>
): number {
  try {
    if (!messages || messages.length === 0) {
      return 0;
    }

    let total = 0;
    const MESSAGE_OVERHEAD = 4; // tokens for role, delimiters, etc.

    for (const msg of messages) {
      total += estimateTokens(msg.content ?? '');
      total += estimateTokens(msg.role ?? '');
      total += MESSAGE_OVERHEAD;
    }

    // Add a small fixed overhead for the entire conversation structure
    total += 3; // priming tokens

    return total;
  } catch {
    return 0;
  }
}

/**
 * Check if a text string fits within a token budget.
 */
export function isWithinBudget(text: string, budget: number): boolean {
  try {
    if (budget <= 0) return false;
    return estimateTokens(text) <= budget;
  } catch {
    return false;
  }
}
