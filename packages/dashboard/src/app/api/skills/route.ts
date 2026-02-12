import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SkillLoader, SkillRegistry } from '@phalanx/core';
import type { AgentRole } from '@phalanx/core';
import { findProjectRoot } from '@/lib/convention-sync';

function getProjectRoot(): string {
  return process.env.PHALANX_PROJECT_ROOT ?? findProjectRoot(process.cwd());
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
    const skills = role ? registry.getForRole(role as AgentRole) : registry.list();

    const summary = skills.map((s) => ({
      name: s.name,
      description: s.description,
      source: s.source,
      roles: s.metadata?.roles ?? [],
      emoji: s.metadata?.emoji,
      baseDir: s.baseDir,
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
    const { name, description, content, metadata } = body;

    if (!name || !content) {
      return NextResponse.json({ error: 'name and content are required' }, { status: 400 });
    }

    const projectRoot = getProjectRoot();
    const skillDir = path.join(projectRoot, 'skills', name);

    if (fs.existsSync(skillDir)) {
      return NextResponse.json({ error: `Skill already exists: ${name}` }, { status: 409 });
    }

    fs.mkdirSync(skillDir, { recursive: true });

    // Build SKILL.md
    const lines = ['---', `name: ${name}`, `description: ${description ?? ''}`];
    if (metadata && Object.keys(metadata).length > 0) {
      lines.push(`metadata: ${JSON.stringify({ phalanx: metadata })}`);
    }
    lines.push('---', '', content, '');

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), lines.join('\n'));

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
