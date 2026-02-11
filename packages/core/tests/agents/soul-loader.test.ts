import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoulLoader } from '../../src/agents/soul-loader.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// Import after mock so the mock is in place
import * as fs from 'node:fs/promises';

const mockReadFile = vi.mocked(fs.readFile);

describe('SoulLoader', () => {
  let loader: SoulLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new SoulLoader('/templates');
  });

  it('loads all 4 soul files when they exist', async () => {
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('SOUL.md')) return 'soul content';
      if (p.endsWith('IDENTITY.md')) return 'identity content';
      if (p.endsWith('MEMORY.md')) return 'memory content';
      if (p.endsWith('SKILLS.md')) return 'skills content';
      throw new Error('File not found');
    });

    const result = await loader.load('backend');

    expect(result.soul).toBe('soul content');
    expect(result.identity).toBe('identity content');
    expect(result.memory).toBe('memory content');
    expect(result.skills).toBe('skills content');
  });

  it('returns empty strings for missing files (graceful degradation)', async () => {
    mockReadFile.mockImplementation(async () => {
      throw new Error('ENOENT: no such file or directory');
    });

    const result = await loader.load('frontend');

    expect(result.soul).toBe('');
    expect(result.identity).toBe('');
    expect(result.memory).toBe('');
    expect(result.skills).toBe('');
  });

  it('trims whitespace from file contents', async () => {
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('SOUL.md')) return '  soul with spaces  \n';
      if (p.endsWith('IDENTITY.md')) return '\n\n  identity  \n';
      if (p.endsWith('MEMORY.md')) return '  memory  ';
      if (p.endsWith('SKILLS.md')) return '\nskills\n\n';
      throw new Error('File not found');
    });

    const result = await loader.load('qa');

    expect(result.soul).toBe('soul with spaces');
    expect(result.identity).toBe('identity');
    expect(result.memory).toBe('memory');
    expect(result.skills).toBe('skills');
  });

  it('uses correct role directory path', async () => {
    mockReadFile.mockImplementation(async () => {
      throw new Error('not found');
    });

    await loader.load('team-lead');

    // Should read from /templates/team-lead/SOUL.md, etc.
    expect(mockReadFile).toHaveBeenCalledTimes(4);

    const calls = mockReadFile.mock.calls.map((c) => String(c[0]));
    expect(calls).toContain('/templates/team-lead/SOUL.md');
    expect(calls).toContain('/templates/team-lead/IDENTITY.md');
    expect(calls).toContain('/templates/team-lead/MEMORY.md');
    expect(calls).toContain('/templates/team-lead/SKILLS.md');
  });
});
