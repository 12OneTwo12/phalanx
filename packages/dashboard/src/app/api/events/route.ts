import { eventBus, type BusEvent } from '@/lib/event-bus';

/** Prevent Next.js from caching this streaming route */
export const dynamic = 'force-dynamic';

/**
 * GET /api/events — Server-Sent Events endpoint.
 * Streams real-time events from the engine event bus to connected clients.
 */
export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | undefined;
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectMsg = `data: ${JSON.stringify({ type: 'connected', payload: {}, timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(connectMsg));

      // Subscribe to the event bus
      unsubscribe = eventBus.subscribe((event: BusEvent) => {
        try {
          const msg = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        } catch {
          // Stream may be closed; ignore
        }
      });

      // Heartbeat every 30s to keep connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30_000);
    },
    cancel() {
      // Cleanup when the client disconnects
      unsubscribe?.();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
