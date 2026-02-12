import { NextRequest } from 'next/server';
import { getKnowledgeEntryRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

/** GET /api/knowledge — list knowledge entries with optional category filter */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category');
  const repo = getKnowledgeEntryRepository();

  if (category) {
    return jsonResponse(
      repo.findByCategory(category as 'architecture' | 'pattern' | 'failure' | 'research' | 'context'),
    );
  }

  return jsonResponse(repo.findAll());
}

/** POST /api/knowledge — create a knowledge entry */
export async function POST(request: Request) {
  const body = await parseBody<{
    category: string;
    title: string;
    content: string;
    learnedFrom?: string;
    createdBy: string;
  }>(request);

  if (!body?.category || !body.title || !body.content || !body.createdBy) {
    return errorResponse('category, title, content, and createdBy are required');
  }

  const repo = getKnowledgeEntryRepository();
  const entry = repo.create({
    id: newId(),
    category: body.category as 'architecture' | 'pattern' | 'failure' | 'research' | 'context',
    title: body.title,
    content: body.content,
    learnedFrom: body.learnedFrom ?? null,
    createdBy: body.createdBy,
  });

  return jsonResponse(entry, 201);
}
