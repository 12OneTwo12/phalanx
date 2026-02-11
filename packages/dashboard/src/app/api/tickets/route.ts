import { NextRequest } from 'next/server';
import { getTicketRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import type { NewTicket } from '@phalanx/core';

/** GET /api/tickets — list tickets with optional filters */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') as NewTicket['status'] | null;
    const epicId = searchParams.get('epicId');
    const repo = getTicketRepository();

    // Support combined filters by intersecting results in-memory
    let results = repo.findAll();

    if (status) {
      results = results.filter((t) => t.status === status);
    }
    if (epicId) {
      results = results.filter((t) => t.epicId === epicId);
    }

    return jsonResponse(results);
  } catch {
    return errorResponse('Failed to fetch tickets', 500);
  }
}

/** POST /api/tickets — create a new ticket */
export async function POST(request: Request) {
  const body = await parseBody<{
    epicId: string;
    title: string;
    description: string;
    priority?: string;
    dependsOn?: string;
  }>(request);
  if (!body?.epicId || !body.title || !body.description) {
    return errorResponse('epicId, title, and description are required');
  }

  const repo = getTicketRepository();
  const ticket = repo.create({
    id: newId(),
    epicId: body.epicId,
    title: body.title,
    description: body.description,
    priority: (body.priority as NewTicket['priority']) ?? 'medium',
    dependsOn: body.dependsOn ?? null,
  });

  return jsonResponse(ticket, 201);
}
