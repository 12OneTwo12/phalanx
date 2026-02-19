import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryReadTool } from '../../src/tools/builtin/memory-read.js';
import { createMemoryWriteTool } from '../../src/tools/builtin/memory-write.js';
import type { MemoryFileSystem } from '../../src/agents/memory-writer.js';
import type { ToolExecutionContext } from '../../src/tools/types.js';

/** In-memory filesystem for testing */
class MockFS implements MemoryFileSystem {
  files = new Map<string, string>();
  dirs = new Set<string>();

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error('ENOENT');
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async ensureDir(path: string): Promise<void> {
    this.dirs.add(path);
  }
}

function makeContext(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return {
    agentId: 'agent-1',
    workingDirectory: '/project',
    ticketId: 'TK-42',
    ...overrides,
  };
}

describe('memory_read tool', () => {
  let mockFs: MockFS;
  const agentsDir = '/agents';

  beforeEach(() => {
    mockFs = new MockFS();
  });

  it('should return memory content when file exists', async () => {
    mockFs.files.set('/agents/agent-1/MEMORY.md', '## Learnings\n- **[pattern]** Use DI');
    const tool = createMemoryReadTool(agentsDir, mockFs);

    const result = await tool.execute({}, makeContext());

    expect(result.success).toBe(true);
    expect(result.content).toContain('Use DI');
  });

  it('should return friendly message when no memory file exists', async () => {
    const tool = createMemoryReadTool(agentsDir, mockFs);

    const result = await tool.execute({}, makeContext());

    expect(result.success).toBe(true);
    expect(result.content).toContain('No personal memory file found');
  });

  it('should filter by section keyword', async () => {
    mockFs.files.set('/agents/agent-1/MEMORY.md', [
      '- **[debugging]** Check stderr first',
      '- **[pattern]** Use repository pattern',
      '- **[debugging]** Enable verbose logging',
    ].join('\n'));

    const tool = createMemoryReadTool(agentsDir, mockFs);
    const result = await tool.execute({ section: 'debugging' }, makeContext());

    expect(result.success).toBe(true);
    expect(result.content).toContain('Check stderr first');
    expect(result.content).toContain('Enable verbose logging');
    expect(result.content).not.toContain('repository pattern');
  });

  it('should return message when no entries match section filter', async () => {
    mockFs.files.set('/agents/agent-1/MEMORY.md', '- **[pattern]** Something');
    const tool = createMemoryReadTool(agentsDir, mockFs);

    const result = await tool.execute({ section: 'debugging' }, makeContext());

    expect(result.success).toBe(true);
    expect(result.content).toContain('No memory entries matching');
  });

  it('should fail gracefully without agentId', async () => {
    const tool = createMemoryReadTool(agentsDir, mockFs);
    const result = await tool.execute({}, makeContext({ agentId: '' }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('No agent context');
  });
});

describe('memory_write tool', () => {
  let mockFs: MockFS;
  const agentsDir = '/agents';

  beforeEach(() => {
    mockFs = new MockFS();
  });

  it('should write a learning to the agent memory file', async () => {
    const tool = createMemoryWriteTool(agentsDir, mockFs);

    const result = await tool.execute(
      { category: 'pattern', content: 'Use factory pattern for DI' },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.content).toContain('Learning recorded');

    const written = mockFs.files.get('/agents/agent-1/MEMORY.md');
    expect(written).toContain('**[pattern]** Use factory pattern for DI');
    expect(written).toContain('_(TK-42)_');
  });

  it('should deduplicate existing entries', async () => {
    mockFs.files.set('/agents/agent-1/MEMORY.md', '- **[pattern]** Use factory pattern for DI _(TK-42)_');
    const tool = createMemoryWriteTool(agentsDir, mockFs);

    const result = await tool.execute(
      { category: 'pattern', content: 'Use factory pattern for DI' },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.content).toContain('already recorded');
  });

  it('should ensure parent directory exists', async () => {
    const tool = createMemoryWriteTool(agentsDir, mockFs);

    await tool.execute(
      { category: 'tool', content: 'Use vitest --run for CI' },
      makeContext({ agentId: 'new-agent' }),
    );

    expect(mockFs.dirs.has('/agents/new-agent')).toBe(true);
  });

  it('should fail gracefully without agentId', async () => {
    const tool = createMemoryWriteTool(agentsDir, mockFs);
    const result = await tool.execute(
      { category: 'test', content: 'something' },
      makeContext({ agentId: '' }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No agent context');
  });

  it('should normalize category to lowercase', async () => {
    const tool = createMemoryWriteTool(agentsDir, mockFs);

    await tool.execute(
      { category: 'DEBUGGING', content: 'Check logs' },
      makeContext(),
    );

    const written = mockFs.files.get('/agents/agent-1/MEMORY.md');
    expect(written).toContain('**[debugging]**');
  });
});
