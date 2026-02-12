import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Tool, ToolResult, ToolExecutionContext } from '@phalanx/core';
import { SkillLoader, SkillRegistry } from '@phalanx/core';

// Singleton registry, lazily initialized
let _registry: SkillRegistry | null = null;

function getRegistry(): SkillRegistry {
  if (!_registry) {
    const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? process.cwd();
    const loader = new SkillLoader({ projectRoot });
    _registry = new SkillRegistry(loader.loadAll());
  }
  return _registry;
}

/** Reset registry (for tests or reload). */
export function resetSkillRegistry(): void {
  _registry = null;
}

// -- skill_list --------------------------------------------------------------

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
      }));
      return { success: true, content: JSON.stringify(summary, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to list skills: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- skill_read --------------------------------------------------------------

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
      return { success: false, content: '', error: `Failed to read skill: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- skill_create ------------------------------------------------------------

const skillCreateSchema = {
  name: z.string().describe('Skill name (used as directory name)'),
  description: z.string().describe('Skill description'),
  content: z.string().describe('Skill instructions (markdown body)'),
  roles: z.array(z.string()).optional().describe('Agent roles that can use this skill'),
};

export const skillCreateTool: Tool<typeof skillCreateSchema> = {
  name: 'skill_create',
  description: 'Create a new skill in the workspace skills directory.',
  category: 'skills',
  schema: skillCreateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? process.cwd();
      const skillDir = path.join(projectRoot, 'skills', params.name);

      if (fs.existsSync(skillDir)) {
        return { success: false, content: '', error: `Skill directory already exists: ${params.name}` };
      }

      fs.mkdirSync(skillDir, { recursive: true });

      const frontmatter = [
        '---',
        `name: ${params.name}`,
        `description: ${params.description}`,
      ];
      if (params.roles && params.roles.length > 0) {
        frontmatter.push('roles:');
        for (const role of params.roles) {
          frontmatter.push(`  - ${role}`);
        }
      }
      frontmatter.push('---', '');

      const fileContent = frontmatter.join('\n') + '\n' + params.content + '\n';
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), fileContent);

      // Reload registry
      resetSkillRegistry();
      const registry = getRegistry();
      const skill = registry.get(params.name);

      return { success: true, content: `Created skill: ${params.name}\n${JSON.stringify(skill, null, 2)}` };
    } catch (err) {
      return { success: false, content: '', error: `Failed to create skill: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- skill_update ------------------------------------------------------------

const skillUpdateSchema = {
  name: z.string().describe('Skill name to update'),
  description: z.string().optional().describe('New description'),
  content: z.string().optional().describe('New instructions content'),
  roles: z.array(z.string()).optional().describe('New roles list'),
};

export const skillUpdateTool: Tool<typeof skillUpdateSchema> = {
  name: 'skill_update',
  description: 'Update an existing skill.',
  category: 'skills',
  schema: skillUpdateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const registry = getRegistry();
      const existing = registry.get(params.name);
      if (!existing) {
        return { success: false, content: '', error: `Skill not found: ${params.name}` };
      }

      const skillFile = path.join(existing.path, 'SKILL.md');
      const desc = params.description ?? existing.description;
      const body = params.content ?? existing.content;
      const roles = params.roles ?? existing.metadata?.roles;

      const frontmatter = ['---', `name: ${params.name}`, `description: ${desc}`];
      if (roles && roles.length > 0) {
        frontmatter.push('roles:');
        for (const role of roles) {
          frontmatter.push(`  - ${role}`);
        }
      }
      frontmatter.push('---', '');

      fs.writeFileSync(skillFile, frontmatter.join('\n') + '\n' + body + '\n');

      resetSkillRegistry();
      return { success: true, content: `Updated skill: ${params.name}` };
    } catch (err) {
      return { success: false, content: '', error: `Failed to update skill: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- skill_delete ------------------------------------------------------------

const skillDeleteSchema = {
  name: z.string().describe('Skill name to delete'),
};

export const skillDeleteTool: Tool<typeof skillDeleteSchema> = {
  name: 'skill_delete',
  description: 'Delete a skill from the workspace.',
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
        return { success: false, content: '', error: `Can only delete workspace skills. This skill is from: ${existing.source}` };
      }

      fs.rmSync(existing.path, { recursive: true, force: true });
      resetSkillRegistry();

      return { success: true, content: `Deleted skill: ${params.name}` };
    } catch (err) {
      return { success: false, content: '', error: `Failed to delete skill: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
