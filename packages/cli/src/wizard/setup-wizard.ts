/**
 * Interactive setup wizard for Phalanx LLM provider configuration.
 * Uses @clack/prompts for a polished TUI experience.
 * Step 2 uses AuthStrategy pattern for pluggable auth methods.
 */
import * as p from '@clack/prompts';
import { MODEL_CATALOG } from '@phalanx/core';
import type { PhalanxConfig, LLMProviderEntry } from '../utils/config-loader.js';
import { saveConfig, DEFAULT_MODEL } from '../utils/config-loader.js';
import { PROVIDER_VALIDATORS } from './provider-validator.js';
import { getProviderAuthStrategies, authenticateProvider } from './auth-strategy.js';

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

interface ProviderInfo {
  value: string;
  label: string;
  hint: string;
  /** True for Ollama — no auth required */
  noAuth: boolean;
}

const PROVIDERS: ProviderInfo[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', hint: 'API key or Claude Code Plan', noAuth: false },
  { value: 'openai', label: 'OpenAI (GPT)', hint: 'API key or Codex subscription', noAuth: false },
  { value: 'gemini', label: 'Google Gemini', hint: 'GOOGLE_API_KEY', noAuth: false },
  { value: 'ollama', label: 'Ollama (local)', hint: 'No API key needed', noAuth: true },
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

  // Step 2: Authentication per provider (strategy-based)
  const providerEntries: Record<string, LLMProviderEntry> = {};

  for (const providerName of selectedProviders) {
    const info = PROVIDERS.find((pr) => pr.value === providerName);
    if (!info) continue;
    const entry: LLMProviderEntry = { enabled: true };

    if (info.noAuth) {
      // Ollama — verify connection (no auth needed)
      const ollamaResult = await verifyOllama();
      if (ollamaResult === null) {
        p.cancel('Setup cancelled.');
        return null;
      }
      entry.baseUrl = ollamaResult.baseUrl;
      entry.authMode = 'none';
      if (!ollamaResult.connected) {
        p.log.warn('Ollama: not reachable (will retry at runtime)');
      }
    } else {
      // Use auth strategies
      const strategies = getProviderAuthStrategies(providerName);
      const authResult = await authenticateProvider(providerName, info.label, strategies);
      if (authResult === null) {
        p.cancel('Setup cancelled.');
        return null;
      }
      if (!authResult.valid) {
        entry.enabled = false;
        p.log.warn(`${info.label}: skipped (not validated)`);
      } else {
        entry.authMode = authResult.authMode;
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
      systemDefault: DEFAULT_MODEL,
      autoStart: false,
    };
    writeAndFinish(config, result);
    return result;
  }

  const defaultModel = await p.select({
    message: 'Select a default model:',
    options: modelOptions,
    initialValue: DEFAULT_MODEL,
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
  const updated: PhalanxConfig = {
    ...config,
    llm: {
      ...config.llm,
      systemDefault: result.systemDefault,
      providers: result.providers,
    },
    daemon: { ...config.daemon, autoStart: result.autoStart },
  };
  saveConfig(updated);

  // Summary
  const lines: string[] = [];
  lines.push(`Default model: ${result.systemDefault}`);
  for (const [name, entry] of Object.entries(result.providers)) {
    const status = entry.enabled ? 'enabled' : 'disabled';
    const auth = entry.authMode ? ` (${entry.authMode})` : '';
    lines.push(`${name}: ${status}${auth}`);
  }
  lines.push(`Auto-start: ${result.autoStart ? 'yes' : 'no'}`);

  p.note(lines.join('\n'), 'Configuration');
  p.outro('Setup complete! Run "phalanx start" to launch.');
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return `${(n / 1_000).toFixed(0)}k`;
}
