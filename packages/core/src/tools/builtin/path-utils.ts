import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Sensitive Path Detection
// ---------------------------------------------------------------------------

/** File basenames that are always considered sensitive */
const DEFAULT_SENSITIVE_BASENAMES: string[] = [
  '.env', '.env.local', '.env.production', '.env.staging',
  '.env.development', '.env.test',
  'credentials.json', 'secrets.json', 'secrets.yaml', 'secrets.yml',
];

/** File extensions that are always considered sensitive */
const SENSITIVE_EXTENSIONS = ['.pem', '.key', '.p12', '.pfx', '.jks'];

/** Path segments that indicate sensitive directories */
const SENSITIVE_PATH_SEGMENTS = ['.aws/credentials', '.ssh/'];

/**
 * Check if a file path points to a sensitive file (credentials, keys, etc.).
 * Blocks access to .env files, private keys, credential stores, and similar.
 * Comparisons are case-insensitive to handle macOS/Windows filesystems.
 */
export function isSensitivePath(filePath: string, customPatterns?: string[]): boolean {
  const normalized = path.normalize(filePath);
  const normalizedLower = normalized.toLowerCase();
  const basename = path.basename(normalized);
  const basenameLower = basename.toLowerCase();
  const allPatterns = [...DEFAULT_SENSITIVE_BASENAMES, ...(customPatterns ?? [])];

  // Check exact basename match (case-insensitive)
  if (allPatterns.some(p => p.toLowerCase() === basenameLower)) return true;

  // Check sensitive path segments (case-insensitive)
  for (const segment of SENSITIVE_PATH_SEGMENTS) {
    if (normalizedLower.includes(segment.toLowerCase())) return true;
  }

  // Check sensitive extensions (already lowercase)
  const ext = path.extname(basename).toLowerCase();
  if (SENSITIVE_EXTENSIONS.includes(ext)) return true;

  // Check SSH private key patterns (exclude .pub public keys)
  if (/^id_(rsa|ed25519|ecdsa|dsa)$/i.test(basename)) return true;

  return false;
}

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
