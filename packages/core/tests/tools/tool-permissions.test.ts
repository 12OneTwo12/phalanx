import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  isToolPermitted,
  filterToolsByPermissions,
  mergePermissions,
  createDefaultPermissions,
} from '../../src/tools/tool-permissions.js';
import type { Tool, ToolCategory, ToolResult, AgentToolPermissions } from '../../src/tools/types.js';

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
// isToolPermitted
// ---------------------------------------------------------------------------

describe('isToolPermitted', () => {
  it('allows tool with empty permissions (default allow)', () => {
    const tool = makeTool({ name: 'file_read' });
    expect(isToolPermitted(tool, {})).toBe(true);
  });

  it('denies tool in denylist', () => {
    const tool = makeTool({ name: 'run_cmd' });
    expect(isToolPermitted(tool, { denylist: ['run_cmd'] })).toBe(false);
  });

  it('denies tool with category in categoryDenylist', () => {
    const tool = makeTool({ name: 'run_cmd', category: 'terminal' });
    expect(isToolPermitted(tool, { categoryDenylist: ['terminal'] })).toBe(false);
  });

  it('allows tool in allowlist', () => {
    const tool = makeTool({ name: 'file_read' });
    expect(isToolPermitted(tool, { allowlist: ['file_read', 'file_write'] })).toBe(true);
  });

  it('denies tool NOT in allowlist when allowlist is present', () => {
    const tool = makeTool({ name: 'run_cmd' });
    expect(isToolPermitted(tool, { allowlist: ['file_read'] })).toBe(false);
  });

  it('denylist overrides allowlist (deny-always-wins)', () => {
    const tool = makeTool({ name: 'run_cmd' });
    expect(
      isToolPermitted(tool, {
        allowlist: ['run_cmd', 'file_read'],
        denylist: ['run_cmd'],
      }),
    ).toBe(false);
  });

  it('categoryDenylist overrides allowlist', () => {
    const tool = makeTool({ name: 'run_cmd', category: 'terminal' });
    expect(
      isToolPermitted(tool, {
        allowlist: ['run_cmd'],
        categoryDenylist: ['terminal'],
      }),
    ).toBe(false);
  });

  it('allows tool not in denylist', () => {
    const tool = makeTool({ name: 'file_read' });
    expect(isToolPermitted(tool, { denylist: ['run_cmd'] })).toBe(true);
  });

  it('allows tool whose category is not in categoryDenylist', () => {
    const tool = makeTool({ name: 'file_read', category: 'filesystem' });
    expect(isToolPermitted(tool, { categoryDenylist: ['terminal'] })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterToolsByPermissions
// ---------------------------------------------------------------------------

describe('filterToolsByPermissions', () => {
  const tools: Tool[] = [
    makeTool({ name: 'file_read', category: 'filesystem' }),
    makeTool({ name: 'git_status', category: 'git' }),
    makeTool({ name: 'run_cmd', category: 'terminal' }),
  ];

  it('returns all tools with empty permissions', () => {
    const result = filterToolsByPermissions(tools, {});
    expect(result).toHaveLength(3);
  });

  it('filters by denylist', () => {
    const result = filterToolsByPermissions(tools, { denylist: ['run_cmd'] });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(['file_read', 'git_status']);
  });

  it('filters by allowlist', () => {
    const result = filterToolsByPermissions(tools, { allowlist: ['file_read'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('file_read');
  });

  it('filters by categoryDenylist', () => {
    const result = filterToolsByPermissions(tools, { categoryDenylist: ['terminal', 'git'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('file_read');
  });

  it('returns empty array when all tools are denied', () => {
    const result = filterToolsByPermissions(tools, {
      denylist: ['file_read', 'git_status', 'run_cmd'],
    });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mergePermissions
// ---------------------------------------------------------------------------

describe('mergePermissions', () => {
  it('concatenates denylists', () => {
    const result = mergePermissions(
      { denylist: ['a', 'b'] },
      { denylist: ['c', 'd'] },
    );
    expect(result.denylist).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd']));
  });

  it('concatenates categoryDenylists', () => {
    const result = mergePermissions(
      { categoryDenylist: ['filesystem'] },
      { categoryDenylist: ['git'] },
    );
    expect(result.categoryDenylist).toEqual(expect.arrayContaining(['filesystem', 'git']));
  });

  it('intersects allowlists when both present', () => {
    const result = mergePermissions(
      { allowlist: ['a', 'b', 'c'] },
      { allowlist: ['b', 'c', 'd'] },
    );
    expect(result.allowlist).toEqual(expect.arrayContaining(['b', 'c']));
    expect(result.allowlist).toHaveLength(2);
  });

  it('uses override allowlist when base has none', () => {
    const result = mergePermissions({}, { allowlist: ['x', 'y'] });
    expect(result.allowlist).toEqual(['x', 'y']);
  });

  it('uses base allowlist when override has none', () => {
    const result = mergePermissions({ allowlist: ['x', 'y'] }, {});
    expect(result.allowlist).toEqual(['x', 'y']);
  });

  it('deduplicates merged denylists', () => {
    const result = mergePermissions(
      { denylist: ['a', 'b'] },
      { denylist: ['b', 'c'] },
    );
    expect(result.denylist).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(result.denylist).toHaveLength(3);
  });

  it('deduplicates merged categoryDenylists', () => {
    const result = mergePermissions(
      { categoryDenylist: ['filesystem', 'git'] },
      { categoryDenylist: ['git', 'terminal'] },
    );
    expect(result.categoryDenylist).toEqual(
      expect.arrayContaining(['filesystem', 'git', 'terminal']),
    );
    expect(result.categoryDenylist).toHaveLength(3);
  });

  it('returns empty object when both inputs are empty', () => {
    const result = mergePermissions({}, {});
    expect(result).toEqual({});
  });

  it('omits denylist key when no denylists exist', () => {
    const result = mergePermissions({}, { allowlist: ['a'] });
    expect(result.denylist).toBeUndefined();
  });

  it('omits categoryDenylist key when no categoryDenylists exist', () => {
    const result = mergePermissions({ denylist: ['a'] }, {});
    expect(result.categoryDenylist).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createDefaultPermissions
// ---------------------------------------------------------------------------

describe('createDefaultPermissions', () => {
  it('returns empty object', () => {
    const perms = createDefaultPermissions();
    expect(perms).toEqual({});
  });

  it('returned permissions allow all tools (no restrictions)', () => {
    const perms = createDefaultPermissions();
    const tool = makeTool({ name: 'any_tool' });
    expect(isToolPermitted(tool, perms)).toBe(true);
  });
});
