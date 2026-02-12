import { getMeetingParticipantRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

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
  const repo = getMeetingParticipantRepository();
  const participant = repo.create({
    id: newId(),
    meetingId: id,
    agentId: body.agentId,
    role: body.role,
    contributions: body.contributions ?? null,
  });
  return jsonResponse(participant, 201);
}
