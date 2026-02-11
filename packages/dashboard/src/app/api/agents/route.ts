import { NextRequest } from 'next/server';
import { getAgentRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import type { NewAgent } from '@phalanx/core';

/** GET /api/agents — list all agents with optional role/status filter */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const role = searchParams.get('role') as NewAgent['role'] | null;
  const status = searchParams.get('status') as NewAgent['status'] | null;
  const repo = getAgentRepository();

  if (role) return jsonResponse(repo.findByRole(role));
  if (status) return jsonResponse(repo.findByStatus(status));
  return jsonResponse(repo.findAll());
}

/** POST /api/agents — register a new agent */
export async function POST(request: Request) {
  const body = await parseBody<{
    role: string;
    name: string;
    provider?: string;
    model?: string;
  }>(request);
  if (!body?.role || !body.name) {
    return errorResponse('role and name are required');
  }

  const repo = getAgentRepository();
  const agent = repo.create({
    id: newId(),
    role: body.role as NewAgent['role'],
    name: body.name,
    provider: body.provider ?? null,
    model: body.model ?? null,
  });

  return jsonResponse(agent, 201);
}
