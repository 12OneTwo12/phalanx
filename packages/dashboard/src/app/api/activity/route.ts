import { NextRequest } from 'next/server';
import { getActivityLogRepository } from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

/** GET /api/activity — list activity logs with optional filters (combinable) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const agentId = searchParams.get('agentId');
    const ticketId = searchParams.get('ticketId');
    const limit = parseInt(searchParams.get('limit') ?? '100', 10);
    const repo = getActivityLogRepository();

    // Support combined filters by intersecting results in-memory
    let results = repo.findAll({ limit: 1000 });

    if (agentId) {
      results = results.filter((log) => log.agentId === agentId);
    }
    if (ticketId) {
      results = results.filter((log) => log.ticketId === ticketId);
    }

    return jsonResponse(results.slice(0, limit));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[phalanx] Activity log error:', msg);
    return errorResponse(msg, 500);
  }
}
