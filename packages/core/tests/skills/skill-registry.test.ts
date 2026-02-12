import { describe, it, expect } from 'vitest';
import { SkillRegistry } from '../../src/skills/skill-registry.js';
import type { Skill } from '../../src/skills/types.js';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    content: 'Do the thing.',
    metadata: {},
    source: 'workspace',
    path: '/tmp/skills/test-skill',
    ...overrides,
  };
}

describe('SkillRegistry', () => {
  it('initializes with skills', () => {
    const registry = new SkillRegistry([makeSkill(), makeSkill({ name: 'other' })]);
    expect(registry.size).toBe(2);
    expect(registry.list()).toHaveLength(2);
  });

  it('add/get/has/remove', () => {
    const registry = new SkillRegistry();
    const skill = makeSkill();

    registry.add(skill);
    expect(registry.has('test-skill')).toBe(true);
    expect(registry.get('test-skill')).toEqual(skill);

    expect(registry.remove('test-skill')).toBe(true);
    expect(registry.has('test-skill')).toBe(false);
    expect(registry.remove('test-skill')).toBe(false);
  });

  it('filters by role', () => {
    const registry = new SkillRegistry([
      makeSkill({ name: 'backend-only', metadata: { roles: ['backend'] } }),
      makeSkill({ name: 'qa-only', metadata: { roles: ['qa'] } }),
      makeSkill({ name: 'all-roles', metadata: {} }),
      makeSkill({ name: 'no-meta' }),
    ]);

    const backendSkills = registry.getForRole('backend');
    expect(backendSkills.map((s) => s.name).sort()).toEqual([
      'all-roles',
      'backend-only',
      'no-meta',
    ]);

    const qaSkills = registry.getForRole('qa');
    expect(qaSkills.map((s) => s.name).sort()).toEqual(['all-roles', 'no-meta', 'qa-only']);
  });

  it('formats skills for prompt', () => {
    const registry = new SkillRegistry([
      makeSkill({ name: 'git-tool', description: 'Git ops', content: 'Use git commands.' }),
    ]);

    const prompt = registry.formatForPrompt();
    expect(prompt).toContain('# Available Skills');
    expect(prompt).toContain('## Skill: git-tool');
    expect(prompt).toContain('> Git ops');
    expect(prompt).toContain('Use git commands.');
  });

  it('returns empty string when no skills match', () => {
    const registry = new SkillRegistry();
    expect(registry.formatForPrompt()).toBe('');
  });

  it('formatForPrompt filters by role', () => {
    const registry = new SkillRegistry([
      makeSkill({ name: 'be-skill', metadata: { roles: ['backend'] }, content: 'Backend only' }),
      makeSkill({ name: 'fe-skill', metadata: { roles: ['frontend'] }, content: 'Frontend only' }),
    ]);

    const prompt = registry.formatForPrompt('backend');
    expect(prompt).toContain('be-skill');
    expect(prompt).not.toContain('fe-skill');
  });
});
