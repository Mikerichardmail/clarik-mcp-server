import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// Mock the tokenizer to verify fallback mechanisms if needed
jest.mock('@anthropic-ai/tokenizer', () => {
  const original = jest.requireActual('@anthropic-ai/tokenizer') as any;
  return {
    __esModule: true,
    ...original,
    countTokens: jest.fn((text: string) => {
      if (text === 'TRIGGER_MOCK_ERROR') {
        throw new Error('Simulated tokenizer error');
      }
      return original.countTokens(text);
    }),
  };
});

describe('Clarik Token Estimation', () => {
  let estimateTokens: any;
  let estimateTokensForMessages: any;
  let isWithinBudget: any;
  let countTokensMock: any;

  beforeAll(async () => {
    const tokenizerMod = await import('@anthropic-ai/tokenizer') as any;
    countTokensMock = tokenizerMod.countTokens;

    const mod = await import('./tokens.js');
    estimateTokens = mod.estimateTokens;
    estimateTokensForMessages = mod.estimateTokensForMessages;
    isWithinBudget = mod.isWithinBudget;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('estimateTokens', () => {
    it('should return 0 for empty or undefined text', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens(undefined as any)).toBe(0);
    });

    it('should use @anthropic-ai/tokenizer for precise token counting', () => {
      const text = 'Hello world, this is a test string.';
      const result = estimateTokens(text);
      expect(countTokensMock).toHaveBeenCalledWith(text);
      expect(result).toBeGreaterThan(0);
    });

    it('should gracefully fall back to character-based heuristic on error', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const text = 'TRIGGER_MOCK_ERROR';
      const result = estimateTokens(text);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      // Heuristic: Math.ceil((18 / 4) * 1.1) = Math.ceil(4.5 * 1.1) = Math.ceil(4.95) = 5 tokens
      expect(result).toBe(5);
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('estimateTokensForMessages', () => {
    it('should return 0 for empty message arrays', () => {
      expect(estimateTokensForMessages([])).toBe(0);
      expect(estimateTokensForMessages(undefined as any)).toBe(0);
    });

    it('should aggregate tokens and include message structure overhead', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];
      // Hello (1 token) + user (1 token) + Hi there (2 tokens) + assistant (1 token)
      // Message overhead: 2 * 4 = 8 tokens
      // Priming: 3 tokens
      // Expected: ~16 tokens
      const result = estimateTokensForMessages(messages);
      expect(result).toBeGreaterThan(10);
    });
  });

  describe('isWithinBudget', () => {
    it('should return false for negative or zero budgets', () => {
      expect(isWithinBudget('Hello', 0)).toBe(false);
      expect(isWithinBudget('Hello', -5)).toBe(false);
    });

    it('should return true if content is within token budget', () => {
      expect(isWithinBudget('Hello', 100)).toBe(true);
    });

    it('should return false if content exceeds token budget', () => {
      expect(isWithinBudget('A very long string that will definitely exceed a budget of one token.', 1)).toBe(false);
    });
  });
});
