import { getDebateArgumentRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getDebateArgumentRepository();
  const arguments_ = repo.findByDebateId(id);
  return jsonResponse(arguments_);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody<{
    agentId: string;
    position: string;
    argument: string;
    evidence?: string;
    round?: number;
  }>(req);
  if (!body?.agentId || !body?.position || !body?.argument) {
    return errorResponse('agentId, position, and argument are required');
  }
  const repo = getDebateArgumentRepository();
  const arg = repo.create({
    id: newId(),
    debateId: id,
    agentId: body.agentId,
    position: body.position,
    argument: body.argument,
    evidence: body.evidence ?? null,
    round: body.round ?? 1,
  });
  return jsonResponse(arg, 201);
}
