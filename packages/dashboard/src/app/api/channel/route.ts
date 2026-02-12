import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import { getActivityLogRepository, getChannelMessageRepository } from '@/lib/db';
import { eventBus } from '@/lib/event-bus';

/** GET /api/channel — get all channel messages */
export async function GET(request: Request) {
  const repo = getChannelMessageRepository();
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? 100);
  const offset = Number(searchParams.get('offset') ?? 0);
  const messages = repo.findAll({ limit, offset });
  return jsonResponse(messages);
}

/** POST /api/channel — send a message to the channel */
export async function POST(request: Request) {
  const body = await parseBody<{ content: string; role?: 'user' | 'team-lead' }>(request);
  if (!body?.content?.trim()) {
    return errorResponse('content is required');
  }

  const repo = getChannelMessageRepository();
  const message = repo.create({
    id: newId(),
    role: body.role ?? 'user',
    content: body.content.trim(),
  });

  // Log the message as an activity
  try {
    const activityRepo = getActivityLogRepository();
    activityRepo.create({
      id: newId(),
      action: `channel:message from ${message.role}`,
      details: JSON.stringify({ messageId: message.id, preview: message.content.slice(0, 100) }),
      level: 'info',
    });
  } catch {
    // Activity logging is best-effort
  }

  // Broadcast via SSE
  eventBus.emit('channel:message', { messageId: message.id, role: message.role });

  return jsonResponse(message, 201);
}
