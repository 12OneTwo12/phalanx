/**
 * WorkspaceGuard — enforces agent workspace isolation.
 *
 * Delegates path safety and sensitive file detection to `path-utils.ts`
 * to avoid duplicated security logic. This class provides a convenient
 * object-oriented wrapper with custom error types.
 */
import * as path from 'node:path';
import { resolveSafePath, isSensitivePath } from './builtin/path-utils.js';

// ---------------------------------------------------------------------------
// WorkspaceGuard
// ---------------------------------------------------------------------------

export class WorkspaceGuard {
  private readonly rootDir: string;
  private readonly additionalBlocked: string[];

  constructor(rootDir: string, additionalBlocked?: string[]) {
    this.rootDir = path.resolve(rootDir);
    this.additionalBlocked = additionalBlocked ?? [];
  }

  /**
   * Resolve a relative path within the workspace, preventing directory traversal.
   * Throws if the resolved path escapes the workspace root or is a sensitive file.
   *
   * Uses `resolveSafePath` (which handles symlinks) and `isSensitivePath`
   * (which handles case-insensitive matching) from path-utils.
   */
  async resolveSafe(relativePath: string): Promise<string> {
    // Check sensitive path first (case-insensitive, covers .env, .ssh, *.pem, etc.)
    if (isSensitivePath(relativePath, this.additionalBlocked)) {
      throw new BlockedPathError(relativePath);
    }

    const resolved = await resolveSafePath(relativePath, this.rootDir);
    if (!resolved) {
      throw new WorkspaceEscapeError(relativePath, this.rootDir);
    }

    // Re-check the resolved path (in case symlink resolves to a sensitive file)
    if (isSensitivePath(resolved, this.additionalBlocked)) {
      throw new BlockedPathError(relativePath);
    }

    return resolved;
  }

  /**
   * Check if an absolute path is within the workspace and not blocked.
   * Note: This is a synchronous check and does NOT resolve symlinks.
   * For full symlink safety, use `resolveSafe()` instead.
   */
  isAllowed(absolutePath: string): boolean {
    const resolved = path.resolve(absolutePath);
    if (!resolved.startsWith(this.rootDir + path.sep) && resolved !== this.rootDir) {
      return false;
    }
    return !isSensitivePath(resolved, this.additionalBlocked);
  }

  /** Get the root directory */
  get root(): string {
    return this.rootDir;
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class WorkspaceEscapeError extends Error {
  constructor(attemptedPath: string, rootDir: string) {
    super(`Path "${attemptedPath}" escapes workspace root "${rootDir}"`);
    this.name = 'WorkspaceEscapeError';
  }
}

export class BlockedPathError extends Error {
  constructor(attemptedPath: string) {
    super(`Path "${attemptedPath}" matches a blocked pattern`);
    this.name = 'BlockedPathError';
  }
}
