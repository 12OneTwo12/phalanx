import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Notepad, type NotepadFileSystem } from '../../../src/engine/verification/notepad.js';

function makeMockFs(): NotepadFileSystem {
  const files = new Map<string, string>();
  return {
    mkdir: vi.fn(async () => {}),
    appendFile: vi.fn(async (path: string, content: string) => {
      files.set(path, (files.get(path) ?? '') + content);
    }),
    readFile: vi.fn(async (path: string) => files.get(path) ?? ''),
    exists: vi.fn(async (path: string) => files.has(path)),
  };
}

describe('Notepad', () => {
  let fs: NotepadFileSystem;
  let notepad: Notepad;

  beforeEach(() => {
    fs = makeMockFs();
    notepad = new Notepad(fs, '/project');
  });

  it('should append entry with timestamp', async () => {
    await notepad.append('t1', 'learnings', 'Learned X');
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.appendFile).toHaveBeenCalledWith(
      '/project/.phalanx/notepad/t1/learnings.md',
      expect.stringContaining('Learned X'),
    );
  });

  it('should read entries', async () => {
    await notepad.append('t1', 'issues', 'Issue A');
    // After append, exists should return true
    vi.mocked(fs.exists).mockResolvedValue(true);
    const content = await notepad.read('t1', 'issues');
    expect(content).toContain('Issue A');
  });

  it('should return empty string for non-existent notepad', async () => {
    vi.mocked(fs.exists).mockResolvedValue(false);
    const content = await notepad.read('t999', 'verification');
    expect(content).toBe('');
  });

  it('should use correct directory structure', () => {
    expect(notepad.getTicketDir('t1')).toBe('/project/.phalanx/notepad/t1');
  });
});
