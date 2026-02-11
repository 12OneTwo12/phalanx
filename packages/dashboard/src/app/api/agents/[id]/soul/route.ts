import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SOUL_FILES = ['SOUL.md', 'IDENTITY.md', 'MEMORY.md', 'SKILLS.md'] as const;
type SoulFile = (typeof SOUL_FILES)[number];

function getAgentDir(agentId: string): string {
  const base = process.env.PHALANX_AGENTS_DIR ?? join(process.cwd(), 'agents');
  return join(base, agentId);
}

/** Read a single soul file, returning empty string if not found */
async function readSoulFile(agentDir: string, file: SoulFile): Promise<string> {
  try {
    return await readFile(join(agentDir, file), 'utf-8');
  } catch {
    return '';
  }
}

/** GET /api/agents/:id/soul — read all 4 soul files */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const dir = getAgentDir(id);

  const [soul, identity, memory, skills] = await Promise.all(
    SOUL_FILES.map((f) => readSoulFile(dir, f)),
  );

  return jsonResponse({ soul, identity, memory, skills });
}

/** PATCH /api/agents/:id/soul — update one or more soul files */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<Partial<Record<'soul' | 'identity' | 'memory' | 'skills', string>>>(request);
  if (!body) return errorResponse('Invalid JSON body');

  const dir = getAgentDir(id);
  await mkdir(dir, { recursive: true });

  const fileMap: Record<string, SoulFile> = {
    soul: 'SOUL.md',
    identity: 'IDENTITY.md',
    memory: 'MEMORY.md',
    skills: 'SKILLS.md',
  };

  const writes: Promise<void>[] = [];
  for (const [key, filename] of Object.entries(fileMap)) {
    if (key in body && body[key as keyof typeof body] !== undefined) {
      writes.push(writeFile(join(dir, filename), body[key as keyof typeof body]!, 'utf-8'));
    }
  }
  await Promise.all(writes);

  return jsonResponse({ success: true });
}
