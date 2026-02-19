import { getExecutionTraceRepository } from '@/lib/db';
import { jsonResponse } from '@/lib/api-utils';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await params;
  const repo = getExecutionTraceRepository();
  const traces = repo.findByTicketId(ticketId);

  const enriched = traces.map((trace) => {
    const toolCalls: { name: string; input: string }[] = [];
    try {
      const history = JSON.parse(trace.conversationHistory);
      for (const msg of history) {
        if (!Array.isArray(msg.content)) continue;
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            toolCalls.push({
              name: block.name,
              input: JSON.stringify(block.input).slice(0, 200),
            });
          }
        }
      }
    } catch {
      /* parse error */
    }
    return { ...trace, toolCalls };
  });

  return jsonResponse(enriched);
}
