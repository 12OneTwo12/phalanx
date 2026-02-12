import { NextResponse } from 'next/server';
import { SkillLoader, SkillRegistry } from '@phalanx/core';

function getProjectRoot(): string {
  return process.env.PHALANX_PROJECT_ROOT ?? process.cwd();
}

function loadRegistry(): SkillRegistry {
  const loader = new SkillLoader({ projectRoot: getProjectRoot() });
  return new SkillRegistry(loader.loadAll());
}

/** GET /api/skills — list all skills */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const registry = loadRegistry();
    const skills = role
      ? registry.getForRole(role as import('@phalanx/core').AgentRole)
      : registry.list();

    const summary = skills.map((s) => ({
      name: s.name,
      description: s.description,
      source: s.source,
      roles: s.metadata?.roles ?? [],
      path: s.path,
    }));

    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** POST /api/skills — create a new skill */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, content, roles } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: 'name and content are required' },
        { status: 400 },
      );
    }

    const fs = await import('node:fs');
    const path = await import('node:path');
    const projectRoot = getProjectRoot();
    const skillDir = path.join(projectRoot, 'skills', name);

    if (fs.existsSync(skillDir)) {
      return NextResponse.json(
        { error: `Skill already exists: ${name}` },
        { status: 409 },
      );
    }

    fs.mkdirSync(skillDir, { recursive: true });

    const frontmatter = ['---', `name: ${name}`, `description: ${description ?? ''}`];
    if (roles && roles.length > 0) {
      frontmatter.push('roles:');
      for (const role of roles) {
        frontmatter.push(`  - ${role}`);
      }
    }
    frontmatter.push('---', '');

    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      frontmatter.join('\n') + '\n' + content + '\n',
    );

    const registry = loadRegistry();
    const skill = registry.get(name);

    return NextResponse.json(skill, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
