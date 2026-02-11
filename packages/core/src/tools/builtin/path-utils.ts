import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Safe Path Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a file path safely within a working directory.
 * Returns null if the path escapes the working directory.
 *
 * Protections:
 * - Path traversal via ../ sequences (checked via path.resolve + startsWith)
 * - Symlink traversal (resolved via fs.realpath for existing paths)
 */
export async function resolveSafePath(
  filePath: string,
  workingDirectory: string,
): Promise<string | null> {
  // Normalize working directory to its real path
  let realWorkDir: string;
  try {
    realWorkDir = await fs.realpath(workingDirectory);
  } catch {
    return null;
  }

  const resolved = path.resolve(realWorkDir, filePath);

  // Basic path traversal check
  if (!resolved.startsWith(realWorkDir + path.sep) && resolved !== realWorkDir) {
    return null;
  }

  // For existing paths, verify real path stays within bounds (symlink check)
  try {
    const realResolved = await fs.realpath(resolved);
    if (
      !realResolved.startsWith(realWorkDir + path.sep) &&
      realResolved !== realWorkDir
    ) {
      return null;
    }
    return realResolved;
  } catch {
    // File doesn't exist yet (e.g., file_write creating new files)
    // Basic path.resolve check above was sufficient
    return resolved;
  }
}
