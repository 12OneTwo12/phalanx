import { getMeetingRepository, getMeetingParticipantRepository } from '@/lib/db';
import { getMeetingOrchestrator } from '@/lib/daemon';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getMeetingRepository();
  const meeting = repo.findById(id);
  if (!meeting) return errorResponse('Meeting not found', 404);

  const participantRepo = getMeetingParticipantRepository();
  const participants = participantRepo.findByMeetingId(id);
  return jsonResponse({ ...meeting, participants });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody<{ status?: 'scheduled' | 'active' | 'completed'; minutes?: string; summary?: string }>(req);
  if (!body) return errorResponse('Request body is required');

  const orchestrator = getMeetingOrchestrator();

  try {
    if (body.status === 'active') {
      const updated = orchestrator.startMeeting(id);
      return jsonResponse(updated);
    }
    if (body.status === 'completed' && body.minutes && body.summary) {
      const updated = orchestrator.completeMeeting(id, body.minutes, body.summary);
      return jsonResponse(updated);
    }
    // Fallback to direct repo update for partial updates
    const repo = getMeetingRepository();
    const updated = repo.update(id, body);
    if (!updated) return errorResponse('Meeting not found', 404);
    return jsonResponse(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(msg, 400);
  }
}
