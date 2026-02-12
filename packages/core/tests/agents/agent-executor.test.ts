import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { AgentExecutor } from '../../src/agents/agent-executor.js';
import type { AgentConfig } from '../../src/agents/types.js';
import type {
  LLMProvider,
  ToolCallResult,
  ChatWithToolsParams,
  TokenUsage,
} from '../../src/llm/types.js';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import type { Tool, ToolResult, ToolExecutionContext } from '../../src/tools/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return { inputTokens: 10, outputTokens: 5, ...overrides };
}

function makeToolCallResult(overrides: Partial<ToolCallResult> = {}): ToolCallResult {
  return {
    content: 'Done.',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: makeUsage(),
    model: 'test-model',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'test-agent',
    role: 'backend',
    soul: {
      soul: '',
      identity: '',
      memory: '',
      skills: '',
    },
    model: {
      provider: 'test',
      model: 'test-model',
      fullId: 'test/test-model',
      resolvedFrom: 'system',
    },
    tools: {},
    workingDirectory: '/tmp/test-workdir',
    maxIterations: 25,
    ...overrides,
  };
}

function makeTool(name: string, schema: z.ZodRawShape = {}, executeFn?: (params: unknown, ctx: ToolExecutionContext) => Promise<ToolResult>): Tool {
  return {
    name,
    description: `Test tool ${name}`,
    category: 'filesystem',
    schema,
    execute: executeFn ?? vi.fn(async () => ({ success: true, content: `${name} result` })),
  };
}

function makeMockProvider(responses: ToolCallResult[]): LLMProvider {
  let callIndex = 0;
  return {
    name: 'test-provider',
    models: ['test-model'],
    chat: vi.fn(),
    chatWithTools: vi.fn(async (_params: ChatWithToolsParams) => {
      if (callIndex >= responses.length) {
        throw new Error('No more mock responses');
      }
      return responses[callIndex++];
    }),
    isAvailable: vi.fn(async () => true),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentExecutor', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('basic completion', () => {
    it('completes when LLM returns end_turn with no tool calls', async () => {
      const provider = makeMockProvider([
        makeToolCallResult({ stopReason: 'end_turn', content: 'All done.' }),
      ]);
      const executor = new AgentExecutor(provider, registry);

      const result = await executor.run(makeConfig(), 'Do something');

      expect(result.status).toBe('completed');
      expect(result.finalContent).toBe('All done.');
      expect(result.iterations).toBe(1);
      expect(result.toolCallCount).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('returns completed for unknown stop reasons', async () => {
      const provider = makeMockProvider([
        makeToolCallResult({ stopReason: 'something_else' as ToolCallResult['stopReason'], content: 'Unknown.' }),
      ]);
      const executor = new AgentExecutor(provider, registry);

      const result = await executor.run(makeConfig(), 'Do something');

      expect(result.status).toBe('completed');
      expect(result.finalContent).toBe('Unknown.');
    });
  });

  describe('tool execution', () => {
    it('executes tool calls and feeds results back to LLM', async () => {
      const echoTool = makeTool('echo', { message: z.string() });
      registry.register(echoTool);

      const provider = makeMockProvider([
        // First call: LLM requests tool use
        makeToolCallResult({
          stopReason: 'tool_use',
          content: 'Let me use the echo tool.',
          toolCalls: [{ id: 'tc-1', name: 'echo', input: { message: 'hello' } }],
        }),
        // Second call: LLM produces final answer
        makeToolCallResult({
          stopReason: 'end_turn',
          content: 'Done with echo.',
        }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(makeConfig(), 'Echo hello');

      expect(result.status).toBe('completed');
      expect(result.finalContent).toBe('Done with echo.');
      expect(result.iterations).toBe(2);
      expect(result.toolCallCount).toBe(1);
      expect(echoTool.execute).toHaveBeenCalledOnce();
    });

    it('validates tool parameters with Zod before execution', async () => {
      const strictTool = makeTool('strict', {
        count: z.number(),
        label: z.string(),
      });
      registry.register(strictTool);

      const provider = makeMockProvider([
        // LLM sends invalid params (count should be number, not string)
        makeToolCallResult({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'tc-1', name: 'strict', input: { count: 'not-a-number', label: 'test' } }],
        }),
        // After validation error, LLM completes
        makeToolCallResult({
          stopReason: 'end_turn',
          content: 'Noted the error.',
        }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(makeConfig(), 'Use strict tool');

      // The tool should NOT have been executed due to validation failure
      expect(strictTool.execute).not.toHaveBeenCalled();
      expect(result.status).toBe('completed');
      // The validation error counts as a tool call but is an error
      expect(result.toolCallCount).toBe(1);
    });
  });

  describe('max_tokens handling', () => {
    it('handles max_tokens by asking LLM to continue', async () => {
      const provider = makeMockProvider([
        // First call: LLM output was truncated
        makeToolCallResult({
          stopReason: 'max_tokens',
          content: 'Partial response...',
        }),
        // Second call: LLM completes
        makeToolCallResult({
          stopReason: 'end_turn',
          content: 'Full response.',
        }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(makeConfig(), 'Write a long story');

      expect(result.status).toBe('completed');
      expect(result.finalContent).toBe('Full response.');
      expect(result.iterations).toBe(2);

      // Check that the continuation message was appended
      const chatWithTools = provider.chatWithTools as ReturnType<typeof vi.fn>;
      const secondCall = chatWithTools.mock.calls[1][0] as ChatWithToolsParams;
      const lastMessage = secondCall.messages[secondCall.messages.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toBe('Please continue from where you left off.');
    });
  });

  describe('error handling', () => {
    it('returns error when LLM throws', async () => {
      const provider = makeMockProvider([]);
      // Override chatWithTools to throw
      (provider.chatWithTools as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('API key invalid'),
      );

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(makeConfig(), 'Do something');

      expect(result.status).toBe('error');
      expect(result.error).toBe('API key invalid');
    });

    it('returns error when stop reason is error', async () => {
      const provider = makeMockProvider([
        makeToolCallResult({
          stopReason: 'error',
          content: 'Something broke',
        }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(makeConfig(), 'Do something');

      expect(result.status).toBe('error');
      expect(result.error).toBe('LLM returned error stop reason');
      expect(result.finalContent).toBe('Something broke');
    });
  });

  describe('iteration limits', () => {
    it('escalates after max iterations', async () => {
      // With maxIterations=2, the loop should exceed on iteration 3
      const config = makeConfig({ maxIterations: 2 });

      const provider = makeMockProvider([
        // Iteration 1: max_tokens -> continue
        makeToolCallResult({ stopReason: 'max_tokens', content: 'part 1' }),
        // Iteration 2: max_tokens -> continue
        makeToolCallResult({ stopReason: 'max_tokens', content: 'part 2' }),
        // Iteration 3: would run, but guard.check(3) >= 2, exceeded
      ]);

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(config, 'Keep going forever');

      expect(result.status).toBe('escalated');
      expect(result.finalContent).toContain('Maximum iteration limit');
    });
  });

  describe('consecutive tool errors', () => {
    it('escalates after consecutive tool errors (3)', async () => {
      const failingTool = makeTool(
        'failing',
        { input: z.string() },
        async () => ({ success: false, content: '', error: 'Tool broken' }),
      );
      registry.register(failingTool);

      const provider = makeMockProvider([
        // Each iteration: LLM calls the failing tool
        makeToolCallResult({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'tc-1', name: 'failing', input: { input: 'a' } }],
        }),
        makeToolCallResult({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'tc-2', name: 'failing', input: { input: 'b' } }],
        }),
        makeToolCallResult({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'tc-3', name: 'failing', input: { input: 'c' } }],
        }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(makeConfig(), 'Use the failing tool');

      expect(result.status).toBe('escalated');
      expect(result.finalContent).toContain('3 times consecutively');
    });

    it('resets consecutive error counter on successful tool call', async () => {
      const sometimesFails = makeTool('flaky', { input: z.string() });
      const executeFn = vi.fn<(params: unknown, ctx: ToolExecutionContext) => Promise<ToolResult>>();
      // First call: fail
      executeFn.mockResolvedValueOnce({ success: false, content: '', error: 'fail 1' });
      // Second call: fail
      executeFn.mockResolvedValueOnce({ success: false, content: '', error: 'fail 2' });
      // Third call: succeed (resets counter)
      executeFn.mockResolvedValueOnce({ success: true, content: 'ok' });
      // Fourth call: fail (counter reset, so only 1)
      executeFn.mockResolvedValueOnce({ success: false, content: '', error: 'fail 3' });

      sometimesFails.execute = executeFn as Tool['execute'];
      registry.register(sometimesFails);

      const provider = makeMockProvider([
        makeToolCallResult({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'tc-1', name: 'flaky', input: { input: 'a' } }],
        }),
        makeToolCallResult({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'tc-2', name: 'flaky', input: { input: 'b' } }],
        }),
        makeToolCallResult({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'tc-3', name: 'flaky', input: { input: 'c' } }],
        }),
        makeToolCallResult({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'tc-4', name: 'flaky', input: { input: 'd' } }],
        }),
        // After the 4th tool call (1 consecutive error), LLM completes
        makeToolCallResult({
          stopReason: 'end_turn',
          content: 'Finished despite flakiness.',
        }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(makeConfig(), 'Use flaky tool');

      // Should NOT escalate — the successful 3rd call reset the counter
      expect(result.status).toBe('completed');
      expect(result.finalContent).toBe('Finished despite flakiness.');
    });
  });

  describe('token usage accumulation', () => {
    it('accumulates token usage across iterations', async () => {
      const provider = makeMockProvider([
        makeToolCallResult({
          stopReason: 'max_tokens',
          content: 'part 1',
          usage: { inputTokens: 100, outputTokens: 50, thinkingTokens: 10 },
        }),
        makeToolCallResult({
          stopReason: 'end_turn',
          content: 'part 2',
          usage: { inputTokens: 200, outputTokens: 80, cacheReadTokens: 30 },
        }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      const result = await executor.run(makeConfig(), 'Long task');

      expect(result.totalUsage.inputTokens).toBe(300);
      expect(result.totalUsage.outputTokens).toBe(130);
      expect(result.totalUsage.thinkingTokens).toBe(10);
      expect(result.totalUsage.cacheReadTokens).toBe(30);
    });
  });

  describe('system prompt building', () => {
    it('builds system prompt from soul config sections', async () => {
      const config = makeConfig({
        soul: {
          soul: 'You are a helpful agent.',
          identity: 'Backend engineer.',
          skills: 'TypeScript, Node.js.',
          memory: 'Project uses pnpm.',
        },
      });

      const provider = makeMockProvider([
        makeToolCallResult({ stopReason: 'end_turn', content: 'ok' }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      await executor.run(config, 'Hello');

      const chatWithTools = provider.chatWithTools as ReturnType<typeof vi.fn>;
      const callArgs = chatWithTools.mock.calls[0][0] as ChatWithToolsParams;

      expect(callArgs.systemPrompt).toContain('# Soul');
      expect(callArgs.systemPrompt).toContain('You are a helpful agent.');
      expect(callArgs.systemPrompt).toContain('# Identity');
      expect(callArgs.systemPrompt).toContain('Backend engineer.');
      expect(callArgs.systemPrompt).toContain('# Skills');
      expect(callArgs.systemPrompt).toContain('TypeScript, Node.js.');
      expect(callArgs.systemPrompt).toContain('# Memory');
      expect(callArgs.systemPrompt).toContain('Project uses pnpm.');
    });

    it('omits empty soul config sections', async () => {
      const config = makeConfig({
        soul: {
          soul: 'Core soul.',
          identity: '',
          skills: '',
          memory: '',
        },
      });

      const provider = makeMockProvider([
        makeToolCallResult({ stopReason: 'end_turn', content: 'ok' }),
      ]);

      const executor = new AgentExecutor(provider, registry);
      await executor.run(config, 'Hello');

      const chatWithTools = provider.chatWithTools as ReturnType<typeof vi.fn>;
      const callArgs = chatWithTools.mock.calls[0][0] as ChatWithToolsParams;

      expect(callArgs.systemPrompt).toContain('# Soul');
      expect(callArgs.systemPrompt).toContain('Core soul.');
      expect(callArgs.systemPrompt).not.toContain('# Identity');
      expect(callArgs.systemPrompt).not.toContain('# Skills');
      expect(callArgs.systemPrompt).not.toContain('# Memory');
    });

    it('includes conventions in system prompt when provided', async () => {
      const provider = makeMockProvider([
        makeToolCallResult({ stopReason: 'end_turn', content: 'Done.' }),
      ]);
      const executor = new AgentExecutor(provider, registry);
      const config = makeConfig({
        conventions: '## Naming\nUse kebab-case for files.\n## Style\nNo console.log.',
      });

      await executor.run(config, 'Task');

      const chatWithTools = provider.chatWithTools as ReturnType<typeof vi.fn>;
      const callArgs = chatWithTools.mock.calls[0][0] as ChatWithToolsParams;

      expect(callArgs.systemPrompt).toContain('# Project Conventions');
      expect(callArgs.systemPrompt).toContain('Use kebab-case for files.');
      expect(callArgs.systemPrompt).toContain('No console.log.');
    });

    it('omits conventions section when not provided', async () => {
      const provider = makeMockProvider([
        makeToolCallResult({ stopReason: 'end_turn', content: 'Done.' }),
      ]);
      const executor = new AgentExecutor(provider, registry);
      const config = makeConfig();

      await executor.run(config, 'Task');

      const chatWithTools = provider.chatWithTools as ReturnType<typeof vi.fn>;
      const callArgs = chatWithTools.mock.calls[0][0] as ChatWithToolsParams;

      expect(callArgs.systemPrompt).not.toContain('# Project Conventions');
    });
  });
});
