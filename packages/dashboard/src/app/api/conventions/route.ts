import { NextRequest } from 'next/server';
import { getConventionRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import { syncConventionToDisk } from '@/lib/convention-sync';
import type { NewConvention } from '@phalanx/core';

/** GET /api/conventions — list all conventions or filter by type */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') as NewConvention['type'] | null;
  const repo = getConventionRepository();

  if (type) {
    const conv = repo.findByType(type);
    return jsonResponse(conv ? [conv] : []);
  }
  return jsonResponse(repo.findAll());
}

/** POST /api/conventions — create or update a convention */
export async function POST(request: Request) {
  const body = await parseBody<{
    type: string;
    content: string;
    updatedBy?: string;
  }>(request);
  if (!body?.type || !body.content) {
    return errorResponse('type and content are required');
  }

  const repo = getConventionRepository();
  const existing = repo.findByType(body.type as NewConvention['type']);

  if (existing) {
    // Update existing with incremented version.
    // NOTE: This is not safe against concurrent updates (version race).
    // For true optimistic locking, the client should send the expected version
    // and the server should reject if it doesn't match (HTTP 409 Conflict).
    // Acceptable for single-user dashboard MVP.
    const updated = repo.update(existing.id, {
      content: body.content,
      version: existing.version + 1,
      updatedBy: (body.updatedBy as NewConvention['updatedBy']) ?? 'user',
    });
    // Sync to disk so ConventionLoader picks up the changes
    syncConventionToDisk(body.type, body.content);
    return jsonResponse(updated);
  }

  const convention = repo.create({
    id: newId(),
    type: body.type as NewConvention['type'],
    content: body.content,
    updatedBy: (body.updatedBy as NewConvention['updatedBy']) ?? 'user',
  });
  // Sync to disk so ConventionLoader picks up the changes
  syncConventionToDisk(body.type, body.content);
  return jsonResponse(convention, 201);
}
