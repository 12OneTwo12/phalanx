/**
 * WorkspaceGuard — enforces agent workspace isolation.
 *
 * Ensures agents can only access files within their designated workspace
 * and cannot traverse out via `../` or symlinks.
 */
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Default blocked patterns (basenames that are always blocked)
// ---------------------------------------------------------------------------

const DEFAULT_BLOCKED_PATTERNS = [
  '.env',
  '.env.local',
  '.env.production',
  '.ssh',
  '*.pem',
  '*.key',
  'credentials.*',
  'id_rsa',
  'id_ed25519',
];

// ---------------------------------------------------------------------------
// WorkspaceGuard
// ---------------------------------------------------------------------------

export class WorkspaceGuard {
  private readonly rootDir: string;
  private readonly blockedPatterns: string[];

  constructor(rootDir: string, additionalBlocked?: string[]) {
    this.rootDir = path.resolve(rootDir);
    this.blockedPatterns = [...DEFAULT_BLOCKED_PATTERNS, ...(additionalBlocked ?? [])];
  }

  /**
   * Resolve a relative path within the workspace, preventing directory traversal.
   * Throws if the resolved path escapes the workspace root.
   */
  async resolveSafe(relativePath: string): Promise<string> {
    const resolved = path.resolve(this.rootDir, relativePath);

    // Check for directory traversal
    if (!resolved.startsWith(this.rootDir + path.sep) && resolved !== this.rootDir) {
      throw new WorkspaceEscapeError(relativePath, this.rootDir);
    }

    // Check for blocked patterns
    if (this.isBlocked(resolved)) {
      throw new BlockedPathError(relativePath);
    }

    // Resolve symlinks and re-check
    try {
      const realPath = await fs.realpath(resolved);
      if (!realPath.startsWith(this.rootDir + path.sep) && realPath !== this.rootDir) {
        throw new WorkspaceEscapeError(relativePath, this.rootDir);
      }
    } catch (err) {
      // File doesn't exist yet — that's fine for write operations
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    return resolved;
  }

  /**
   * Check if an absolute path is within the workspace and not blocked.
   */
  isAllowed(absolutePath: string): boolean {
    const resolved = path.resolve(absolutePath);
    if (!resolved.startsWith(this.rootDir + path.sep) && resolved !== this.rootDir) {
      return false;
    }
    return !this.isBlocked(resolved);
  }

  /** Get the root directory */
  get root(): string {
    return this.rootDir;
  }

  private isBlocked(absolutePath: string): boolean {
    const basename = path.basename(absolutePath);
    return this.blockedPatterns.some((pattern) => {
      if (pattern.startsWith('*')) {
        return basename.endsWith(pattern.slice(1));
      }
      if (pattern.endsWith('*')) {
        return basename.startsWith(pattern.slice(0, -1));
      }
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        return basename.startsWith(prefix + '.');
      }
      return basename === pattern;
    });
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
