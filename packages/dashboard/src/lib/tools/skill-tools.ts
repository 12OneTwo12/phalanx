import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Tool, ToolResult, ToolExecutionContext } from '@phalanx/core';
import { SkillLoader, SkillRegistry } from '@phalanx/core';

// Singleton registry, lazily initialized
let _registry: SkillRegistry | null = null;

function getProjectRoot(): string {
  return process.env.PHALANX_PROJECT_ROOT ?? process.cwd();
}

function getRegistry(): SkillRegistry {
  if (!_registry) {
    const loader = new SkillLoader({ projectRoot: getProjectRoot() });
    _registry = new SkillRegistry(loader.loadAll());
  }
  return _registry;
}

/** Reset registry (for reload after mutations). */
export function resetSkillRegistry(): void {
  _registry = null;
}

// ---------------------------------------------------------------------------
// skill_list
// ---------------------------------------------------------------------------

const skillListSchema = {
  role: z.string().optional().describe('Filter by agent role'),
};

export const skillListTool: Tool<typeof skillListSchema> = {
  name: 'skill_list',
  description: 'List all loaded skills. Optionally filter by agent role.',
  category: 'skills',
  schema: skillListSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const registry = getRegistry();
      const skills = params.role
        ? registry.getForRole(params.role as import('@phalanx/core').AgentRole)
        : registry.list();
      const summary = skills.map((s) => ({
        name: s.name,
        description: s.description,
        source: s.source,
        roles: s.metadata?.roles ?? [],
        emoji: s.metadata?.emoji,
      }));
      return { success: true, content: JSON.stringify(summary, null, 2) };
    } catch (err) {
      return {
        success: false,
        content: '',
        error: `Failed to list skills: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// skill_read
// ---------------------------------------------------------------------------

const skillReadSchema = {
  name: z.string().describe('Skill name to read'),
};

export const skillReadTool: Tool<typeof skillReadSchema> = {
  name: 'skill_read',
  description: 'Read the full content of a skill by name.',
  category: 'skills',
  schema: skillReadSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const skill = getRegistry().get(params.name);
      if (!skill) {
        return { success: false, content: '', error: `Skill not found: ${params.name}` };
      }
      return { success: true, content: JSON.stringify(skill, null, 2) };
    } catch (err) {
      return {
        success: false,
        content: '',
        error: `Failed to read skill: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// skill_create
// ---------------------------------------------------------------------------

const skillCreateSchema = {
  name: z.string().describe('Skill name (used as directory name)'),
  description: z.string().describe('Skill description'),
  content: z.string().describe('Skill instructions (markdown body)'),
  metadata: z
    .object({
      emoji: z.string().optional(),
      roles: z.array(z.string()).optional(),
      requires: z
        .object({
          bins: z.array(z.string()).optional(),
          env: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional()
    .describe('Skill metadata (roles, emoji, requirements)'),
};

export const skillCreateTool: Tool<typeof skillCreateSchema> = {
  name: 'skill_create',
  description:
    'Create a new skill in the workspace skills directory. Generates SKILL.md with frontmatter.',
  category: 'skills',
  schema: skillCreateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const skillDir = path.join(getProjectRoot(), 'skills', params.name);

      if (fs.existsSync(skillDir)) {
        return { success: false, content: '', error: `Skill already exists: ${params.name}` };
      }

      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        buildSkillMd(params.name, params.description, params.content, params.metadata),
      );

      resetSkillRegistry();
      const skill = getRegistry().get(params.name);

      return {
        success: true,
        content: `Created skill: ${params.name}\n${JSON.stringify(skill, null, 2)}`,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        error: `Failed to create skill: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// skill_update
// ---------------------------------------------------------------------------

const skillUpdateSchema = {
  name: z.string().describe('Skill name to update'),
  description: z.string().optional().describe('New description'),
  content: z.string().optional().describe('New instructions content'),
  metadata: z
    .object({
      emoji: z.string().optional(),
      roles: z.array(z.string()).optional(),
      requires: z
        .object({
          bins: z.array(z.string()).optional(),
          env: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional()
    .describe('New metadata'),
};

export const skillUpdateTool: Tool<typeof skillUpdateSchema> = {
  name: 'skill_update',
  description: 'Update an existing skill. Merges provided fields with existing values.',
  category: 'skills',
  schema: skillUpdateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const registry = getRegistry();
      const existing = registry.get(params.name);
      if (!existing) {
        return { success: false, content: '', error: `Skill not found: ${params.name}` };
      }

      const desc = params.description ?? existing.description;
      const body = params.content ?? existing.content;
      const meta = params.metadata ?? existing.metadata;

      fs.writeFileSync(
        path.join(existing.baseDir, 'SKILL.md'),
        buildSkillMd(params.name, desc, body, meta),
      );

      resetSkillRegistry();
      return { success: true, content: `Updated skill: ${params.name}` };
    } catch (err) {
      return {
        success: false,
        content: '',
        error: `Failed to update skill: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// skill_delete
// ---------------------------------------------------------------------------

const skillDeleteSchema = {
  name: z.string().describe('Skill name to delete'),
};

export const skillDeleteTool: Tool<typeof skillDeleteSchema> = {
  name: 'skill_delete',
  description: 'Delete a skill from the workspace. Only workspace-source skills can be deleted.',
  category: 'skills',
  schema: skillDeleteSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const registry = getRegistry();
      const existing = registry.get(params.name);
      if (!existing) {
        return { success: false, content: '', error: `Skill not found: ${params.name}` };
      }

      if (existing.source !== 'workspace') {
        return {
          success: false,
          content: '',
          error: `Can only delete workspace skills. This skill is from: ${existing.source}`,
        };
      }

      fs.rmSync(existing.baseDir, { recursive: true, force: true });
      resetSkillRegistry();

      return { success: true, content: `Deleted skill: ${params.name}` };
    } catch (err) {
      return {
        success: false,
        content: '',
        error: `Failed to delete skill: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SkillMetaInput {
  emoji?: string;
  roles?: string[];
  requires?: { bins?: string[]; env?: string[] };
}

function buildSkillMd(
  name: string,
  description: string,
  content: string,
  metadata?: SkillMetaInput,
): string {
  const lines = ['---', `name: ${name}`, `description: ${description}`];

  if (metadata && Object.keys(metadata).length > 0) {
    const metaObj: Record<string, unknown> = { phalanx: metadata };
    lines.push(`metadata: ${JSON.stringify(metaObj)}`);
  }

  lines.push('---', '', content, '');
  return lines.join('\n');
}
