import { getTicketCommentRepository, getTicketRepository } from '@/lib/db';
import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';

const VALID_COMMENT_TYPES = ['plan', 'progress', 'completion', 'review', 'comment'] as const;
type CommentType = typeof VALID_COMMENT_TYPES[number];

function isValidCommentType(value: unknown): value is CommentType {
  return typeof value === 'string' && (VALID_COMMENT_TYPES as readonly string[]).includes(value);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/tickets/:id/comments — list comments for a ticket */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const ticketRepo = getTicketRepository();
  if (!ticketRepo.findById(id)) {
    return errorResponse('Ticket not found', 404);
  }

  const commentRepo = getTicketCommentRepository();
  const comments = commentRepo.findByTicketId(id);
  return jsonResponse(comments);
}

/** POST /api/tickets/:id/comments — add a comment to a ticket */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const ticketRepo = getTicketRepository();
  if (!ticketRepo.findById(id)) {
    return errorResponse('Ticket not found', 404);
  }

  const body = await parseBody<{
    author: string;
    type?: string;
    content: string;
    metadata?: string;
  }>(request);

  if (!body?.author || !body.content) {
    return errorResponse('author and content are required');
  }

  const commentRepo = getTicketCommentRepository();
  const comment = commentRepo.create({
    id: newId(),
    ticketId: id,
    author: body.author,
    type: isValidCommentType(body.type) ? body.type : 'comment',
    content: body.content,
    metadata: body.metadata ?? null,
  });

  return jsonResponse(comment, 201);
}
