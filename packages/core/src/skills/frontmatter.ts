/**
 * SKILL.md frontmatter parser.
 *
 * Parses YAML frontmatter with JSON metadata field, following OpenClaw's pattern.
 *
 * Format:
 * ```
 * ---
 * name: my-skill
 * description: Does something useful
 * metadata: { "phalanx": { "emoji": "🔧", "roles": ["backend"], "requires": { "bins": ["node"] } } }
 * ---
 *
 * # Instructions body...
 * ```
 */
import type { ParsedFrontmatter, PhalanxSkillMetadata } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FrontmatterResult {
  frontmatter: ParsedFrontmatter;
  body: string;
}

/**
 * Parse a SKILL.md file into frontmatter + body.
 */
export function parseFrontmatter(raw: string): FrontmatterResult {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: raw.trim() };
  }

  const yamlBlock = match[1];
  const body = match[2].trim();
  const frontmatter = parseYamlBlock(yamlBlock);

  return { frontmatter, body };
}

// ---------------------------------------------------------------------------
// Internal YAML parser (lightweight, no external dep)
// ---------------------------------------------------------------------------

function parseYamlBlock(yaml: string): ParsedFrontmatter {
  const result: ParsedFrontmatter = {};

  result.name = extractString(yaml, 'name');
  result.description = extractString(yaml, 'description');

  // metadata is a JSON (or JSON5-like) value on a single line
  const metaLine = extractString(yaml, 'metadata');
  if (metaLine) {
    try {
      const parsed = JSON.parse(metaLine);
      // Support both { phalanx: {...} } wrapper and flat format
      const phalanxMeta: PhalanxSkillMetadata = parsed.phalanx ?? parsed;
      result.metadata = {
        emoji: phalanxMeta.emoji,
        roles: phalanxMeta.roles,
        requires: phalanxMeta.requires
          ? {
              bins: phalanxMeta.requires.bins,
              env: phalanxMeta.requires.env,
            }
          : undefined,
      };
    } catch {
      // If JSON parse fails, try extracting from YAML-style nested blocks
      result.metadata = parseYamlMetadata(yaml);
    }
  } else {
    // Try YAML-style nested metadata/roles/requires blocks
    result.metadata = parseYamlMetadata(yaml);
  }

  return result;
}

/**
 * Fallback: parse metadata from YAML-style nested blocks.
 * Supports:
 *   roles:
 *     - backend
 *     - qa
 *   requires:
 *     bins:
 *       - curl
 */
function parseYamlMetadata(yaml: string): PhalanxSkillMetadata | undefined {
  const meta: PhalanxSkillMetadata = {};
  let hasAny = false;

  // roles
  const roles = extractArray(yaml, 'roles');
  if (roles) {
    meta.roles = roles;
    hasAny = true;
  }

  // emoji
  const emoji = extractString(yaml, 'emoji');
  if (emoji) {
    meta.emoji = emoji;
    hasAny = true;
  }

  // requires block
  const requiresMatch = yaml.match(/requires:\s*\n((?:\s+.*\n?)*)/);
  if (requiresMatch) {
    const reqBlock = requiresMatch[1];
    const bins = extractArray(reqBlock, 'bins');
    const env = extractArray(reqBlock, 'env');
    if (bins || env) {
      meta.requires = { bins, env };
      hasAny = true;
    }
  }

  return hasAny ? meta : undefined;
}

function extractString(yaml: string, key: string): string | undefined {
  // Match key: value (handles quoted and unquoted values)
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = yaml.match(re);
  if (!match) return undefined;

  let val = match[1].trim();
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val || undefined;
}

function extractArray(yaml: string, key: string): string[] | undefined {
  // YAML list style:
  //   key:
  //     - item1
  //     - item2
  const sectionMatch = yaml.match(new RegExp(`${key}:\\s*\\n((?:\\s+-\\s+.*\\n?)*)`, 'm'));
  if (sectionMatch) {
    const items: string[] = [];
    for (const line of sectionMatch[1].split('\n')) {
      const m = line.match(/^\s+-\s+(.+)/);
      if (m) items.push(m[1].trim().replace(/^["']|["']$/g, ''));
    }
    return items.length > 0 ? items : undefined;
  }

  // Inline array: key: [a, b, c]
  const inlineMatch = yaml.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`, 'm'));
  if (inlineMatch) {
    return inlineMatch[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
  }

  return undefined;
}
