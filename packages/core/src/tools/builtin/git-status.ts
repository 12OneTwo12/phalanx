import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {};

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const gitStatusTool: Tool<typeof schema> = {
  name: 'git_status',
  description: 'Show working tree status using `git status --porcelain`.',
  category: 'git',
  schema,

  async execute(
    _params: z.infer<z.ZodObject<typeof schema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
        cwd: context.workingDirectory,
      });
      const content = stdout.trim() || '(clean working tree)';
      return { success: true, content };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, content: '', error: msg };
    }
  },
};
