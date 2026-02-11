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
  message: z.string().describe('Commit message'),
  files: z
    .array(z.string())
    .optional()
    .describe('Files to stage before committing. If omitted, commits whatever is already staged.'),
};

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const gitCommitTool: Tool<typeof schema> = {
  name: 'git_commit',
  description:
    'Create a git commit. Optionally stages specific files first. ' +
    'Does NOT use --no-verify; pre-commit hooks will run.',
  category: 'git',
  schema,

  async execute(
    params: z.infer<z.ZodObject<typeof schema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      // Stage files if provided
      if (params.files && params.files.length > 0) {
        for (const file of params.files) {
          const safe = await resolveSafePath(file, context.workingDirectory);
          if (!safe) {
            return { success: false, content: '', error: `Path traversal denied: ${file}` };
          }
          await execFileAsync('git', ['add', file], {
            cwd: context.workingDirectory,
          });
        }
      }

      // Commit
      const { stdout } = await execFileAsync('git', ['commit', '-m', params.message], {
        cwd: context.workingDirectory,
      });

      return { success: true, content: stdout.trim() };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, content: '', error: msg };
    }
  },
};
