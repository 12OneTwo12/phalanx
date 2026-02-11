import { NextRequest } from 'next/server';
import { getHeartbeatLogRepository } from '@/lib/db';
import { jsonResponse } from '@/lib/api-utils';

/** GET /api/heartbeat — list heartbeat reports */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') as 'pending' | 'acknowledged' | 'acted' | null;
  const repo = getHeartbeatLogRepository();

  const logs = status ? repo.findByStatus(status) : repo.findAll({ limit: 50 });
  return jsonResponse(logs);
}
