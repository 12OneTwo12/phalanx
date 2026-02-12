/**
 * Convention DB → Disk synchronization.
 *
 * When conventions are saved via the Dashboard API (DB), this module
 * writes them to the `.phalanx/` directory on disk so that the
 * ConventionLoader (used by AgentTicketExecutor) picks them up.
 *
 * Mapping: convention.type → file path
 *   - 'conventions' → .phalanx/CONVENTIONS.md
 *   - 'architecture' → .phalanx/ARCHITECTURE.md
 *   - 'style'        → .phalanx/STYLE.md
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Convention type → filename mapping */
const TYPE_FILE_MAP: Record<string, string> = {
  conventions: 'CONVENTIONS.md',
  architecture: 'ARCHITECTURE.md',
  style: 'STYLE.md',
};

/**
 * Write a convention to disk at `.phalanx/{TYPE}.md`.
 * Creates the `.phalanx/` directory if it doesn't exist.
 *
 * @returns The absolute path written, or null if the type is unknown.
 */
export function syncConventionToDisk(
  type: string,
  content: string,
  projectRoot?: string,
): string | null {
  const filename = TYPE_FILE_MAP[type];
  if (!filename) return null;

  const root = projectRoot ?? process.env.PHALANX_PROJECT_ROOT ?? process.cwd();
  const conventionDir = resolve(root, '.phalanx');
  const filePath = resolve(conventionDir, filename);

  if (!existsSync(conventionDir)) {
    mkdirSync(conventionDir, { recursive: true });
  }

  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Sync all conventions from DB to disk.
 * Useful for initial sync or recovery.
 */
export function syncAllConventionsToDisk(
  conventions: Array<{ type: string; content: string }>,
  projectRoot?: string,
): string[] {
  const written: string[] = [];
  for (const conv of conventions) {
    const path = syncConventionToDisk(conv.type, conv.content, projectRoot);
    if (path) written.push(path);
  }
  return written;
}
