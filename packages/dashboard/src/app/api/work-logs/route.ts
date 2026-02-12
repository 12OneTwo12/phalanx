import { NextRequest } from 'next/server';
import { getWorkLogRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

/** GET /api/work-logs — list work logs with optional filters */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get('date');
  const agentId = searchParams.get('agentId');
  const repo = getWorkLogRepository();

  let results = repo.findAll();

  if (date) {
    results = results.filter((w) => w.date === date);
  }
  if (agentId) {
    results = results.filter((w) => w.agentId === agentId);
  }

  return jsonResponse(results);
}

/** POST /api/work-logs — create a work log entry */
export async function POST(request: Request) {
  const body = await parseBody<{
    date: string;
    agentId?: string;
    ticketId?: string;
    action: string;
    description: string;
    tokensUsed?: number;
  }>(request);

  if (!body?.date || !body.action || !body.description) {
    return errorResponse('date, action, and description are required');
  }

  const repo = getWorkLogRepository();
  const log = repo.create({
    id: newId(),
    date: body.date,
    agentId: body.agentId ?? null,
    ticketId: body.ticketId ?? null,
    action: body.action as 'started' | 'progressed' | 'completed' | 'blocked',
    description: body.description,
    tokensUsed: body.tokensUsed ?? 0,
  });

  return jsonResponse(log, 201);
}
