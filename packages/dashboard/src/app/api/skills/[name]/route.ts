import { NextResponse } from 'next/server';
import { SkillLoader, SkillRegistry } from '@phalanx/core';

function getProjectRoot(): string {
  return process.env.PHALANX_PROJECT_ROOT ?? process.cwd();
}

function loadRegistry(): SkillRegistry {
  const loader = new SkillLoader({ projectRoot: getProjectRoot() });
  return new SkillRegistry(loader.loadAll());
}

/** GET /api/skills/:name */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const skill = loadRegistry().get(name);
    if (!skill) {
      return NextResponse.json({ error: `Skill not found: ${name}` }, { status: 404 });
    }
    return NextResponse.json(skill);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** PUT /api/skills/:name */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const registry = loadRegistry();
    const existing = registry.get(name);

    if (!existing) {
      return NextResponse.json({ error: `Skill not found: ${name}` }, { status: 404 });
    }

    const body = await request.json();
    const fs = await import('node:fs');
    const path = await import('node:path');

    const desc = body.description ?? existing.description;
    const content = body.content ?? existing.content;
    const roles = body.roles ?? existing.metadata?.roles;

    const frontmatter = ['---', `name: ${name}`, `description: ${desc}`];
    if (roles && roles.length > 0) {
      frontmatter.push('roles:');
      for (const role of roles) {
        frontmatter.push(`  - ${role}`);
      }
    }
    frontmatter.push('---', '');

    fs.writeFileSync(
      path.join(existing.path, 'SKILL.md'),
      frontmatter.join('\n') + '\n' + content + '\n',
    );

    const updated = loadRegistry().get(name);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** DELETE /api/skills/:name */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const registry = loadRegistry();
    const existing = registry.get(name);

    if (!existing) {
      return NextResponse.json({ error: `Skill not found: ${name}` }, { status: 404 });
    }

    if (existing.source !== 'workspace') {
      return NextResponse.json(
        { error: `Can only delete workspace skills. Source: ${existing.source}` },
        { status: 403 },
      );
    }

    const fs = await import('node:fs');
    fs.rmSync(existing.path, { recursive: true, force: true });

    return NextResponse.json({ deleted: name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
