/**
 * Interactive setup wizard for Phalanx LLM provider configuration.
 * Uses @clack/prompts for a polished TUI experience.
 */
import * as p from '@clack/prompts';
import { MODEL_CATALOG } from '@phalanx/core';
import type { PhalanxConfig, LLMProviderEntry } from '../utils/config-loader.js';
import { saveConfig } from '../utils/config-loader.js';
import { PROVIDER_VALIDATORS, type ValidationResult } from './provider-validator.js';

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

interface ProviderInfo {
  value: string;
  label: string;
  hint: string;
  envVar: string;
  needsApiKey: boolean;
}

const PROVIDERS: ProviderInfo[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', hint: 'ANTHROPIC_API_KEY', envVar: 'ANTHROPIC_API_KEY', needsApiKey: true },
  { value: 'openai', label: 'OpenAI (GPT)', hint: 'OPENAI_API_KEY', envVar: 'OPENAI_API_KEY', needsApiKey: true },
  { value: 'gemini', label: 'Google Gemini', hint: 'GOOGLE_API_KEY', envVar: 'GOOGLE_API_KEY', needsApiKey: true },
  { value: 'ollama', label: 'Ollama (local)', hint: 'No API key needed', envVar: 'OLLAMA_BASE_URL', needsApiKey: false },
];

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

export interface WizardResult {
  providers: Record<string, LLMProviderEntry>;
  systemDefault: string;
  autoStart: boolean;
}

/**
 * Run the interactive setup wizard.
 * Returns null if the user cancels at any point.
 */
export async function runSetupWizard(config: PhalanxConfig): Promise<WizardResult | null> {
  p.intro('Phalanx Setup');

  // Step 1: Provider selection
  const selectedProviders = await p.multiselect({
    message: 'Which LLM providers do you want to use?',
    options: PROVIDERS.map((prov) => ({
      value: prov.value,
      label: prov.label,
      hint: prov.hint,
    })),
    required: true,
  });

  if (p.isCancel(selectedProviders)) {
    p.cancel('Setup cancelled.');
    return null;
  }

  // Step 2: API key verification per provider
  const providerEntries: Record<string, LLMProviderEntry> = {};

  for (const providerName of selectedProviders) {
    const info = PROVIDERS.find((pr) => pr.value === providerName)!;
    const entry: LLMProviderEntry = { enabled: true };

    if (info.needsApiKey) {
      const result = await verifyApiKey(providerName, info);
      if (result === null) {
        p.cancel('Setup cancelled.');
        return null;
      }
      if (!result.valid) {
        entry.enabled = false;
        p.log.warn(`${info.label}: skipped (key not validated)`);
      }
    } else {
      // Ollama — verify connection
      const ollamaResult = await verifyOllama();
      if (ollamaResult === null) {
        p.cancel('Setup cancelled.');
        return null;
      }
      entry.baseUrl = ollamaResult.baseUrl;
      if (!ollamaResult.connected) {
        p.log.warn('Ollama: not reachable (will retry at runtime)');
      }
    }

    providerEntries[providerName] = entry;
  }

  // Step 3: Default model selection
  const enabledProviders = Object.entries(providerEntries)
    .filter(([_, e]) => e.enabled)
    .map(([name]) => name);

  const modelOptions = MODEL_CATALOG
    .filter((m) => enabledProviders.includes(m.provider))
    .map((m) => ({
      value: m.fullId,
      label: m.fullId,
      hint: `${m.name} · ctx ${formatTokens(m.contextWindow)}`,
    }));

  if (modelOptions.length === 0) {
    p.log.warn('No validated providers — using default model.');
    const result: WizardResult = {
      providers: providerEntries,
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
      autoStart: false,
    };
    writeAndFinish(config, result);
    return result;
  }

  const defaultModel = await p.select({
    message: 'Select a default model:',
    options: modelOptions,
    initialValue: 'anthropic/claude-sonnet-4-5-20250929',
  });

  if (p.isCancel(defaultModel)) {
    p.cancel('Setup cancelled.');
    return null;
  }

  // Step 4: Daemon auto-start
  const autoStart = await p.confirm({
    message: 'Start Phalanx automatically on boot?',
    initialValue: false,
  });

  if (p.isCancel(autoStart)) {
    p.cancel('Setup cancelled.');
    return null;
  }

  // Step 5: Summary & save
  const result: WizardResult = {
    providers: providerEntries,
    systemDefault: defaultModel,
    autoStart,
  };

  writeAndFinish(config, result);
  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function verifyApiKey(
  providerName: string,
  info: ProviderInfo,
): Promise<ValidationResult | null> {
  const envValue = process.env[info.envVar];

  if (envValue) {
    // Key exists in env — validate it
    const s = p.spinner();
    s.start(`Validating ${info.label} key...`);
    const result = await PROVIDER_VALIDATORS[providerName](envValue);
    if (result.valid) {
      s.stop(`${info.label}: validated`);
    } else {
      s.stop(`${info.label}: validation failed (${result.error})`);
    }
    return result;
  }

  // Key not in env — prompt user
  p.log.warn(`${info.envVar} not found in environment.`);

  const action = await p.select({
    message: `How do you want to configure ${info.label}?`,
    options: [
      { value: 'enter' as const, label: 'Enter API key now', hint: 'will validate immediately' },
      { value: 'skip' as const, label: 'Skip for now', hint: `set ${info.envVar} later` },
    ],
  });

  if (p.isCancel(action)) return null;

  if (action === 'skip') {
    return { valid: false, error: 'skipped' };
  }

  const apiKey = await p.text({
    message: `Enter your ${info.label} API key:`,
    placeholder: info.envVar,
    validate: (val) => {
      if (!val?.trim()) return 'API key cannot be empty';
      return undefined;
    },
  });

  if (p.isCancel(apiKey)) return null;

  const s = p.spinner();
  s.start(`Validating ${info.label} key...`);
  const result = await PROVIDER_VALIDATORS[providerName](apiKey.trim());

  if (result.valid) {
    s.stop(`${info.label}: validated`);
    p.log.info(`Add to your shell profile:\n  export ${info.envVar}="${apiKey.trim()}"`);
  } else {
    s.stop(`${info.label}: validation failed (${result.error})`);
  }

  return result;
}

async function verifyOllama(): Promise<{ baseUrl: string; connected: boolean } | null> {
  const baseUrl = await p.text({
    message: 'Ollama base URL:',
    placeholder: 'http://localhost:11434',
    defaultValue: 'http://localhost:11434',
  });

  if (p.isCancel(baseUrl)) return null;

  const url = baseUrl.trim() || 'http://localhost:11434';

  const s = p.spinner();
  s.start('Checking Ollama connection...');
  const result = await PROVIDER_VALIDATORS.ollama(url);

  if (result.valid) {
    s.stop('Ollama: connected');
  } else {
    s.stop(`Ollama: not reachable (${result.error})`);
  }

  return { baseUrl: url, connected: result.valid };
}

function writeAndFinish(config: PhalanxConfig, result: WizardResult): void {
  config.llm = {
    systemDefault: result.systemDefault,
    providers: result.providers,
  };
  config.daemon = { autoStart: result.autoStart };
  saveConfig(config);

  // Summary
  const lines: string[] = [];
  lines.push(`Default model: ${result.systemDefault}`);
  for (const [name, entry] of Object.entries(result.providers)) {
    const status = entry.enabled ? 'enabled' : 'disabled';
    lines.push(`${name}: ${status}`);
  }
  lines.push(`Auto-start: ${result.autoStart ? 'yes' : 'no'}`);

  p.note(lines.join('\n'), 'Configuration');
  p.outro('Setup complete! Run "phalanx start" to launch.');
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return `${(n / 1_000).toFixed(0)}k`;
}
