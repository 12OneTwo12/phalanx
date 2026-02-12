import { NextRequest } from 'next/server';
import { getGoalRepository, getEpicRepository, getTicketRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import type { NewGoal } from '@phalanx/core';

/** GET /api/goals — list all goals */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') as NewGoal['status'] | null;
  const repo = getGoalRepository();

  const goals = status ? repo.findByStatus(status) : repo.findAll();

  // Attach epic counts and calculate live progress
  const epicRepo = getEpicRepository();
  const ticketRepo = getTicketRepository();
  const enriched = goals.map((goal) => {
    const epics = epicRepo.findByGoalId(goal.id);
    let totalTickets = 0;
    let doneTickets = 0;
    for (const epic of epics) {
      const tickets = ticketRepo.findByEpicId(epic.id);
      totalTickets += tickets.length;
      doneTickets += tickets.filter((t) => t.status === 'done').length;
    }
    const progress = totalTickets === 0 ? 0 : Math.round((doneTickets / totalTickets) * 100);
    return {
      ...goal,
      progress,
      epicCount: epics.length,
    };
  });

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
