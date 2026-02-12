import { jsonResponse, errorResponse, newId, parseBody } from '@/lib/api-utils';
import {
  getActivityLogRepository,
  getChannelMessageRepository,
} from '@/lib/db';
import { getLLMProvider } from '@/lib/llm-provider';
import { eventBus } from '@/lib/event-bus';
import { createTeamLeadAgent, type ChatMessage } from '@/lib/team-lead-agent';
import type { ChannelMessage } from '@phalanx/core';

export type { ChannelMessage };

/** GET /api/channel — get all channel messages */
export async function GET(request: Request) {
  try {
    const repo = getChannelMessageRepository();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? 100);
    const offset = Number(searchParams.get('offset') ?? 0);
    const messages = repo.findAll({ limit, offset });
    return jsonResponse(messages);
  } catch (err) {
    console.error('[channel GET]', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal server error', 500);
  }
}

/** POST /api/channel — send a message and get Team Lead agent response */
export async function POST(request: Request) {
  try {
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

    // If the message is from user, generate Team Lead agent response
    if (userMessage.role === 'user') {
      const teamLeadReply = await generateTeamLeadResponse(repo);
      if (teamLeadReply) {
        return jsonResponse({ userMessage, teamLeadMessage: teamLeadReply }, 201);
      }
    }

    return jsonResponse({ userMessage }, 201);
  } catch (err) {
    console.error('[channel POST]', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// Team Lead agent response generation
// ---------------------------------------------------------------------------

async function generateTeamLeadResponse(
  repo: ReturnType<typeof getChannelMessageRepository>,
) {
  const llm = getLLMProvider();
  if (!llm) {
    const notice = repo.create({
      id: newId(),
      role: 'team-lead',
      content: 'LLM provider is not configured. Run `phalanx init` to set up a provider, or set an API key environment variable (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.).',
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

    // Run the agentic Team Lead (with tool use)
    const agent = createTeamLeadAgent(llm.provider, llm.model);
    const result = await agent.run(chatHistory);

    // Save Team Lead response
    const teamLeadMessage = repo.create({
      id: newId(),
      role: 'team-lead',
      content: result.finalContent,
      metadata: JSON.stringify({
        status: result.status,
        iterations: result.iterations,
        toolCallCount: result.toolCallCount,
        usage: result.totalUsage,
      }),
    });

    // Log and broadcast
    logActivity('channel:agent-response', {
      messageId: teamLeadMessage.id,
      status: result.status,
      iterations: result.iterations,
      toolCallCount: result.toolCallCount,
      preview: teamLeadMessage.content.slice(0, 100),
    });
    eventBus.emit('channel:message', {
      messageId: teamLeadMessage.id,
      role: teamLeadMessage.role,
    });

    return teamLeadMessage;
  } catch (error) {
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
