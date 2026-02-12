import { NextRequest } from 'next/server';
import { getDecisionRecordRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

/** GET /api/decision-records — list decision records */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ticketId = searchParams.get('ticketId');
  const repo = getDecisionRecordRepository();

  if (ticketId) {
    return jsonResponse(repo.findByTicketId(ticketId));
  }

  return jsonResponse(repo.findAll());
}

/** POST /api/decision-records — create a decision record */
export async function POST(request: Request) {
  const body = await parseBody<{
    title: string;
    what: string;
    why: string;
    alternatives?: string;
    evidence?: string;
    madeBy: string;
    relatedTicketId?: string;
  }>(request);

  if (!body?.title || !body.what || !body.why || !body.madeBy) {
    return errorResponse('title, what, why, and madeBy are required');
  }

  const repo = getDecisionRecordRepository();
  const record = repo.create({
    id: newId(),
    title: body.title,
    what: body.what,
    why: body.why,
    alternatives: body.alternatives ?? null,
    evidence: body.evidence ?? null,
    madeBy: body.madeBy,
    relatedTicketId: body.relatedTicketId ?? null,
  });

  return jsonResponse(record, 201);
}
