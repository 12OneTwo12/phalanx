import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
    const desc = body.description ?? existing.description;
    const content = body.content ?? existing.content;
    const metadata = body.metadata ?? existing.metadata;

    const lines = ['---', `name: ${name}`, `description: ${desc}`];
    if (metadata && Object.keys(metadata).length > 0) {
      lines.push(`metadata: ${JSON.stringify({ phalanx: metadata })}`);
    }
    lines.push('---', '', content, '');

    fs.writeFileSync(path.join(existing.baseDir, 'SKILL.md'), lines.join('\n'));

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

    fs.rmSync(existing.baseDir, { recursive: true, force: true });
    return NextResponse.json({ deleted: name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
