/**
 * Lightweight API key validation for each LLM provider.
 * Uses native fetch (Node 22+), no extra dependencies.
 */

const TIMEOUT_MS = 8_000;

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an Anthropic API key by listing models.
 */
export async function validateAnthropicKey(apiKey: string): Promise<ValidationResult> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: withTimeout(TIMEOUT_MS),
    });
    if (res.ok) return { valid: true };
    if (res.status === 401) return { valid: false, error: 'Invalid API key' };
    return { valid: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

/**
 * Validate an OpenAI API key by listing models.
 */
export async function validateOpenAIKey(apiKey: string): Promise<ValidationResult> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: withTimeout(TIMEOUT_MS),
    });
    if (res.ok) return { valid: true };
    if (res.status === 401) return { valid: false, error: 'Invalid API key' };
    return { valid: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

/**
 * Validate a Google Gemini API key by listing models.
 */
export async function validateGeminiKey(apiKey: string): Promise<ValidationResult> {
  try {
    // NOTE: Gemini REST API requires key as query parameter (not header).
    // This is Google's API design; the key may appear in URL-level logs.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`,
      { signal: withTimeout(TIMEOUT_MS) },
    );
    if (res.ok) return { valid: true };
    if (res.status === 400 || res.status === 403) return { valid: false, error: 'Invalid API key' };
    return { valid: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

/**
 * Validate Ollama connectivity by checking the tags endpoint.
 */
export async function validateOllamaConnection(baseUrl: string): Promise<ValidationResult> {
  try {
    const url = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${url}/api/tags`, { signal: withTimeout(TIMEOUT_MS) });
    if (res.ok) return { valid: true };
    return { valid: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

/** Map of provider name → env var name for API keys */
export const PROVIDER_ENV_VARS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  ollama: 'OLLAMA_BASE_URL',
};

/** Map of provider name → validator function */
export const PROVIDER_VALIDATORS: Record<string, (key: string) => Promise<ValidationResult>> = {
  anthropic: validateAnthropicKey,
  openai: validateOpenAIKey,
  gemini: validateGeminiKey,
  ollama: validateOllamaConnection,
};
