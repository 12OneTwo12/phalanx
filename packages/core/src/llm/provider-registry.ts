import type { LLMProvider } from './types.js';

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  getAll(): LLMProvider[] {
    return [...this.providers.values()];
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }
}
