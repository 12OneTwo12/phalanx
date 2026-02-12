/**
 * Dashboard LLM provider singleton.
 *
 * Reads the project config (.phalanx/config.json) and global credentials
 * (~/.phalanx/credentials.json) to create the correct LLM provider —
 * works with any configured provider (Anthropic, OpenAI, Ollama, Gemini).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { createLLMStack, type LLMProvider, type ProviderConfig } from '@phalanx/core';
import { findProjectRoot } from './convention-sync';

// ---------------------------------------------------------------------------
// Credential store reader (mirrors CLI's credential-store.ts)
// ---------------------------------------------------------------------------

interface AuthCredential {
  secret: string;
  authMode: string;
  expiresAt?: string;
}

function loadCredentials(): Record<string, AuthCredential> {
  const credFile = join(homedir(), '.phalanx', 'credentials.json');
  if (!existsSync(credFile)) return {};
  try {
    const raw = JSON.parse(readFileSync(credFile, 'utf-8'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return raw as Record<string, AuthCredential>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Project config reader
// ---------------------------------------------------------------------------

interface ProjectLLMConfig {
  systemDefault?: string;
  providers?: Record<string, { enabled?: boolean; authMode?: string; defaultModel?: string; baseUrl?: string }>;
}

function loadProjectLLMConfig(): ProjectLLMConfig {
  const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? findProjectRoot(process.cwd());
  if (!projectRoot) return {};

  const configPath = resolve(projectRoot, '.phalanx', 'config.json');
  if (!existsSync(configPath)) return {};

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    return raw?.llm ?? {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Provider creation
// ---------------------------------------------------------------------------

let cachedProvider: { provider: LLMProvider; model: string } | null = null;

/**
 * Get the configured LLM provider and default model.
 *
 * Reads from:
 * 1. ~/.phalanx/credentials.json — API keys saved by `phalanx init` wizard
 * 2. .phalanx/config.json — provider settings and default model
 * 3. Environment variables — fallback for API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
 *
 * Returns null if no provider is available.
 */
export function getLLMProvider(): { provider: LLMProvider; model: string } | null {
  if (cachedProvider) return cachedProvider;

  const credentials = loadCredentials();
  const llmConfig = loadProjectLLMConfig();

  // Build per-provider configs with injected API keys from credential store
  const providers: Record<string, ProviderConfig> = {};

  for (const [name, cred] of Object.entries(credentials)) {
    const projectProvider = llmConfig.providers?.[name];
    if (projectProvider?.enabled === false) continue;

    providers[name] = {
      apiKey: cred.secret,
      baseUrl: projectProvider?.baseUrl,
      defaultModel: projectProvider?.defaultModel,
    };
  }

  // Also check env vars as fallback for providers not in credential store
  const envKeyMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GOOGLE_API_KEY',
  };

  for (const [name, envVar] of Object.entries(envKeyMap)) {
    if (!providers[name] && process.env[envVar]) {
      providers[name] = { apiKey: process.env[envVar] };
    }
  }

  // Create the LLM stack with all available providers
  const { registry } = createLLMStack({
    providers,
    systemDefault: llmConfig.systemDefault,
  });

  // Get the first available provider
  const allProviders = registry.getAll();
  if (allProviders.length === 0) return null;

  // Determine the model to use
  const systemDefault = llmConfig.systemDefault ?? 'anthropic/claude-sonnet-4-5-20250929';
  const modelPart = systemDefault.includes('/') ? systemDefault.split('/')[1] : systemDefault;

  // Find the matching provider for the default model
  const defaultProviderName = systemDefault.includes('/') ? systemDefault.split('/')[0] : undefined;
  const provider = (defaultProviderName ? registry.get(defaultProviderName) : undefined) ?? allProviders[0];

  cachedProvider = { provider, model: modelPart };
  return cachedProvider;
}

/** Clear the cached provider (useful for testing or config changes) */
export function clearLLMProviderCache(): void {
  cachedProvider = null;
}
