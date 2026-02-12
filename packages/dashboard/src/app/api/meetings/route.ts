import type { Meeting } from '@phalanx/core';
import { getMeetingRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

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
  const repo = getMeetingRepository();
  const meeting = repo.create({
    id: newId(),
    title: body.title,
    type: body.type,
    status: 'scheduled',
    facilitatorId: body.facilitatorId ?? null,
    agenda: body.agenda ?? null,
  });
  return jsonResponse(meeting, 201);
}
