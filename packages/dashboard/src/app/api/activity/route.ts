import { NextRequest } from 'next/server';
import { getActivityLogRepository } from '@/lib/db';
import { jsonResponse } from '@/lib/api-utils';

/** GET /api/activity — list activity logs with optional filters */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get('agentId');
  const ticketId = searchParams.get('ticketId');
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);
  const repo = getActivityLogRepository();

  if (agentId) return jsonResponse(repo.findByAgentId(agentId));
  if (ticketId) return jsonResponse(repo.findByTicketId(ticketId));
  return jsonResponse(repo.findAll({ limit }));
}
