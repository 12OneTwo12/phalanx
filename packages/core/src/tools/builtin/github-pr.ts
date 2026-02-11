import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  action: z.enum(['create', 'view', 'list']).describe('PR action to perform'),
  title: z.string().optional().describe('PR title (required for create)'),
  body: z.string().optional().describe('PR body/description (used with create)'),
  base: z.string().optional().describe('Base branch for PR (used with create, default: repo default branch)'),
  head: z.string().optional().describe('Head branch for PR (used with create, default: current branch)'),
  number: z.number().optional().describe('PR number (required for view)'),
};

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const githubPrTool: Tool<typeof schema> = {
  name: 'github_pr',
  description:
    'Create, view, or list GitHub pull requests using the `gh` CLI. ' +
    'Requires `gh` to be installed and authenticated.',
  category: 'github',
  schema,

  async execute(
    params: z.infer<z.ZodObject<typeof schema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      let args: string[];

      switch (params.action) {
        case 'create': {
          if (!params.title) {
            return { success: false, content: '', error: 'title is required for create' };
          }
          args = ['pr', 'create', '--title', params.title];
          if (params.body) {
            args.push('--body', params.body);
          }
          if (params.base) {
            args.push('--base', params.base);
          }
          if (params.head) {
            args.push('--head', params.head);
          }
          break;
        }
        case 'view': {
          if (params.number == null) {
            return { success: false, content: '', error: 'number is required for view' };
          }
          args = ['pr', 'view', String(params.number)];
          break;
        }
        case 'list': {
          args = ['pr', 'list'];
          break;
        }
      }

      const { stdout } = await execFileAsync('gh', args, {
        cwd: context.workingDirectory,
      });

      return { success: true, content: stdout.trim() || '(no output)' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, content: '', error: msg };
    }
  },
};
