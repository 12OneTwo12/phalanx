import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import type { Tool, ToolCategory, ToolResult, ToolExecutionContext } from '../../src/tools/types.js';

// ---------------------------------------------------------------------------
// Helper: create mock Tool objects
// ---------------------------------------------------------------------------

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    category: 'filesystem' as ToolCategory,
    schema: { path: z.string() },
    execute: async (): Promise<ToolResult> => ({ success: true, content: 'ok' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers a tool and retrieves by name', () => {
    const tool = makeTool({ name: 'file_read' });
    registry.register(tool);

    const retrieved = registry.get('file_read');
    expect(retrieved).toBe(tool);
  });

  it('throws on duplicate registration', () => {
    const tool = makeTool({ name: 'file_read' });
    registry.register(tool);

    expect(() => registry.register(makeTool({ name: 'file_read' }))).toThrow(
      "Tool 'file_read' is already registered",
    );
  });

  it('returns undefined for unknown tool', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('has() returns true for registered tool', () => {
    registry.register(makeTool({ name: 'file_read' }));
    expect(registry.has('file_read')).toBe(true);
  });

  it('has() returns false for unregistered tool', () => {
    expect(registry.has('file_read')).toBe(false);
  });

  it('getAll() returns all registered tools', () => {
    const tool1 = makeTool({ name: 'file_read' });
    const tool2 = makeTool({ name: 'file_write' });
    registry.register(tool1);
    registry.register(tool2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(tool1);
    expect(all).toContain(tool2);
  });

  it('getAll() returns empty array when no tools registered', () => {
    expect(registry.getAll()).toEqual([]);
  });

  it('getByCategory() filters correctly', () => {
    registry.register(makeTool({ name: 'file_read', category: 'filesystem' }));
    registry.register(makeTool({ name: 'git_status', category: 'git' }));
    registry.register(makeTool({ name: 'file_write', category: 'filesystem' }));

    const fsTools = registry.getByCategory('filesystem');
    expect(fsTools).toHaveLength(2);
    expect(fsTools.every((t) => t.category === 'filesystem')).toBe(true);
  });

  it('getByCategory() returns empty array for unused category', () => {
    registry.register(makeTool({ name: 'file_read', category: 'filesystem' }));
    expect(registry.getByCategory('github')).toEqual([]);
  });

  it('getForAgent() applies permission filtering with allowlist', () => {
    registry.register(makeTool({ name: 'file_read', category: 'filesystem' }));
    registry.register(makeTool({ name: 'git_status', category: 'git' }));
    registry.register(makeTool({ name: 'run_cmd', category: 'terminal' }));

    const result = registry.getForAgent({ allowlist: ['file_read', 'git_status'] });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(
      expect.arrayContaining(['file_read', 'git_status']),
    );
  });

  it('getForAgent() applies permission filtering with denylist', () => {
    registry.register(makeTool({ name: 'file_read', category: 'filesystem' }));
    registry.register(makeTool({ name: 'run_cmd', category: 'terminal' }));

    const result = registry.getForAgent({ denylist: ['run_cmd'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('file_read');
  });

  it('registerAll() registers multiple tools at once', () => {
    const tools = [
      makeTool({ name: 'file_read' }),
      makeTool({ name: 'file_write' }),
      makeTool({ name: 'git_status', category: 'git' }),
    ];
    registry.registerAll(tools);

    expect(registry.size).toBe(3);
    expect(registry.has('file_read')).toBe(true);
    expect(registry.has('file_write')).toBe(true);
    expect(registry.has('git_status')).toBe(true);
  });

  it('registerAll() throws on duplicate and stops', () => {
    registry.register(makeTool({ name: 'file_read' }));

    expect(() =>
      registry.registerAll([
        makeTool({ name: 'file_write' }),
        makeTool({ name: 'file_read' }), // duplicate
      ]),
    ).toThrow("Tool 'file_read' is already registered");
  });

  it('unregister() removes a tool and returns true', () => {
    registry.register(makeTool({ name: 'file_read' }));
    const removed = registry.unregister('file_read');

    expect(removed).toBe(true);
    expect(registry.has('file_read')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('unregister() returns false for unknown tool', () => {
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('clear() empties the registry', () => {
    registry.register(makeTool({ name: 'file_read' }));
    registry.register(makeTool({ name: 'file_write' }));
    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAll()).toEqual([]);
  });

  it('size getter returns correct count', () => {
    expect(registry.size).toBe(0);

    registry.register(makeTool({ name: 'a' }));
    expect(registry.size).toBe(1);

    registry.register(makeTool({ name: 'b' }));
    expect(registry.size).toBe(2);

    registry.unregister('a');
    expect(registry.size).toBe(1);
  });
});
