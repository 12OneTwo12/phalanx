import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import {
  getActivityLogRepository,
  getChannelMessageRepository,
  getGoalRepository,
  getAgentRepository,
  getTicketRepository,
} from '@/lib/db';
import { eventBus } from '@/lib/event-bus';
import {
  AnthropicProvider,
  TeamLeadChatService,
  type ChatMessage,
  type ProjectContext,
} from '@phalanx/core';
import type { ChannelMessage } from '@phalanx/core';

export type { ChannelMessage };

/** GET /api/channel — get all channel messages */
export async function GET(request: Request) {
  const repo = getChannelMessageRepository();
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? 100);
  const offset = Number(searchParams.get('offset') ?? 0);
  const messages = repo.findAll({ limit, offset });
  return jsonResponse(messages);
}

/** POST /api/channel — send a message and get Team Lead LLM response */
export async function POST(request: Request) {
  const body = await parseBody<{ content: string; role?: 'user' | 'team-lead' }>(request);
  if (!body?.content?.trim()) {
    return errorResponse('content is required');
  }

  const repo = getChannelMessageRepository();

  // Save user message
  const userMessage = repo.create({
    id: newId(),
    role: body.role ?? 'user',
    content: body.content.trim(),
  });

  // Log user message as activity
  logActivity(`channel:message from ${userMessage.role}`, {
    messageId: userMessage.id,
    preview: userMessage.content.slice(0, 100),
  });

  // Broadcast user message via SSE
  eventBus.emit('channel:message', { messageId: userMessage.id, role: userMessage.role });

  // If the message is from user, generate Team Lead LLM response
  if (userMessage.role === 'user') {
    const teamLeadReply = await generateTeamLeadResponse(repo);
    if (teamLeadReply) {
      return jsonResponse({ userMessage, teamLeadMessage: teamLeadReply }, 201);
    }
  }

  return jsonResponse({ userMessage }, 201);
}

// ---------------------------------------------------------------------------
// Team Lead LLM response generation
// ---------------------------------------------------------------------------

async function generateTeamLeadResponse(
  repo: ReturnType<typeof getChannelMessageRepository>,
) {
  const provider = new AnthropicProvider();
  const isAvailable = await provider.isAvailable();
  if (!isAvailable) {
    // No API key configured — save a system message and return
    const notice = repo.create({
      id: newId(),
      role: 'team-lead',
      content: 'LLM provider is not configured. Set the ANTHROPIC_API_KEY environment variable to enable Team Lead responses.',
    });
    eventBus.emit('channel:message', { messageId: notice.id, role: notice.role });
    return notice;
  }

  try {
    // Load channel history for context
    const history = repo.findAll({ limit: 50, offset: 0 });
    const chatHistory: ChatMessage[] = history.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'team-lead' as const,
      content: m.content,
    }));

    // Load project context
    const context = buildProjectContext();

    // Generate response
    const service = new TeamLeadChatService(provider);
    const responseText = await service.respond(chatHistory, context);

    // Save Team Lead response
    const teamLeadMessage = repo.create({
      id: newId(),
      role: 'team-lead',
      content: responseText,
    });

    // Log and broadcast
    logActivity('channel:message from team-lead', {
      messageId: teamLeadMessage.id,
      preview: teamLeadMessage.content.slice(0, 100),
    });
    eventBus.emit('channel:message', {
      messageId: teamLeadMessage.id,
      role: teamLeadMessage.role,
    });

    return teamLeadMessage;
  } catch (error) {
    // On LLM failure, save an error message so the user knows
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const notice = repo.create({
      id: newId(),
      role: 'team-lead',
      content: `Failed to generate response: ${errorMsg}`,
    });
    eventBus.emit('channel:message', { messageId: notice.id, role: notice.role });
    return notice;
  }
}

function buildProjectContext(): ProjectContext {
  try {
    const goals = getGoalRepository().findAll({ limit: 10, offset: 0 });
    const agents = getAgentRepository().findAll({ limit: 20, offset: 0 });
    const tickets = getTicketRepository().findAll({ limit: 100, offset: 0 });
    const activeTicketCount = tickets.filter(
      t => t.status !== 'done',
    ).length;

    return {
      goals: goals.map(g => ({
        description: g.description,
        status: g.status,
      })),
      agents: agents.map(a => ({
        name: a.name,
        role: a.role,
        status: a.status,
      })),
      activeTicketCount,
    };
  } catch {
    return {};
  }
}

function logActivity(action: string, details: Record<string, unknown>) {
  try {
    getActivityLogRepository().create({
      id: newId(),
      action,
      details: JSON.stringify(details),
      level: 'info',
    });
  } catch {
    // Activity logging is best-effort
  }
}
