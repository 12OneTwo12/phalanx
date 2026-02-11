import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodTypeToParameter, zodToToolDefinition } from '../../src/tools/tool-schema.js';
import type { Tool, ToolCategory, ToolResult, ToolExecutionContext } from '../../src/tools/types.js';

// ---------------------------------------------------------------------------
// Helper: create a minimal Tool for zodToToolDefinition tests
// ---------------------------------------------------------------------------

function makeTool(overrides: Partial<Tool> & { schema: z.ZodRawShape }): Tool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    category: 'filesystem' as ToolCategory,
    execute: async (): Promise<ToolResult> => ({ success: true, content: 'ok' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// zodTypeToParameter
// ---------------------------------------------------------------------------

describe('zodTypeToParameter', () => {
  it('converts ZodString to { type: "string" }', () => {
    const result = zodTypeToParameter(z.string());
    expect(result).toEqual({ type: 'string' });
  });

  it('converts ZodNumber to { type: "number" }', () => {
    const result = zodTypeToParameter(z.number());
    expect(result).toEqual({ type: 'number' });
  });

  it('converts ZodBoolean to { type: "boolean" }', () => {
    const result = zodTypeToParameter(z.boolean());
    expect(result).toEqual({ type: 'boolean' });
  });

  it('converts ZodEnum to { type: "string", enum: [...] }', () => {
    const result = zodTypeToParameter(z.enum(['read', 'write', 'delete']));
    expect(result).toEqual({
      type: 'string',
      enum: ['read', 'write', 'delete'],
    });
  });

  it('converts ZodArray to { type: "array", items: { ... } }', () => {
    const result = zodTypeToParameter(z.array(z.string()));
    expect(result).toEqual({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('converts ZodObject (nested) to { type: "object", properties: { ... } }', () => {
    const result = zodTypeToParameter(
      z.object({
        path: z.string(),
        recursive: z.boolean(),
      }),
    );
    expect(result).toEqual({
      type: 'object',
      properties: {
        path: { type: 'string' },
        recursive: { type: 'boolean' },
      },
      required: ['path', 'recursive'],
    });
  });

  it('handles ZodOptional (not in required list of nested object)', () => {
    const result = zodTypeToParameter(
      z.object({
        path: z.string(),
        encoding: z.string().optional(),
      }),
    );
    expect(result).toEqual({
      type: 'object',
      properties: {
        path: { type: 'string' },
        encoding: { type: 'string' },
      },
      required: ['path'],
    });
  });

  it('handles ZodDefault (unwraps to underlying type)', () => {
    const result = zodTypeToParameter(z.number().default(10));
    expect(result).toEqual({ type: 'number' });
  });

  it('preserves .describe() as description field', () => {
    const result = zodTypeToParameter(z.string().describe('The file path'));
    expect(result).toEqual({
      type: 'string',
      description: 'The file path',
    });
  });

  it('preserves description through ZodOptional', () => {
    const result = zodTypeToParameter(z.string().describe('Optional encoding').optional());
    expect(result).toEqual({
      type: 'string',
      description: 'Optional encoding',
    });
  });

  it('preserves description through ZodDefault', () => {
    const result = zodTypeToParameter(z.number().describe('Limit value').default(100));
    expect(result).toEqual({
      type: 'number',
      description: 'Limit value',
    });
  });

  it('falls back to { type: "string" } for unknown types', () => {
    // z.date() is not handled by any of the explicit branches
    const result = zodTypeToParameter(z.date());
    expect(result).toEqual({ type: 'string' });
  });

  it('handles ZodEffects (e.g., .refine()) by unwrapping', () => {
    const refined = z.string().refine((val) => val.length > 0);
    const result = zodTypeToParameter(refined);
    expect(result).toEqual({ type: 'string' });
  });

  it('handles nested array of objects', () => {
    const result = zodTypeToParameter(
      z.array(
        z.object({
          name: z.string(),
          value: z.number(),
        }),
      ),
    );
    expect(result).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
        },
        required: ['name', 'value'],
      },
    });
  });

  it('omits required array when all object fields are optional', () => {
    const result = zodTypeToParameter(
      z.object({
        a: z.string().optional(),
        b: z.number().optional(),
      }),
    );
    expect(result).toEqual({
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
      },
    });
    expect(result.required).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// zodToToolDefinition
// ---------------------------------------------------------------------------

describe('zodToToolDefinition', () => {
  it('produces correct ToolDefinition with name, description, parameters', () => {
    const tool = makeTool({
      name: 'file_read',
      description: 'Read a file from disk',
      schema: {
        path: z.string(),
      },
    });

    const def = zodToToolDefinition(tool);

    expect(def.name).toBe('file_read');
    expect(def.description).toBe('Read a file from disk');
    expect(def.parameters.type).toBe('object');
    expect(def.parameters.properties).toHaveProperty('path');
    expect(def.parameters.properties['path']).toEqual({ type: 'string' });
  });

  it('marks required properties correctly (non-optional fields)', () => {
    const tool = makeTool({
      schema: {
        path: z.string(),
        content: z.string(),
      },
    });

    const def = zodToToolDefinition(tool);
    expect(def.parameters.required).toEqual(['path', 'content']);
  });

  it('omits optional fields from required list', () => {
    const tool = makeTool({
      schema: {
        path: z.string(),
        encoding: z.string().optional(),
        limit: z.number().default(100),
      },
    });

    const def = zodToToolDefinition(tool);
    expect(def.parameters.required).toEqual(['path']);
    expect(def.parameters.properties).toHaveProperty('encoding');
    expect(def.parameters.properties).toHaveProperty('limit');
  });

  it('omits required key entirely when all fields are optional', () => {
    const tool = makeTool({
      schema: {
        verbose: z.boolean().optional(),
        limit: z.number().optional(),
      },
    });

    const def = zodToToolDefinition(tool);
    expect(def.parameters.required).toBeUndefined();
  });

  it('handles empty schema', () => {
    const tool = makeTool({ schema: {} });

    const def = zodToToolDefinition(tool);
    expect(def.parameters.properties).toEqual({});
    expect(def.parameters.required).toBeUndefined();
  });
});
