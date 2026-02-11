import * as fs from 'node:fs/promises';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import { resolveSafePath } from './path-utils.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  path: z.string().describe('File path to analyze'),
  type: z
    .enum(['imports', 'exports', 'structure'])
    .optional()
    .describe('Analysis type (default: structure)'),
};

function extractImports(content: string): string[] {
  const results: string[] = [];
  // ESM: import ... from '...'  /  import '...'
  const esmRe = /^import\s+.+$/gm;
  for (const match of content.matchAll(esmRe)) {
    results.push(match[0].trim());
  }
  // CJS: require('...')
  const cjsRe = /(?:const|let|var)\s+.+\s*=\s*require\(.+\)/g;
  for (const match of content.matchAll(cjsRe)) {
    results.push(match[0].trim());
  }
  return results;
}

function extractExports(content: string): string[] {
  const results: string[] = [];
  // export const/let/var/function/class/interface/type/enum/default
  const namedRe = /^export\s+(?:default\s+)?(?:const|let|var|function\*?|class|interface|type|enum|async\s+function)\s+(\w+)/gm;
  for (const match of content.matchAll(namedRe)) {
    results.push(match[0].trim());
  }
  // export default (without a declaration keyword following)
  const defaultRe = /^export\s+default\s+(?!const|let|var|function|class|interface|type|enum|async)/gm;
  for (const match of content.matchAll(defaultRe)) {
    results.push(match[0].trim());
  }
  // export { ... }
  const barrelRe = /^export\s*\{[^}]*\}/gm;
  for (const match of content.matchAll(barrelRe)) {
    results.push(match[0].trim());
  }
  // export * from '...'
  const reExportRe = /^export\s+\*\s+from\s+.+$/gm;
  for (const match of content.matchAll(reExportRe)) {
    results.push(match[0].trim());
  }
  return results;
}

function extractStructure(content: string): string[] {
  const results: string[] = [];

  // Functions (named, arrow assigned to const, async)
  const fnRe = /^(?:export\s+)?(?:async\s+)?function\*?\s+(\w+)/gm;
  for (const match of content.matchAll(fnRe)) {
    results.push(`function ${match[1]}`);
  }
  const arrowRe = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/gm;
  for (const match of content.matchAll(arrowRe)) {
    results.push(`function ${match[1]} (arrow)`);
  }

  // Classes
  const classRe = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm;
  for (const match of content.matchAll(classRe)) {
    results.push(`class ${match[1]}`);
  }

  // Interfaces
  const ifaceRe = /^(?:export\s+)?interface\s+(\w+)/gm;
  for (const match of content.matchAll(ifaceRe)) {
    results.push(`interface ${match[1]}`);
  }

  // Type aliases
  const typeRe = /^(?:export\s+)?type\s+(\w+)\s*=/gm;
  for (const match of content.matchAll(typeRe)) {
    results.push(`type ${match[1]}`);
  }

  // Enums
  const enumRe = /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/gm;
  for (const match of content.matchAll(enumRe)) {
    results.push(`enum ${match[1]}`);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const codeAnalyzeTool: Tool<typeof schema> = {
  name: 'code_analyze',
  description:
    'Analyze code structure using regex patterns (no AST dependency). ' +
    'Extracts imports, exports, or structural elements (functions, classes, interfaces, types, enums).',
  category: 'analysis',
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
      const analysisType = params.type ?? 'structure';

      let items: string[];
      let heading: string;

      switch (analysisType) {
        case 'imports':
          items = extractImports(content);
          heading = 'Imports';
          break;
        case 'exports':
          items = extractExports(content);
          heading = 'Exports';
          break;
        case 'structure':
          items = extractStructure(content);
          heading = 'Structure';
          break;
      }

      if (items.length === 0) {
        return { success: true, content: `${heading}: (none found)` };
      }

      const body = items.map((item) => `  - ${item}`).join('\n');
      return { success: true, content: `${heading} (${items.length}):\n${body}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT')) {
        return { success: false, content: '', error: `File not found: ${params.path}` };
      }
      return { success: false, content: '', error: msg };
    }
  },
};
