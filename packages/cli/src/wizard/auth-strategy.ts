/**
 * Auth strategies for LLM provider authentication.
 * Follows Strategy pattern (Open/Closed Principle) — add new auth methods
 * by creating a new class, no modification to existing code.
 */
import * as p from '@clack/prompts';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ProviderAuthMode } from '@phalanx/core';
import type { ValidationResult } from './provider-validator.js';
import {
  validateAnthropicKey,
  validateOpenAIKey,
  validateGeminiKey,
  validateSetupTokenFormat,
} from './provider-validator.js';
import type { AuthCredential } from '../utils/credential-store.js';
import { loadCredential, saveCredential } from '../utils/credential-store.js';

// ---------------------------------------------------------------------------
// AuthStrategy interface
// ---------------------------------------------------------------------------

export interface AuthDetectResult {
  found: boolean;
  /** Where the credential was found (e.g. "env:ANTHROPIC_API_KEY") */
  source?: string;
  credential?: AuthCredential;
}

export interface AuthStrategy {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly authMode: ProviderAuthMode;

  /** Check for existing credentials without network calls. */
  detect(): AuthDetectResult;
  /** Guide user through credential setup via TUI. Returns null on cancel. */
  prompt(): Promise<AuthCredential | null>;
  /** Validate credential with a network call. */
  validate(credential: AuthCredential): Promise<ValidationResult>;
}

// ---------------------------------------------------------------------------
// ApiKeyAuthStrategy — works for any provider with an env var API key
// ---------------------------------------------------------------------------

export class ApiKeyAuthStrategy implements AuthStrategy {
  readonly id = 'api-key';
  readonly label: string;
  readonly hint: string;
  readonly authMode: ProviderAuthMode = 'api-key';

  constructor(
    private readonly providerLabel: string,
    private readonly envVar: string,
    private readonly validator: (key: string) => Promise<ValidationResult>,
  ) {
    this.label = `API Key (${envVar})`;
    this.hint = `Enter key or set ${envVar}`;
  }

  detect(): AuthDetectResult {
    const value = process.env[this.envVar];
    if (value) {
      return {
        found: true,
        source: `env:${this.envVar}`,
        credential: { secret: value, authMode: 'api-key' },
      };
    }
    return { found: false };
  }

  async prompt(): Promise<AuthCredential | null> {
    const apiKey = await p.text({
      message: `Enter your ${this.providerLabel} API key:`,
      placeholder: this.envVar,
      validate: (val) => {
        if (!val?.trim()) return 'API key cannot be empty';
        return undefined;
      },
    });

    if (p.isCancel(apiKey)) return null;

    return { secret: apiKey.trim(), authMode: 'api-key' };
  }

  async validate(credential: AuthCredential): Promise<ValidationResult> {
    return this.validator(credential.secret);
  }
}

// ---------------------------------------------------------------------------
// SetupTokenAuthStrategy — Anthropic Claude Code Plan (Max/Pro)
// ---------------------------------------------------------------------------

export class SetupTokenAuthStrategy implements AuthStrategy {
  readonly id = 'setup-token';
  readonly label = 'Claude Code Plan (setup-token)';
  readonly hint = 'For Max/Pro subscribers — run "claude setup-token"';
  readonly authMode: ProviderAuthMode = 'token';

  detect(): AuthDetectResult {
    const stored = loadCredential('anthropic');
    if (stored && stored.authMode === 'token') {
      return {
        found: true,
        source: 'credential-store',
        credential: stored,
      };
    }
    return { found: false };
  }

  async prompt(): Promise<AuthCredential | null> {
    p.log.info(
      'Run "claude setup-token" in another terminal to generate a token.\n' +
        'Then paste it below.',
    );

    const token = await p.text({
      message: 'Paste your setup-token:',
      placeholder: 'sk-ant-oat01-...',
      validate: (val) => {
        if (!val?.trim()) return 'Token cannot be empty';
        const result = validateSetupTokenFormat(val.trim());
        if (!result.valid) return result.error;
        return undefined;
      },
    });

    if (p.isCancel(token)) return null;

    return { secret: token.trim(), authMode: 'token' };
  }

  async validate(credential: AuthCredential): Promise<ValidationResult> {
    // Format check first (fast fail)
    const formatResult = validateSetupTokenFormat(credential.secret);
    if (!formatResult.valid) return formatResult;

    // Network validation — setup-token works with the same x-api-key header
    return validateAnthropicKey(credential.secret);
  }
}

// ---------------------------------------------------------------------------
// CodexOAuthStrategy — OpenAI Codex subscription (reuse ~/.codex/auth.json)
// ---------------------------------------------------------------------------

export class CodexOAuthStrategy implements AuthStrategy {
  readonly id = 'codex-oauth';
  readonly label = 'Codex Subscription (OAuth)';
  readonly hint = 'Reuse credentials from Codex CLI (~/.codex/auth.json)';
  readonly authMode: ProviderAuthMode = 'oauth';

  private static readonly AUTH_FILE = join(homedir(), '.codex', 'auth.json');

  detect(): AuthDetectResult {
    return this.readCodexAuth();
  }

  async prompt(): Promise<AuthCredential | null> {
    const detected = this.readCodexAuth();

    if (detected.found && detected.credential) {
      p.log.info(`Found Codex credentials at ~/.codex/auth.json`);
      const useIt = await p.confirm({
        message: 'Use existing Codex credentials?',
        initialValue: true,
      });
      if (p.isCancel(useIt)) return null;
      if (useIt) return detected.credential;
    }

    // Not found or user declined — instruct to authenticate
    p.log.info(
      'Authenticate with Codex CLI to create credentials:\n' +
        '  npx codex auth\n' +
        'Then re-run "phalanx config" to pick up the credentials.',
    );

    const retry = await p.confirm({
      message: 'Have you completed Codex authentication?',
      initialValue: false,
    });
    if (p.isCancel(retry)) return null;

    if (retry) {
      const retryDetect = this.readCodexAuth();
      if (retryDetect.found && retryDetect.credential) {
        return retryDetect.credential;
      }
      p.log.warn('Codex credentials still not found at ~/.codex/auth.json');
    }

    return null;
  }

  async validate(credential: AuthCredential): Promise<ValidationResult> {
    // Codex OAuth tokens use the same Bearer header as OpenAI API keys
    return validateOpenAIKey(credential.secret);
  }

  private readCodexAuth(): AuthDetectResult {
    if (!existsSync(CodexOAuthStrategy.AUTH_FILE)) {
      return { found: false };
    }

    try {
      const raw = readFileSync(CodexOAuthStrategy.AUTH_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const accessToken = parsed.access_token as string | undefined;

      if (!accessToken) return { found: false };

      // Check expiry if available
      const expiresAt = parsed.expires_at as string | undefined;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        return { found: false }; // expired
      }

      return {
        found: true,
        source: 'file:~/.codex/auth.json',
        credential: {
          secret: accessToken,
          authMode: 'oauth',
          ...(expiresAt && { expiresAt }),
        },
      };
    } catch {
      return { found: false };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider auth options registry
// ---------------------------------------------------------------------------

export function getProviderAuthStrategies(providerName: string): AuthStrategy[] {
  switch (providerName) {
    case 'anthropic':
      return [
        new ApiKeyAuthStrategy('Anthropic (Claude)', 'ANTHROPIC_API_KEY', validateAnthropicKey),
        new SetupTokenAuthStrategy(),
      ];
    case 'openai':
      return [
        new ApiKeyAuthStrategy('OpenAI (GPT)', 'OPENAI_API_KEY', validateOpenAIKey),
        new CodexOAuthStrategy(),
      ];
    case 'gemini':
      return [
        new ApiKeyAuthStrategy('Google Gemini', 'GOOGLE_API_KEY', validateGeminiKey),
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// authenticateProvider — orchestrates the strategy flow for wizard Step 2
// ---------------------------------------------------------------------------

export interface AuthResult {
  valid: boolean;
  authMode?: ProviderAuthMode;
  error?: string;
}

/**
 * Run auth strategies for a provider. Auto-detects existing credentials,
 * prompts for selection if multiple strategies exist, validates, and stores.
 * Returns null on user cancel.
 */
export async function authenticateProvider(
  providerName: string,
  providerLabel: string,
  strategies: AuthStrategy[],
): Promise<AuthResult | null> {
  if (strategies.length === 0) {
    return { valid: false, error: 'no auth strategies' };
  }

  // 1. Auto-detect existing credentials
  for (const strategy of strategies) {
    const detected = strategy.detect();
    if (detected.found && detected.credential) {
      p.log.info(`Found ${strategy.label} credentials (${detected.source})`);
      const s = p.spinner();
      s.start(`Validating ${providerLabel}...`);
      const result = await strategy.validate(detected.credential);
      if (result.valid) {
        s.stop(`${providerLabel}: validated via ${strategy.label}`);
        saveCredential(providerName, detected.credential);
        return { valid: true, authMode: strategy.authMode };
      }
      s.stop(`${providerLabel}: validation failed (${result.error})`);
      // Fall through to manual selection
    }
  }

  // 2. Build options for user selection
  const options = [
    ...strategies.map((s) => ({
      value: s.id as string,
      label: s.label,
      hint: s.hint,
    })),
    { value: 'skip' as const, label: 'Skip for now', hint: 'configure later' },
  ];

  // Single strategy — skip selection menu, go straight to prompt
  let chosenId: string;
  if (strategies.length === 1) {
    const action = await p.select({
      message: `How do you want to configure ${providerLabel}?`,
      options: [
        { value: 'enter' as const, label: strategies[0].label, hint: strategies[0].hint },
        { value: 'skip' as const, label: 'Skip for now', hint: 'configure later' },
      ],
    });
    if (p.isCancel(action)) return null;
    if (action === 'skip') return { valid: false, error: 'skipped' };
    chosenId = strategies[0].id;
  } else {
    const choice = await p.select({
      message: `How do you want to authenticate ${providerLabel}?`,
      options,
    });
    if (p.isCancel(choice)) return null;
    if (choice === 'skip') return { valid: false, error: 'skipped' };
    chosenId = choice;
  }

  // 3. Run chosen strategy
  const strategy = strategies.find((s) => s.id === chosenId)!;
  const credential = await strategy.prompt();
  if (credential === null) return null;

  // 4. Validate
  const s = p.spinner();
  s.start(`Validating ${providerLabel}...`);
  const result = await strategy.validate(credential);

  if (result.valid) {
    s.stop(`${providerLabel}: validated via ${strategy.label}`);
    saveCredential(providerName, credential);

    // For API keys not from env, suggest export
    if (strategy.id === 'api-key' && !process.env[getEnvVar(providerName)]) {
      const envVar = getEnvVar(providerName);
      p.log.info(`Tip: Add to your shell profile:\n  export ${envVar}="${credential.secret}"`);
    }

    return { valid: true, authMode: strategy.authMode };
  }

  s.stop(`${providerLabel}: validation failed (${result.error})`);
  return { valid: false, authMode: strategy.authMode, error: result.error };
}

function getEnvVar(providerName: string): string {
  const map: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GOOGLE_API_KEY',
  };
  return map[providerName] ?? '';
}
