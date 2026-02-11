import { z } from 'zod';
import type { ToolDefinition, ToolParameter } from '../llm/types.js';
import type { Tool } from './types.js';

// ---------------------------------------------------------------------------
// Zod → JSON Schema (ToolParameter) conversion
// ---------------------------------------------------------------------------

/**
 * Convert a single Zod type to a ToolParameter (JSON Schema subset).
 * Supports the types needed for LLM function calling: string, number,
 * boolean, enum, array, object, and optional wrappers.
 */
export function zodTypeToParameter(schema: z.ZodTypeAny): ToolParameter {
  // Unwrap ZodOptional / ZodDefault to get the inner type
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return zodTypeToParameter(schema._def.innerType);
  }

  // Unwrap ZodEffects (e.g., .transform(), .refine())
  if (schema instanceof z.ZodEffects) {
    return zodTypeToParameter(schema._def.schema);
  }

  const desc = schema._def.description;

  if (schema instanceof z.ZodString) {
    return { type: 'string', ...(desc && { description: desc }) };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number', ...(desc && { description: desc }) };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean', ...(desc && { description: desc }) };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema._def.values as string[],
      ...(desc && { description: desc }),
    };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToParameter(schema._def.type),
      ...(desc && { description: desc }),
    };
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape() as Record<string, z.ZodTypeAny>;
    const properties: Record<string, ToolParameter> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodTypeToParameter(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
      ...(desc && { description: desc }),
    };
  }

  // Fallback for unsupported Zod types
  return { type: 'string', ...(desc && { description: desc }) };
}

// ---------------------------------------------------------------------------
// Tool → ToolDefinition conversion
// ---------------------------------------------------------------------------

/**
 * Convert a Tool (with Zod raw shape) to a ToolDefinition (JSON Schema)
 * for use with LLMProvider.chatWithTools().
 */
export function zodToToolDefinition(tool: Tool): ToolDefinition {
  const shape = tool.schema;
  const properties: Record<string, ToolParameter> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
    properties[key] = zodTypeToParameter(zodType);
    if (!(zodType instanceof z.ZodOptional) && !(zodType instanceof z.ZodDefault)) {
      required.push(key);
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    },
  };
}
