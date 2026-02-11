import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentFactory } from '../../src/agents/agent-factory.js';
import { AgentExecutor } from '../../src/agents/agent-executor.js';
import type { LLMProvider, ResolvedModel } from '../../src/llm/types.js';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import { TokenTracker } from '../../src/llm/token-tracker.js';

// Mock fs for SoulLoader (created internally by AgentFactory)
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));
import * as fs from 'node:fs/promises';
const mockReadFile = vi.mocked(fs.readFile);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockProvider(name = 'anthropic'): LLMProvider {
  return {
    name,
    models: ['claude-sonnet-4-5-20250929'],
    chat: vi.fn(),
    chatWithTools: vi.fn(),
    isAvailable: vi.fn(async () => true),
  };
}

function makeResolvedModel(overrides: Partial<ResolvedModel> = {}): ResolvedModel {
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    fullId: 'anthropic/claude-sonnet-4-5-20250929',
    resolvedFrom: 'system',
    ...overrides,
  };
}

function makeMockModelResolver(resolved: ResolvedModel = makeResolvedModel()) {
  return {
    resolve: vi.fn(() => resolved),
    getProvider: vi.fn(),
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function makeMockProviderRegistry(provider?: LLMProvider) {
  return {
    get: vi.fn(() => provider),
    has: vi.fn(() => !!provider),
    register: vi.fn(),
    getAll: vi.fn(() => (provider ? [provider] : [])),
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function setupSoulMocks(): void {
  mockReadFile.mockImplementation(async (filePath: unknown) => {
    const p = String(filePath);
    if (p.endsWith('SOUL.md')) return 'test soul';
    if (p.endsWith('IDENTITY.md')) return 'test identity';
    if (p.endsWith('MEMORY.md')) return 'test memory';
    if (p.endsWith('SKILLS.md')) return 'test skills';
    throw new Error('File not found');
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentFactory', () => {
  let toolRegistry: ToolRegistry;
  let tokenTracker: TokenTracker;
  let mockProvider: LLMProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    toolRegistry = new ToolRegistry();
    tokenTracker = new TokenTracker();
    mockProvider = makeMockProvider();
    setupSoulMocks();
  });

  describe('create()', () => {
    it('returns executor and config with correct properties', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      const { executor, config } = await factory.create({
        role: 'backend',
        workingDirectory: '/project',
      });

      expect(executor).toBeInstanceOf(AgentExecutor);
      expect(config.role).toBe('backend');
      expect(config.workingDirectory).toBe('/project');
      expect(config.model).toEqual(makeResolvedModel());
      expect(config.maxIterations).toBe(25);
      expect(config.tools).toEqual({});
      expect(config.soul.soul).toBe('test soul');
      expect(config.soul.identity).toBe('test identity');
      expect(config.soul.memory).toBe('test memory');
      expect(config.soul.skills).toBe('test skills');
    });

    it('auto-generates id from role when not provided', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      const { config } = await factory.create({
        role: 'frontend',
        workingDirectory: '/project',
      });

      expect(config.id).toMatch(/^frontend-\d+$/);
    });

    it('uses custom id when provided', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      const { config } = await factory.create({
        role: 'backend',
        workingDirectory: '/project',
        id: 'my-custom-agent',
      });

      expect(config.id).toBe('my-custom-agent');
    });

    it('passes custom maxIterations, temperature, and thinkingLevel', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      const { config } = await factory.create({
        role: 'qa',
        workingDirectory: '/project',
        maxIterations: 50,
        temperature: 0.7,
        thinkingLevel: 'high',
      });

      expect(config.maxIterations).toBe(50);
      expect(config.temperature).toBe(0.7);
      expect(config.thinkingLevel).toBe('high');
    });

    it('passes tool permissions to config', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      const permissions = { allowCategories: ['filesystem' as const], denyTools: ['terminal_exec'] };
      const { config } = await factory.create({
        role: 'backend',
        workingDirectory: '/project',
        toolPermissions: permissions,
      });

      expect(config.tools).toEqual(permissions);
    });
  });

  describe('soul loading', () => {
    it('loads soul templates from the correct role directory', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/my-templates');

      await factory.create({ role: 'team-lead', workingDirectory: '/project' });

      const calls = mockReadFile.mock.calls.map((c) => String(c[0]));
      expect(calls).toContain('/my-templates/team-lead/SOUL.md');
      expect(calls).toContain('/my-templates/team-lead/IDENTITY.md');
      expect(calls).toContain('/my-templates/team-lead/MEMORY.md');
      expect(calls).toContain('/my-templates/team-lead/SKILLS.md');
    });

    it('applies soul override fields while keeping unset fields from templates', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      const { config } = await factory.create({
        role: 'backend',
        workingDirectory: '/project',
        soulOverride: {
          soul: 'custom soul',
          identity: 'custom identity',
        },
      });

      expect(config.soul.soul).toBe('custom soul');
      expect(config.soul.identity).toBe('custom identity');
      // Non-overridden fields should come from templates
      expect(config.soul.memory).toBe('test memory');
      expect(config.soul.skills).toBe('test skills');
    });

    it('uses all override fields when fully provided', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      const { config } = await factory.create({
        role: 'backend',
        workingDirectory: '/project',
        soulOverride: {
          soul: 'override soul',
          identity: 'override identity',
          memory: 'override memory',
          skills: 'override skills',
        },
      });

      expect(config.soul.soul).toBe('override soul');
      expect(config.soul.identity).toBe('override identity');
      expect(config.soul.memory).toBe('override memory');
      expect(config.soul.skills).toBe('override skills');
    });
  });

  describe('model resolution', () => {
    it('passes model context with system default to resolver', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      await factory.create({
        role: 'backend',
        workingDirectory: '/project',
        modelContext: {
          agentModel: 'openai/gpt-4o',
          fallbackChain: ['anthropic/claude-sonnet-4-5-20250929'],
        },
      });

      expect(resolver.resolve).toHaveBeenCalledWith({
        systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
        agentModel: 'openai/gpt-4o',
        fallbackChain: ['anthropic/claude-sonnet-4-5-20250929'],
      });
    });

    it('uses hardcoded system default when not overridden', async () => {
      const resolver = makeMockModelResolver();
      const registry = makeMockProviderRegistry(mockProvider);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      await factory.create({ role: 'backend', workingDirectory: '/project' });

      expect(resolver.resolve).toHaveBeenCalledWith({
        systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
      });
    });
  });

  describe('provider lookup', () => {
    it('throws when resolved provider is not in registry', async () => {
      const resolved = makeResolvedModel({ provider: 'missing-provider' });
      const resolver = makeMockModelResolver(resolved);
      const registry = makeMockProviderRegistry(undefined); // get() returns undefined
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      await expect(
        factory.create({ role: 'backend', workingDirectory: '/project' }),
      ).rejects.toThrow("Provider 'missing-provider' not found in registry");
    });

    it('includes resolved model fullId in error message', async () => {
      const resolved = makeResolvedModel({
        provider: 'unknown',
        fullId: 'unknown/some-model',
      });
      const resolver = makeMockModelResolver(resolved);
      const registry = makeMockProviderRegistry(undefined);
      const factory = new AgentFactory(resolver, registry, toolRegistry, tokenTracker, '/templates');

      await expect(
        factory.create({ role: 'backend', workingDirectory: '/project' }),
      ).rejects.toThrow('unknown/some-model');
    });
  });
});
