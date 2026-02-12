import { getDebateRepository, getDebateArgumentRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getDebateRepository();
  const debate = repo.findById(id);
  if (!debate) return errorResponse('Debate not found', 404);

  const argRepo = getDebateArgumentRepository();
  const arguments_ = argRepo.findByDebateId(id);
  return jsonResponse({ ...debate, arguments: arguments_ });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody<{ status?: 'pending' | 'active' | 'concluded'; conclusion?: string }>(req);
  if (!body) return errorResponse('Request body is required');

  const repo = getDebateRepository();
  const updated = repo.update(id, body);
  if (!updated) return errorResponse('Debate not found', 404);
  return jsonResponse(updated);
}
