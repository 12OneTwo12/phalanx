/**
 * Bridge between CLI PhalanxConfig and core PhalanxLLMConfig.
 * Converts the CLI's config format into the format expected by createLLMStack().
 * Injects stored credentials from the credential store.
 */
import type { PhalanxLLMConfig, ProviderConfig } from '@phalanx/core';
import type { PhalanxConfig } from './config-loader.js';
import { loadCredential } from './credential-store.js';

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
        .map(([name, entry]) => {
          const providerConfig: ProviderConfig = {
            ...(entry.defaultModel && { defaultModel: entry.defaultModel }),
            ...(entry.baseUrl && { baseUrl: entry.baseUrl }),
          };

          // Set auth mode (defaults to api-key for backward compatibility)
          const authMode = entry.authMode ?? 'api-key';
          providerConfig.auth = authMode;

          // Inject stored credential if available
          if (authMode !== 'none') {
            const cred = loadCredential(name);
            if (cred) {
              providerConfig.apiKey = cred.secret;
            }
            // If no stored credential, providers fall through to env var detection
          }

          return [name, providerConfig];
        }),
    ),
  };
}
