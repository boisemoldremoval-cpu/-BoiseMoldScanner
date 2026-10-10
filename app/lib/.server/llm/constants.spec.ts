import { describe, expect, it } from 'vitest';
import {
  MAX_RESPONSE_SEGMENTS,
  MAX_TOKENS,
  PROVIDER_COMPLETION_LIMITS,
  isReasoningModel,
  rejectsSamplingParams,
} from './constants';

describe('LLM constants', () => {
  it('keeps the OpenRouter completion limit within the affordable token budget', () => {
    /*
     * The OpenRouter key used by the e2e suite has a limited balance and rejects
     * requests whose `max_tokens` exceed what it can afford. Raising this without
     * checking the key budget reintroduces HTTP 402 failures that surface as
     * "Server Error" mid-stream, so it is pinned deliberately.
     */
    expect(PROVIDER_COMPLETION_LIMITS.OpenRouter).toBe(4096);
  });

  it('defines a completion limit for every registered cloud provider', () => {
    for (const provider of ['OpenAI', 'Anthropic', 'Google', 'OpenRouter', 'Groq', 'xAI']) {
      expect(PROVIDER_COMPLETION_LIMITS[provider]).toBeGreaterThan(0);
    }
  });

  it('exposes a global fallback token cap', () => {
    expect(MAX_TOKENS).toBeGreaterThan(0);
  });

  it('allows a limited number of continuation segments', () => {
    expect(MAX_RESPONSE_SEGMENTS).toBe(2);
  });

  describe('isReasoningModel', () => {
    it.each([
      ['o1', true],
      ['o1-mini', true],
      ['o1-preview', true],
      ['o3', true],
      ['o3-mini', true],
      ['gpt-5', true],
      ['gpt-5-mini', true],
      ['GPT-5', true],
      ['claude-3-5-sonnet-latest', false],
      ['gpt-4o', false],
      ['gpt-4', false],
      ['gemini-2.0-flash', false],
      ['', false],
    ])('classifies %s as reasoning=%s', (model, expected) => {
      expect(isReasoningModel(model)).toBe(expected);
    });

    it('only matches bare model ids because the pattern is anchored', () => {
      /*
       * OpenRouter model ids are namespaced (`openai/o3`), so they are NOT
       * detected as reasoning models. Pinned because the AI SDK migration
       * changes how reasoning models are identified; if this flips, reasoning
       * models start receiving sampling parameters they do not accept.
       */
      expect(isReasoningModel('openai/o3')).toBe(false);
      expect(isReasoningModel('openai/gpt-5')).toBe(false);
      expect(isReasoningModel('stealth/space-bunny-alpha')).toBe(false);
    });
  });

  describe('rejectsSamplingParams', () => {
    it.each([
      ['claude-opus-5-5', true],
      ['claude-sonnet-5-5', true],
      ['claude-haiku-5-5', true],
      ['claude-fable-5-1', true],
      ['claude-opus-4-8', true],
      ['anthropic/claude-sonnet-5-5', true],
      ['anthropic.claude-opus-5-5', true],
      ['claude-sonnet-4-6', false],
      ['claude-haiku-4-5', false],
      ['gpt-4o', false],
      ['llama3.1:8b', false],
      ['', false],
    ])('classifies %s as %s', (model, expected) => {
      expect(rejectsSamplingParams(model)).toBe(expected);
    });
  });
});
