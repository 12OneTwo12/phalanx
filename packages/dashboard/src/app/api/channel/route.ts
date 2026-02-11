import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import { getActivityLogRepository } from '@/lib/db';
import { eventBus } from '@/lib/event-bus';

/** In-memory message store for the direct channel (simple approach for MVP) */
const messages: ChannelMessage[] = [];

export interface ChannelMessage {
  id: string;
  role: 'user' | 'team-lead';
  content: string;
  timestamp: string;
}

/** GET /api/channel — get all channel messages */
export async function GET() {
  return jsonResponse(messages);
}

/** POST /api/channel — send a message to the channel */
export async function POST(request: Request) {
  const body = await parseBody<{ content: string; role?: 'user' | 'team-lead' }>(request);
  if (!body?.content?.trim()) {
    return errorResponse('content is required');
  }

  const message: ChannelMessage = {
    id: newId(),
    role: body.role ?? 'user',
    content: body.content.trim(),
    timestamp: new Date().toISOString(),
  };

  messages.push(message);

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
