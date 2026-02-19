import type { Meeting } from '@phalanx/core';
import { getMeetingRepository } from '@/lib/db';
import { getMeetingOrchestrator } from '@/lib/daemon';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const repo = getMeetingRepository();

  let meetings;
  if (status) {
    meetings = repo.findByStatus(status as Meeting['status']);
  } else if (type) {
    meetings = repo.findByType(type as Meeting['type']);
  } else {
    meetings = repo.findAll();
  }
  return jsonResponse(meetings);
}

export async function POST(req: Request) {
  const body = await parseBody<{
    title: string;
    type: 'standup' | 'review' | 'planning' | 'retrospective';
    facilitatorId?: string;
    agenda?: string;
  }>(req);
  if (!body?.title || !body?.type) {
    return errorResponse('title and type are required');
  }
  const orchestrator = getMeetingOrchestrator();
  const meeting = orchestrator.scheduleMeeting({
    title: body.title,
    type: body.type,
    facilitatorId: body.facilitatorId,
    agenda: body.agenda,
  });
  return jsonResponse(meeting, 201);
}
