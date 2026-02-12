import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWriter, type MemoryFileSystem } from '../../src/agents/memory-writer.js';

/** In-memory filesystem for testing */
class MockFS implements MemoryFileSystem {
  files = new Map<string, string>();

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error('ENOENT');
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}

describe('MemoryWriter', () => {
  let mockFs: MockFS;
  let writer: MemoryWriter;

  beforeEach(() => {
    mockFs = new MockFS();
    writer = new MemoryWriter('/templates', mockFs);
  });

  // -----------------------------------------------------------------------
  // extractLearnings
  // -----------------------------------------------------------------------

  describe('extractLearnings', () => {
    it('should parse entries with [category] prefix', () => {
      const raw = `
- [debugging] Always check stderr output first
- [pattern] Use repository pattern for DB access
* [pitfall] SQLite FK constraints need PRAGMA foreign_keys = ON
      `;
      const entries = writer.extractLearnings(raw, 'TK-1');
      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        category: 'debugging',
        content: 'Always check stderr output first',
        ticketId: 'TK-1',
      });
      expect(entries[2].category).toBe('pitfall');
    });

    it('should return empty array for empty input', () => {
      expect(writer.extractLearnings('')).toEqual([]);
      expect(writer.extractLearnings('  ')).toEqual([]);
    });

    it('should skip lines without the expected format', () => {
      const raw = `
Some random text
- [valid] This is valid
Not a list item
- Missing brackets content
      `;
      const entries = writer.extractLearnings(raw);
      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe('valid');
    });
  });

  // -----------------------------------------------------------------------
  // appendLearnings
  // -----------------------------------------------------------------------

  describe('appendLearnings', () => {
    it('should create MEMORY.md when it does not exist', async () => {
      const entries = [
        { category: 'pattern', content: 'Use DI for testability' },
      ];

      const count = await writer.appendLearnings('backend', entries);
      expect(count).toBe(1);

      const content = await mockFs.readFile('/templates/backend/MEMORY.md');
      expect(content).toContain('## Learnings');
      expect(content).toContain('**[pattern]** Use DI for testability');
    });

    it('should append to existing MEMORY.md', async () => {
      mockFs.files.set('/templates/qa/MEMORY.md', '# Agent Memory\n\nExisting content.');

      const count = await writer.appendLearnings('qa', [
        { category: 'tool', content: 'vitest --run for CI' },
      ]);

      expect(count).toBe(1);
      const content = await mockFs.readFile('/templates/qa/MEMORY.md');
      expect(content).toContain('Existing content.');
      expect(content).toContain('vitest --run for CI');
    });

    it('should deduplicate entries already in MEMORY.md', async () => {
      mockFs.files.set('/templates/backend/MEMORY.md', '- **[pattern]** Use DI for testability');

      const count = await writer.appendLearnings('backend', [
        { category: 'pattern', content: 'Use DI for testability' },
        { category: 'new', content: 'Brand new insight' },
      ]);

      expect(count).toBe(1);
      const content = await mockFs.readFile('/templates/backend/MEMORY.md');
      expect(content).toContain('Brand new insight');
    });

    it('should return 0 and not write when all entries are duplicates', async () => {
      mockFs.files.set('/templates/frontend/MEMORY.md', 'Use React hooks');

      const count = await writer.appendLearnings('frontend', [
        { category: 'pattern', content: 'Use React hooks' },
      ]);

      expect(count).toBe(0);
    });

    it('should return 0 for empty entries', async () => {
      const count = await writer.appendLearnings('backend', []);
      expect(count).toBe(0);
    });

    it('should include ticket ID in formatted output', async () => {
      const count = await writer.appendLearnings('devops', [
        { category: 'ops', content: 'Always check pod logs', ticketId: 'TK-42' },
      ]);

      expect(count).toBe(1);
      const content = await mockFs.readFile('/templates/devops/MEMORY.md');
      expect(content).toContain('_(TK-42)_');
    });
  });
});
