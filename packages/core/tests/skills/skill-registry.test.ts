import { describe, it, expect } from 'vitest';
import { SkillRegistry } from '../../src/skills/skill-registry.js';
import type { SkillEntry } from '../../src/skills/types.js';

function makeSkill(overrides: Partial<SkillEntry> = {}): SkillEntry {
  return {
    name: 'test-skill',
    description: 'A test skill',
    content: 'Do the thing.',
    filePath: '/tmp/skills/test-skill/SKILL.md',
    baseDir: '/tmp/skills/test-skill',
    metadata: {},
    source: 'workspace',
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

  it('snapshot returns lazy-loading prompt and skills list (OpenClaw pattern)', () => {
    const registry = new SkillRegistry([
      makeSkill({
        name: 'git-tool',
        description: 'Git ops',
        content: 'Use git commands.',
        filePath: '/tmp/skills/git-tool/SKILL.md',
      }),
    ]);

    const snap = registry.snapshot();
    // Lazy-loading: prompt contains description and location, NOT full content
    expect(snap.prompt).toContain('<available_skills>');
    expect(snap.prompt).toContain('<name>git-tool</name>');
    expect(snap.prompt).toContain('<description>Git ops</description>');
    expect(snap.prompt).toContain('<location>/tmp/skills/git-tool/SKILL.md</location>');
    expect(snap.prompt).toContain('file_read');
    // Full content should NOT be in the prompt
    expect(snap.prompt).not.toContain('Use git commands.');
    expect(snap.skills).toEqual([{ name: 'git-tool', description: 'Git ops' }]);
  });

  it('snapshot returns empty when no skills', () => {
    const registry = new SkillRegistry();
    const snap = registry.snapshot();
    expect(snap.prompt).toBe('');
    expect(snap.skills).toEqual([]);
  });

  it('snapshot filters by role', () => {
    const registry = new SkillRegistry([
      makeSkill({ name: 'be-skill', metadata: { roles: ['backend'] }, content: 'Backend only' }),
      makeSkill({ name: 'fe-skill', metadata: { roles: ['frontend'] }, content: 'Frontend only' }),
    ]);

    const snap = registry.snapshot('backend');
    expect(snap.prompt).toContain('be-skill');
    expect(snap.prompt).not.toContain('fe-skill');
    expect(snap.skills).toHaveLength(1);
  });

  it('formatForPrompt uses XML skill entries with location', () => {
    const registry = new SkillRegistry([
      makeSkill({
        name: 'weather',
        description: 'Get weather',
        metadata: { emoji: '🌤️' },
        content: 'Fetch weather data.',
        filePath: '/tmp/skills/weather/SKILL.md',
      }),
    ]);

    const prompt = registry.formatForPrompt();
    expect(prompt).toContain('<name>weather</name>');
    expect(prompt).toContain('<description>Get weather</description>');
    expect(prompt).toContain('<location>/tmp/skills/weather/SKILL.md</location>');
    // Full content should NOT be in prompt (lazy loading)
    expect(prompt).not.toContain('Fetch weather data.');
  });
});
