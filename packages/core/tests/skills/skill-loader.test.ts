import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SkillLoader } from '../../src/skills/skill-loader.js';

describe('SkillLoader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phalanx-skill-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createSkill(dir: string, name: string, content: string): void {
    const skillDir = path.join(dir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
  }

  it('loads skills from a directory', () => {
    const skillsDir = path.join(tmpDir, 'skills');
    createSkill(skillsDir, 'my-skill', `---
name: my-skill
description: A test skill
roles:
  - backend
  - qa
---

Use this tool to do things.
`);

    const loader = new SkillLoader({ projectRoot: tmpDir });
    const skills = loader.loadAll();

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('my-skill');
    expect(skills[0].description).toBe('A test skill');
    expect(skills[0].content).toBe('Use this tool to do things.');
    expect(skills[0].metadata?.roles).toEqual(['backend', 'qa']);
    expect(skills[0].source).toBe('workspace');
  });

  it('uses directory name as fallback skill name', () => {
    const skillsDir = path.join(tmpDir, 'skills');
    createSkill(skillsDir, 'cool-tool', 'No frontmatter here, just instructions.');

    const loader = new SkillLoader({ projectRoot: tmpDir });
    const skills = loader.loadAll();

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('cool-tool');
    expect(skills[0].content).toBe('No frontmatter here, just instructions.');
  });

  it('higher priority source overrides lower', () => {
    const bundledDir = path.join(tmpDir, 'bundled');
    const workspaceDir = path.join(tmpDir, 'workspace');

    createSkill(path.join(bundledDir), 'git-tool', `---
name: git-tool
description: bundled version
---
Bundled instructions.
`);

    createSkill(path.join(workspaceDir, 'skills'), 'git-tool', `---
name: git-tool
description: workspace version
---
Custom instructions.
`);

    const loader = new SkillLoader({
      projectRoot: workspaceDir,
      bundledDir,
    });
    const skills = loader.loadAll();

    expect(skills).toHaveLength(1);
    expect(skills[0].description).toBe('workspace version');
    expect(skills[0].content).toBe('Custom instructions.');
    expect(skills[0].source).toBe('workspace');
  });

  it('returns empty array for non-existent directory', () => {
    const loader = new SkillLoader({ projectRoot: '/nonexistent/path' });
    const skills = loader.loadAll();
    expect(skills).toEqual([]);
  });

  it('parses requires metadata', () => {
    const skillsDir = path.join(tmpDir, 'skills');
    createSkill(skillsDir, 'docker-skill', `---
name: docker-skill
description: Docker operations
requires:
  bins:
    - docker
    - docker-compose
  config:
    - DOCKER_HOST
---

Run docker commands.
`);

    const loader = new SkillLoader({ projectRoot: tmpDir });
    const skills = loader.loadAll();

    expect(skills[0].metadata?.bins).toEqual(['docker', 'docker-compose']);
    expect(skills[0].metadata?.config).toEqual(['DOCKER_HOST']);
  });

  it('loads from extra directories', () => {
    const extraDir = path.join(tmpDir, 'extra-skills');
    createSkill(extraDir, 'extra-skill', `---
name: extra-skill
description: From extra dir
---
Extra instructions.
`);

    const loader = new SkillLoader({ extraDirs: [extraDir] });
    const skills = loader.loadAll();

    expect(skills.some((s) => s.name === 'extra-skill')).toBe(true);
  });
});
