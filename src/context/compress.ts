// ─── Clarik Context Compression ───
// Summarizes stale conversation history to free up context budget.
// Preserves critical information: decisions, accepted patterns, error resolutions.

/**
 * Signal phrases that indicate content worth preserving verbatim.
 * If a message contains any of these, its key content is kept in full.
 */
const PRESERVE_SIGNALS: string[] = [
  // Decisions
  'decided to', 'decision:', 'we agreed', 'let\'s go with', 'going with',
  'chose to', 'the plan is', 'approach:', 'strategy:',
  // Accepted patterns
  'accepted', 'approved', 'confirmed', 'looks good', 'lgtm',
  'correct approach', 'right pattern', 'use this pattern',
  // Error resolutions
  'fixed by', 'resolved by', 'the fix is', 'the issue was', 'root cause',
  'solution:', 'workaround:', 'error was',
  // Important context
  'important:', 'note:', 'remember:', 'don\'t forget', 'critical:',
  'requirement:', 'constraint:', 'must ', 'never ',
];

/**
 * Check whether a message contains preservable signal phrases.
 */
function containsPreserveSignal(content: string): boolean {
  const lower = content.toLowerCase();
  return PRESERVE_SIGNALS.some(signal => lower.includes(signal));
}

/**
 * Extract the most meaningful sentence from a message.
 * Looks for sentences containing signal phrases, otherwise takes the first sentence.
 */
function extractKeySentence(content: string): string {
  const sentences = content
    .split(/[.!?\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  if (sentences.length === 0) {
    return content.slice(0, 150).trim();
  }

  // Prefer sentences with signal phrases
  const lower = content.toLowerCase();
  for (const signal of PRESERVE_SIGNALS) {
    if (lower.includes(signal)) {
      const signalSentence = sentences.find(s =>
        s.toLowerCase().includes(signal)
      );
      if (signalSentence) {
        return signalSentence.length > 200
          ? signalSentence.slice(0, 200) + '...'
          : signalSentence;
      }
    }
  }

  // Fallback: first meaningful sentence
  const first = sentences[0];
  return first.length > 200 ? first.slice(0, 200) + '...' : first;
}

/**
 * Compress conversation history by summarizing older messages.
 *
 * - Keeps the last `maxMessages` messages intact.
 * - Older messages are compressed into a bullet-point summary.
 * - Messages with signal phrases (decisions, fixes, etc.) are preserved more fully.
 *
 * @param messages  Full conversation history
 * @param maxMessages  Number of recent messages to keep intact
 * @returns Compressed summary string of older messages
 */
export async function compressHistory(
  messages: Array<{ role: string; content: string }>,
  maxMessages: number
): Promise<string> {
  try {
    if (!messages || messages.length === 0) {
      return '';
    }

    // If we're within the limit, no compression needed
    if (messages.length <= maxMessages) {
      return '';
    }

    const olderMessages = messages.slice(0, messages.length - maxMessages);
    const preservedItems: string[] = [];
    const summaryItems: string[] = [];

    for (const msg of olderMessages) {
      if (!msg.content || msg.content.trim().length === 0) {
        continue;
      }

      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';

      if (containsPreserveSignal(msg.content)) {
        // Preserve key content from important messages
        const key = extractKeySentence(msg.content);
        preservedItems.push(`• [${roleLabel}] ${key}`);
      } else {
        // Summarize non-critical messages briefly
        const brief = msg.content.slice(0, 100).trim().replace(/\n/g, ' ');
        const suffix = msg.content.length > 100 ? '...' : '';
        summaryItems.push(`• [${roleLabel}] ${brief}${suffix}`);
      }
    }

    // Build the compressed output
    const sections: string[] = [];

    sections.push(`── Compressed History (${olderMessages.length} older messages) ──`);

    if (preservedItems.length > 0) {
      sections.push('');
      sections.push('Key Decisions & Resolutions:');
      sections.push(...preservedItems);
    }

    if (summaryItems.length > 0) {
      sections.push('');
      sections.push('General Discussion Summary:');
      // Limit general summaries to keep things compact
      const maxSummaries = 15;
      if (summaryItems.length > maxSummaries) {
        sections.push(...summaryItems.slice(0, maxSummaries));
        sections.push(`  ... and ${summaryItems.length - maxSummaries} more messages`);
      } else {
        sections.push(...summaryItems);
      }
    }

    return sections.join('\n');
  } catch (error) {
    console.error('[clarik] Error compressing history:', error);
    return '';
  }
}
