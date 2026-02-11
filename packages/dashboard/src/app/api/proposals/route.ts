import { NextRequest } from 'next/server';
import { getProposalRepository } from '@/lib/db';
import { jsonResponse } from '@/lib/api-utils';

/** GET /api/proposals — list proposals */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
  const repo = getProposalRepository();

  const proposals = status ? repo.findByStatus(status) : repo.findAll({ limit: 50 });
  return jsonResponse(proposals);
}
