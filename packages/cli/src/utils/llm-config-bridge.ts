/**
 * Bridge between CLI PhalanxConfig and core PhalanxLLMConfig.
 * Converts the CLI's config format into the format expected by createLLMStack().
 */
import type { PhalanxLLMConfig } from '@phalanx/core';
import type { PhalanxConfig } from './config-loader.js';

/**
 * Convert the CLI config's LLM section into a PhalanxLLMConfig
 * suitable for passing to createLLMStack().
 */
export function toPhalanxLLMConfig(config: PhalanxConfig): PhalanxLLMConfig {
  return {
    systemDefault: config.llm.systemDefault,
    providers: Object.fromEntries(
      Object.entries(config.llm.providers)
        .filter(([_, entry]) => entry.enabled)
        .map(([name, entry]) => [
          name,
          {
            ...(entry.defaultModel && { defaultModel: entry.defaultModel }),
            ...(entry.baseUrl && { baseUrl: entry.baseUrl }),
          },
        ]),
    ),
  };
}
