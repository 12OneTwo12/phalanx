import type { Debate } from '@phalanx/core';
import { getDebateRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const roleGroup = url.searchParams.get('roleGroup');
  const repo = getDebateRepository();

  let debates;
  if (status) {
    debates = repo.findByStatus(status as Debate['status']);
  } else if (roleGroup) {
    debates = repo.findByRoleGroup(roleGroup);
  } else {
    debates = repo.findAll();
  }
  return jsonResponse(debates);
}

export async function POST(req: Request) {
  const body = await parseBody<{ topic: string; roleGroup: string; initiatorId?: string }>(req);
  if (!body?.topic || !body?.roleGroup) {
    return errorResponse('topic and roleGroup are required');
  }
  const repo = getDebateRepository();
  const debate = repo.create({
    id: newId(),
    topic: body.topic,
    roleGroup: body.roleGroup,
    status: 'active',
    initiatorId: body.initiatorId ?? null,
  });
  return jsonResponse(debate, 201);
}
