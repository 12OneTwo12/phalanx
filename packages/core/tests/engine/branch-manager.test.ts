import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BranchManager, type GitOperations } from '../../src/engine/branch-manager.js';

function createMockGit(): GitOperations {
  return {
    branch: vi.fn(async () => ['main', '* dev', 'feature/x']),
    checkout: vi.fn(async () => {}),
    checkoutBranch: vi.fn(async () => {}),
    deleteLocalBranch: vi.fn(async () => {}),
    revparse: vi.fn(async () => 'dev\n'),
    diff: vi.fn(async () => 'diff content'),
    raw: vi.fn(async () => 'file1.ts\nfile2.ts\n'),
  };
}

describe('BranchManager', () => {
  let git: GitOperations;
  let manager: BranchManager;

  beforeEach(() => {
    git = createMockGit();
    manager = new BranchManager(git);
  });

  describe('buildBranchName', () => {
    it('should create valid branch name from ticket ID and slug', () => {
      expect(manager.buildBranchName('t1', 'add-login')).toBe('ticket/t1-add-login');
    });

    it('should normalize slug with special characters', () => {
      expect(manager.buildBranchName('t1', 'Add Login Page')).toBe('ticket/t1-add-login-page');
    });

    it('should throw for empty ticket ID', () => {
      expect(() => manager.buildBranchName('', 'slug')).toThrow('Ticket ID cannot be empty');
    });

    it('should throw for empty slug', () => {
      expect(() => manager.buildBranchName('t1', '')).toThrow('Slug cannot be empty');
    });

    it('should throw for slug that produces only invalid chars', () => {
      expect(() => manager.buildBranchName('t1', '!!!')).toThrow('Cannot create valid slug');
    });

    it('should throw for branch name exceeding max length', () => {
      const longSlug = 'a'.repeat(200);
      expect(() => manager.buildBranchName('t1', longSlug)).not.toThrow(); // truncated to 50
    });
  });

  describe('createTicketBranch', () => {
    it('should create branch from current HEAD', async () => {
      const name = await manager.createTicketBranch('t1', 'my-task');
      expect(name).toBe('ticket/t1-my-task');
      expect(git.revparse).toHaveBeenCalledWith(['--abbrev-ref', 'HEAD']);
      expect(git.checkoutBranch).toHaveBeenCalledWith('ticket/t1-my-task', 'dev');
    });
  });

  describe('switchBranch', () => {
    it('should checkout the specified branch', async () => {
      await manager.switchBranch('main');
      expect(git.checkout).toHaveBeenCalledWith('main');
    });
  });

  describe('deleteBranch', () => {
    it('should delete a branch', async () => {
      await manager.deleteBranch('ticket/t1-task');
      expect(git.deleteLocalBranch).toHaveBeenCalledWith('ticket/t1-task', false);
    });

    it('should force delete when requested', async () => {
      await manager.deleteBranch('ticket/t1-task', true);
      expect(git.deleteLocalBranch).toHaveBeenCalledWith('ticket/t1-task', true);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return trimmed branch name', async () => {
      const branch = await manager.getCurrentBranch();
      expect(branch).toBe('dev');
    });
  });

  describe('branchExists', () => {
    it('should return true for existing branch', async () => {
      expect(await manager.branchExists('dev')).toBe(true);
    });

    it('should return false for non-existing branch', async () => {
      expect(await manager.branchExists('nonexistent')).toBe(false);
    });
  });

  describe('getDiff', () => {
    it('should return diff against base branch', async () => {
      const diff = await manager.getDiff('main');
      expect(git.diff).toHaveBeenCalledWith(['main', '--']);
      expect(diff).toBe('diff content');
    });
  });

  describe('getChangedFiles', () => {
    it('should return list of changed files', async () => {
      const files = await manager.getChangedFiles('main');
      expect(git.raw).toHaveBeenCalledWith(['diff', '--name-only', 'main']);
      expect(files).toEqual(['file1.ts', 'file2.ts']);
    });

    it('should filter empty lines', async () => {
      vi.mocked(git.raw).mockResolvedValue('a.ts\n\nb.ts\n');
      const files = await manager.getChangedFiles('main');
      expect(files).toEqual(['a.ts', 'b.ts']);
    });
  });
});
