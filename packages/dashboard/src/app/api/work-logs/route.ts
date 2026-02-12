import { NextRequest } from 'next/server';
import { getWorkLogRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

const VALID_ACTIONS = ['started', 'progressed', 'completed', 'blocked'] as const;
type WorkLogAction = typeof VALID_ACTIONS[number];

function isValidAction(value: unknown): value is WorkLogAction {
  return typeof value === 'string' && (VALID_ACTIONS as readonly string[]).includes(value);
}

/** GET /api/work-logs — list work logs with optional filters */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get('date');
  const agentId = searchParams.get('agentId');
  const repo = getWorkLogRepository();

  // Use repository methods instead of full table scan + JS filter
  let results;
  if (date && agentId) {
    results = repo.findByDate(date).filter((w) => w.agentId === agentId);
  } else if (date) {
    results = repo.findByDate(date);
  } else if (agentId) {
    results = repo.findByAgentId(agentId);
  } else {
    results = repo.findAll();
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
    action: isValidAction(body.action) ? body.action : 'progressed',
    description: body.description,
    tokensUsed: body.tokensUsed ?? 0,
  });

  return jsonResponse(log, 201);
}
