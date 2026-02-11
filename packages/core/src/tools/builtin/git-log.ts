import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  count: z.number().optional().describe('Number of commits to show (default: 10)'),
  oneline: z.boolean().optional().describe('Use --oneline format'),
};

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const gitLogTool: Tool<typeof schema> = {
  name: 'git_log',
  description: 'Show git commit history.',
  category: 'git',
  schema,

  async execute(
    params: z.infer<z.ZodObject<typeof schema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      const args = ['log'];
      const count = params.count ?? 10;
      args.push(`-n`, String(count));
      if (params.oneline) {
        args.push('--oneline');
      }

      const { stdout } = await execFileAsync('git', args, {
        cwd: context.workingDirectory,
      });
      const content = stdout.trim() || '(no commits)';
      return { success: true, content };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, content: '', error: msg };
    }
  },
};
