import * as fs from 'node:fs/promises';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import { resolveSafePath, isSensitivePath } from './path-utils.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  path: z.string().describe('File path to read (relative to working directory or absolute)'),
  offset: z.number().optional().describe('Start reading from this line number (1-based)'),
  limit: z.number().optional().describe('Maximum number of lines to read'),
};

function formatLines(lines: string[], startLine: number): string {
  const maxLineNum = startLine + lines.length - 1;
  const padWidth = String(maxLineNum).length;
  return lines
    .map((line, i) => {
      const num = String(startLine + i).padStart(padWidth, ' ');
      return `${num}\u2192 ${line}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const fileReadTool: Tool<typeof schema> = {
  name: 'file_read',
  description:
    'Read a file from the filesystem. Returns content with line numbers. ' +
    'Supports optional offset (1-based line number) and limit to read a slice.',
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

      const raw = await fs.readFile(resolved, 'utf-8');
      const allLines = raw.split('\n');

      const offset = params.offset ? Math.max(1, params.offset) : 1;
      const startIdx = offset - 1;
      const sliced = params.limit
        ? allLines.slice(startIdx, startIdx + params.limit)
        : allLines.slice(startIdx);

      const formatted = formatLines(sliced, offset);
      return { success: true, content: formatted };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT')) {
        return { success: false, content: '', error: `File not found: ${params.path}` };
      }
      return { success: false, content: '', error: msg };
    }
  },
};
