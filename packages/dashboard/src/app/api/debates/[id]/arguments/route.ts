import { getDebateArgumentRepository } from '@/lib/db';
import { getDebateOrchestrator } from '@/lib/daemon';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

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
  }>(req);
  if (!body?.agentId || !body?.position || !body?.argument) {
    return errorResponse('agentId, position, and argument are required');
  }
  const orchestrator = getDebateOrchestrator();
  try {
    const arg = orchestrator.submitArgument(id, body.agentId, body.position, body.argument, body.evidence);
    return jsonResponse(arg, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(msg, 400);
  }
}
