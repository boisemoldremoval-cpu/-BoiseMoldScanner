import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class AnthropicProvider extends BaseProvider {
  name = 'Anthropic';
  getApiKeyLink = 'https://console.anthropic.com/settings/keys';

  config = {
    apiTokenKey: 'ANTHROPIC_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'claude-opus-5-5',
      label: 'Claude Opus 5.5',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-sonnet-5-5',
      label: 'Claude Sonnet 5.5',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-haiku-5-5',
      label: 'Claude Haiku 5.5',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-fable-5-1',
      label: 'Claude Fable 5.1',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-opus-5',
      label: 'Claude Opus 5',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-sonnet-5',
      label: 'Claude Sonnet 5',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-opus-4-8',
      label: 'Claude Opus 4.8',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-sonnet-4-6',
      label: 'Claude Sonnet 4.6',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-haiku-4-5',
      label: 'Claude Haiku 4.5',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.anthropic.com/v1/models`, {
      headers: {
        'x-api-key': `${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter((model: any) => model.type === 'model' && !staticModelIds.includes(model.id));

    return data.map((m: any) => {
      /*
       * The Models API reports the context window as max_input_tokens and the
       * output cap as max_tokens. Older responses lack both, so fall back to
       * conservative defaults.
       */
      const contextWindow: number = m.max_input_tokens ?? 200000;
      const maxCompletionTokens: number = m.max_tokens ?? 64000;

      return {
        name: m.id,
        label: `${m.display_name} (${Math.floor(contextWindow / 1000)}k context)`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens,
      };
    });
  }

  getModelInstance: (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModel = (options) => {
    const { apiKeys, providerSettings, serverEnv, model } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });
    const anthropic = createAnthropic({
      apiKey,
      headers: { 'anthropic-beta': 'output-128k-2025-02-19' },
    });

    return anthropic(model);
  };
}
