import { getMeetingRepository, getMeetingParticipantRepository } from '@/lib/db';
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

  const repo = getMeetingRepository();
  const updated = repo.update(id, body);
  if (!updated) return errorResponse('Meeting not found', 404);
  return jsonResponse(updated);
}
