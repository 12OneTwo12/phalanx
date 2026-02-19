import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { getAgentRepository } from '@/lib/db';
import { findProjectRoot } from '@/lib/convention-sync';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SOUL_FILES = ['SOUL.md', 'IDENTITY.md', 'MEMORY.md', 'SKILLS.md'] as const;
type SoulFile = (typeof SOUL_FILES)[number];

function getAgentDir(agentId: string): string {
  const base = process.env.PHALANX_AGENTS_DIR ?? join(process.cwd(), 'agents');
  return join(base, agentId);
}

function getTemplatesDir(): string {
  const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? findProjectRoot(process.cwd());
  return join(projectRoot, 'templates');
}

/** Read a single soul file, returning empty string if not found */
async function readSoulFile(dir: string, file: SoulFile): Promise<string> {
  try {
    return await readFile(join(dir, file), 'utf-8');
  } catch {
    return '';
  }
}

/** GET /api/agents/:id/soul — read all 4 soul files with template fallback */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const dir = getAgentDir(id);

  // Try per-agent files first
  const [soul, identity, memory, skills] = await Promise.all(
    SOUL_FILES.map((f) => readSoulFile(dir, f)),
  );

  // If all empty, fallback to role templates
  if (!soul && !identity && !memory && !skills) {
    const repo = getAgentRepository();
    const agent = repo.findById(id);
    if (agent) {
      const templateDir = join(getTemplatesDir(), agent.role);
      const [tSoul, tIdentity, tMemory, tSkills] = await Promise.all(
        SOUL_FILES.map((f) => readSoulFile(templateDir, f)),
      );
      return jsonResponse({
        soul: tSoul,
        identity: tIdentity,
        memory: tMemory,
        skills: tSkills,
        _source: 'template',
      });
    }
  }

  return jsonResponse({ soul, identity, memory, skills, _source: 'agent' });
}

/** PATCH /api/agents/:id/soul — update one or more soul files */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<Partial<Record<'soul' | 'identity' | 'memory' | 'skills', string>>>(request);
  if (!body) return errorResponse('Invalid JSON body');

  const dir = getAgentDir(id);
  const isNewDir = await mkdir(dir, { recursive: true }).then((created) => !!created).catch(() => false);

  const fileMap: Record<string, SoulFile> = {
    soul: 'SOUL.md',
    identity: 'IDENTITY.md',
    memory: 'MEMORY.md',
    skills: 'SKILLS.md',
  };

  const writes: Promise<void>[] = [];

  // On first save, seed missing files from role templates
  if (isNewDir) {
    const repo = getAgentRepository();
    const agent = repo.findById(id);
    if (agent) {
      const templateDir = join(getTemplatesDir(), agent.role);
      for (const [key, filename] of Object.entries(fileMap)) {
        if (!(key in body)) {
          const templateContent = await readSoulFile(templateDir, filename);
          if (templateContent) {
            writes.push(writeFile(join(dir, filename), templateContent, 'utf-8'));
          }
        }
      }
    }
  }

  // Write explicitly provided files
  for (const [key, filename] of Object.entries(fileMap)) {
    if (key in body && body[key as keyof typeof body] !== undefined) {
      writes.push(writeFile(join(dir, filename), body[key as keyof typeof body]!, 'utf-8'));
    }
  }
  await Promise.all(writes);

  return jsonResponse({ success: true });
}
