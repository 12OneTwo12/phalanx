import * as fs from 'node:fs/promises';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import { resolveSafePath } from './path-utils.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  path: z.string().describe('File path to edit (relative to working directory or absolute)'),
  old_string: z.string().describe('Exact string to find and replace'),
  new_string: z.string().describe('Replacement string'),
  replace_all: z
    .boolean()
    .optional()
    .describe('Replace all occurrences (default: false, errors if multiple matches)'),
};

function countOccurrences(source: string, search: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = source.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const fileEditTool: Tool<typeof schema> = {
  name: 'file_edit',
  description:
    'Replace an exact string in a file. If replace_all is false (default) and the string ' +
    'appears more than once, returns an error asking for more surrounding context.',
  category: 'filesystem',
  schema,

  async execute(
    params: z.infer<z.ZodObject<typeof schema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      const resolved = await resolveSafePath(params.path, context.workingDirectory);
      if (!resolved) {
        return { success: false, content: '', error: 'Path traversal denied' };
      }

      const content = await fs.readFile(resolved, 'utf-8');
      const occurrences = countOccurrences(content, params.old_string);

      if (occurrences === 0) {
        return {
          success: false,
          content: '',
          error: 'old_string not found in file. Ensure the string matches exactly.',
        };
      }

      if (!params.replace_all && occurrences > 1) {
        return {
          success: false,
          content: '',
          error:
            `old_string appears ${occurrences} times. Provide more surrounding context ` +
            'to make it unique, or set replace_all to true.',
        };
      }

      const updated = params.replace_all
        ? content.split(params.old_string).join(params.new_string)
        : content.replace(params.old_string, params.new_string);

      await fs.writeFile(resolved, updated, 'utf-8');

      const replacements = params.replace_all ? occurrences : 1;
      return {
        success: true,
        content: `Replaced ${replacements} occurrence${replacements > 1 ? 's' : ''} in ${params.path}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT')) {
        return { success: false, content: '', error: `File not found: ${params.path}` };
      }
      return { success: false, content: '', error: msg };
    }
  },
};
