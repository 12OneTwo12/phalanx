import { getMeetingParticipantRepository } from '@/lib/db';
import { getMeetingOrchestrator } from '@/lib/daemon';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getMeetingParticipantRepository();
  const participants = repo.findByMeetingId(id);
  return jsonResponse(participants);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody<{
    agentId: string;
    role: string;
    contributions?: string;
  }>(req);
  if (!body?.agentId || !body?.role) {
    return errorResponse('agentId and role are required');
  }
  const orchestrator = getMeetingOrchestrator();
  try {
    const participant = orchestrator.addContribution(id, body.agentId, body.role, body.contributions ?? '');
    return jsonResponse(participant, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(msg, 400);
  }
}
