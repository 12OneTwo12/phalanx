import type { AgentToolPermissions, Tool, ToolCategory } from './types.js';

// ---------------------------------------------------------------------------
// Tool Permission Resolution
// ---------------------------------------------------------------------------

/**
 * Check if a single tool is permitted under the given permissions.
 *
 * Resolution order (deny-always-wins):
 *   1. denylist match → denied
 *   2. categoryDenylist match → denied
 *   3. allowlist exists and tool NOT in it → denied
 *   4. Otherwise → allowed
 */
export function isToolPermitted(tool: Tool, permissions: AgentToolPermissions): boolean {
  // Step 1: denylist always wins
  if (permissions.denylist?.includes(tool.name)) {
    return false;
  }

  // Step 2: category denylist
  if (permissions.categoryDenylist?.includes(tool.category)) {
    return false;
  }

  // Step 3: allowlist (exclusive when present)
  if (permissions.allowlist && permissions.allowlist.length > 0) {
    return permissions.allowlist.includes(tool.name);
  }

  // Step 4: default allow
  return true;
}

/**
 * Filter a list of tools by the given permissions.
 * Returns only tools that pass the permission check.
 */
export function filterToolsByPermissions(
  tools: Tool[],
  permissions: AgentToolPermissions,
): Tool[] {
  return tools.filter((tool) => isToolPermitted(tool, permissions));
}

/**
 * Create a default permission set that allows all tools.
 */
export function createDefaultPermissions(): AgentToolPermissions {
  return {};
}

/**
 * Merge two permission sets. Deny lists are concatenated; allowlists
 * are intersected when both exist.
 */
export function mergePermissions(
  base: AgentToolPermissions,
  override: AgentToolPermissions,
): AgentToolPermissions {
  const denylist = [
    ...(base.denylist ?? []),
    ...(override.denylist ?? []),
  ];

  const categoryDenylist = [
    ...(base.categoryDenylist ?? []),
    ...(override.categoryDenylist ?? []),
  ] as ToolCategory[];

  // Intersect allowlists: if both have them, only keep names in both
  let allowlist: string[] | undefined;
  if (base.allowlist && override.allowlist) {
    const overrideSet = new Set(override.allowlist);
    allowlist = base.allowlist.filter((name) => overrideSet.has(name));
  } else {
    allowlist = override.allowlist ?? base.allowlist;
  }

  return {
    ...(denylist.length > 0 && { denylist: [...new Set(denylist)] }),
    ...(categoryDenylist.length > 0 && { categoryDenylist: [...new Set(categoryDenylist)] }),
    ...(allowlist && { allowlist }),
  };
}
