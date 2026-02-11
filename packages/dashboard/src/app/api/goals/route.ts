import { NextRequest } from 'next/server';
import { getGoalRepository, getEpicRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import type { NewGoal } from '@phalanx/core';

/** GET /api/goals — list all goals */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') as NewGoal['status'] | null;
  const repo = getGoalRepository();

  const goals = status ? repo.findByStatus(status) : repo.findAll();

  // Attach epic counts
  const epicRepo = getEpicRepository();
  const enriched = goals.map((goal) => ({
    ...goal,
    epicCount: epicRepo.findByGoalId(goal.id).length,
  }));

  return jsonResponse(enriched);
}

/** POST /api/goals — create a new goal */
export async function POST(request: Request) {
  const body = await parseBody<{ description: string; metadata?: string }>(request);
  if (!body?.description) {
    return errorResponse('description is required');
  }

  const repo = getGoalRepository();
  const goal = repo.create({
    id: newId(),
    description: body.description,
    metadata: body.metadata ?? null,
  });

  return jsonResponse(goal, 201);
}
