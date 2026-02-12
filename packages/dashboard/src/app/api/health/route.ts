import { getGoalRepository } from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

const startTime = Date.now();

/** GET /api/health — system health check */
export async function GET() {
  try {
    // Verify database connectivity by executing a simple query
    getGoalRepository().findAll({ limit: 1 });

    return jsonResponse({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return errorResponse('Database connection failed', 503);
  }
}
