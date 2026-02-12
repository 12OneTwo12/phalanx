import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import { resolveSafePath, isSensitivePath } from './path-utils.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  path: z.string().describe('File path to write (relative to working directory or absolute)'),
  content: z.string().describe('Content to write to the file'),
};

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const fileWriteTool: Tool<typeof schema> = {
  name: 'file_write',
  description: 'Write content to a file. Creates parent directories automatically if needed.',
  category: 'filesystem',
  schema,

  async execute(
    params: z.infer<z.ZodObject<typeof schema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      if (isSensitivePath(params.path)) {
        return { success: false, content: '', error: 'Access denied: sensitive file path' };
      }

      const resolved = await resolveSafePath(params.path, context.workingDirectory);
      if (!resolved) {
        return { success: false, content: '', error: 'Path traversal denied' };
      }

      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, params.content, 'utf-8');

      const bytes = Buffer.byteLength(params.content, 'utf-8');
      return { success: true, content: `Wrote ${bytes} bytes to ${params.path}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, content: '', error: msg };
    }
  },
};
