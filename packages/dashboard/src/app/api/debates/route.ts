import type { Debate } from '@phalanx/core';
import { getDebateRepository } from '@/lib/db';
import { getDebateOrchestrator } from '@/lib/daemon';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

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
  const orchestrator = getDebateOrchestrator();
  const debate = orchestrator.startDebate(body.topic, body.roleGroup, body.initiatorId);
  return jsonResponse(debate, 201);
}
