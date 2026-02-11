import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  BUILTIN_TOOLS,
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  gitStatusTool,
  gitDiffTool,
  gitCommitTool,
  gitLogTool,
  terminalExecTool,
  githubPrTool,
  codeAnalyzeTool,
} from '../../src/tools/builtin/index.js';
import type { ToolExecutionContext } from '../../src/tools/types.js';

// ---------------------------------------------------------------------------
// BUILTIN_TOOLS array
// ---------------------------------------------------------------------------

describe('BUILTIN_TOOLS', () => {
  it('contains exactly 10 tools', () => {
    expect(BUILTIN_TOOLS).toHaveLength(10);
  });

  it('all tools have unique names', () => {
    const names = BUILTIN_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all tools have valid categories', () => {
    const validCategories = new Set(['filesystem', 'git', 'terminal', 'github', 'analysis']);
    for (const tool of BUILTIN_TOOLS) {
      expect(validCategories.has(tool.category)).toBe(true);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of BUILTIN_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('all tools have an execute function', () => {
    for (const tool of BUILTIN_TOOLS) {
      expect(typeof tool.execute).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// File tools — shared temp directory setup
// ---------------------------------------------------------------------------

describe('file tools', () => {
  let tmpDir: string;
  let ctx: ToolExecutionContext;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phalanx-test-'));
    ctx = { agentId: 'test-agent', workingDirectory: tmpDir };
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // file_read
  // -------------------------------------------------------------------------

  describe('file_read', () => {
    it('reads file content with line numbers', async () => {
      const filePath = path.join(tmpDir, 'hello.txt');
      await fs.writeFile(filePath, 'line one\nline two\nline three', 'utf-8');

      const result = await fileReadTool.execute({ path: 'hello.txt' }, ctx);

      expect(result.success).toBe(true);
      expect(result.content).toContain('line one');
      expect(result.content).toContain('line two');
      expect(result.content).toContain('line three');
      // Line numbers are formatted with arrow separator
      expect(result.content).toMatch(/1\u2192/);
    });

    it('supports offset parameter', async () => {
      const filePath = path.join(tmpDir, 'offset.txt');
      await fs.writeFile(filePath, 'a\nb\nc\nd\ne', 'utf-8');

      const result = await fileReadTool.execute({ path: 'offset.txt', offset: 3 }, ctx);

      expect(result.success).toBe(true);
      // Should start from line 3 ("c")
      expect(result.content).toContain('c');
      expect(result.content).toContain('d');
      expect(result.content).toContain('e');
      // Should not contain line 1 or 2
      expect(result.content).not.toMatch(/\u2192 a\n/);
      expect(result.content).not.toMatch(/\u2192 b\n/);
    });

    it('supports limit parameter', async () => {
      const filePath = path.join(tmpDir, 'limit.txt');
      await fs.writeFile(filePath, 'a\nb\nc\nd\ne', 'utf-8');

      const result = await fileReadTool.execute({ path: 'limit.txt', limit: 2 }, ctx);

      expect(result.success).toBe(true);
      expect(result.content).toContain('a');
      expect(result.content).toContain('b');
      expect(result.content).not.toContain('c');
    });

    it('returns error for non-existent file', async () => {
      const result = await fileReadTool.execute({ path: 'does-not-exist.txt' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('blocks path traversal', async () => {
      const result = await fileReadTool.execute({ path: '../../etc/passwd' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path traversal denied');
    });
  });

  // -------------------------------------------------------------------------
  // file_write
  // -------------------------------------------------------------------------

  describe('file_write', () => {
    it('writes content to file', async () => {
      const result = await fileWriteTool.execute(
        { path: 'output.txt', content: 'hello world' },
        ctx,
      );

      expect(result.success).toBe(true);
      const written = await fs.readFile(path.join(tmpDir, 'output.txt'), 'utf-8');
      expect(written).toBe('hello world');
    });

    it('creates parent directories automatically', async () => {
      const result = await fileWriteTool.execute(
        { path: 'deep/nested/dir/file.txt', content: 'nested content' },
        ctx,
      );

      expect(result.success).toBe(true);
      const written = await fs.readFile(
        path.join(tmpDir, 'deep', 'nested', 'dir', 'file.txt'),
        'utf-8',
      );
      expect(written).toBe('nested content');
    });

    it('reports bytes written', async () => {
      const content = 'hello';
      const result = await fileWriteTool.execute({ path: 'bytes.txt', content }, ctx);

      expect(result.success).toBe(true);
      const expectedBytes = Buffer.byteLength(content, 'utf-8');
      expect(result.content).toContain(`${expectedBytes} bytes`);
    });

    it('blocks path traversal', async () => {
      const result = await fileWriteTool.execute(
        { path: '../../../tmp/evil.txt', content: 'bad' },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path traversal denied');
    });
  });

  // -------------------------------------------------------------------------
  // file_edit
  // -------------------------------------------------------------------------

  describe('file_edit', () => {
    it('replaces exact string match', async () => {
      const filePath = path.join(tmpDir, 'edit.txt');
      await fs.writeFile(filePath, 'hello world', 'utf-8');

      const result = await fileEditTool.execute(
        { path: 'edit.txt', old_string: 'hello', new_string: 'goodbye' },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(result.content).toContain('Replaced 1 occurrence');
      const updated = await fs.readFile(filePath, 'utf-8');
      expect(updated).toBe('goodbye world');
    });

    it('errors when old_string not found', async () => {
      const filePath = path.join(tmpDir, 'edit-miss.txt');
      await fs.writeFile(filePath, 'hello world', 'utf-8');

      const result = await fileEditTool.execute(
        { path: 'edit-miss.txt', old_string: 'nonexistent', new_string: 'replaced' },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('old_string not found');
    });

    it('errors when multiple matches without replace_all', async () => {
      const filePath = path.join(tmpDir, 'edit-multi.txt');
      await fs.writeFile(filePath, 'foo bar foo baz foo', 'utf-8');

      const result = await fileEditTool.execute(
        { path: 'edit-multi.txt', old_string: 'foo', new_string: 'qux' },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('appears 3 times');
    });

    it('replaces all with replace_all: true', async () => {
      const filePath = path.join(tmpDir, 'edit-all.txt');
      await fs.writeFile(filePath, 'foo bar foo baz foo', 'utf-8');

      const result = await fileEditTool.execute(
        { path: 'edit-all.txt', old_string: 'foo', new_string: 'qux', replace_all: true },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(result.content).toContain('Replaced 3 occurrences');
      const updated = await fs.readFile(filePath, 'utf-8');
      expect(updated).toBe('qux bar qux baz qux');
    });

    it('blocks path traversal', async () => {
      const result = await fileEditTool.execute(
        { path: '../../etc/hosts', old_string: 'x', new_string: 'y' },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path traversal denied');
    });
  });
});

// ---------------------------------------------------------------------------
// Git tools — schema and structure verification only
// ---------------------------------------------------------------------------

describe('git tools', () => {
  it('git_status has name "git_status" and category "git"', () => {
    expect(gitStatusTool.name).toBe('git_status');
    expect(gitStatusTool.category).toBe('git');
  });

  it('git_diff has name "git_diff" and category "git"', () => {
    expect(gitDiffTool.name).toBe('git_diff');
    expect(gitDiffTool.category).toBe('git');
  });

  it('git_commit has name "git_commit" and category "git"', () => {
    expect(gitCommitTool.name).toBe('git_commit');
    expect(gitCommitTool.category).toBe('git');
  });

  it('git_log has name "git_log" and category "git"', () => {
    expect(gitLogTool.name).toBe('git_log');
    expect(gitLogTool.category).toBe('git');
  });
});

// ---------------------------------------------------------------------------
// Terminal exec — schema verification only
// ---------------------------------------------------------------------------

describe('terminal_exec', () => {
  it('has category "terminal"', () => {
    expect(terminalExecTool.category).toBe('terminal');
  });

  it('has name "terminal_exec"', () => {
    expect(terminalExecTool.name).toBe('terminal_exec');
  });
});

// ---------------------------------------------------------------------------
// github_pr — schema verification only
// ---------------------------------------------------------------------------

describe('github_pr', () => {
  it('has name "github_pr" and category "github"', () => {
    expect(githubPrTool.name).toBe('github_pr');
    expect(githubPrTool.category).toBe('github');
  });
});

// ---------------------------------------------------------------------------
// code_analyze — schema verification only
// ---------------------------------------------------------------------------

describe('code_analyze', () => {
  it('has name "code_analyze" and category "analysis"', () => {
    expect(codeAnalyzeTool.name).toBe('code_analyze');
    expect(codeAnalyzeTool.category).toBe('analysis');
  });
});
