import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import { resolveSafePath } from './path-utils.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  staged: z.boolean().optional().describe('Show staged changes (--staged)'),
  path: z.string().optional().describe('Limit diff to a specific file path'),
};

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const gitDiffTool: Tool<typeof schema> = {
  name: 'git_diff',
  description: 'Show changes in the working tree or staging area using `git diff`.',
  category: 'git',
  schema,

  async execute(
    params: z.infer<z.ZodObject<typeof schema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      const args = ['diff'];
      if (params.staged) {
        args.push('--staged');
      }
      if (params.path) {
        const safe = await resolveSafePath(params.path, context.workingDirectory);
        if (!safe) {
          return { success: false, content: '', error: 'Path traversal denied' };
        }
        args.push('--', params.path);
      }

      const { stdout } = await execFileAsync('git', args, {
        cwd: context.workingDirectory,
      });
      const content = stdout.trim() || '(no changes)';
      return { success: true, content };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, content: '', error: msg };
    }
  },
};
