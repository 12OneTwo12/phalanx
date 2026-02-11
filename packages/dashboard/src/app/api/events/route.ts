import { eventBus, type BusEvent } from '@/lib/event-bus';

/**
 * GET /api/events — Server-Sent Events endpoint.
 * Streams real-time events from the engine event bus to connected clients.
 */
export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectMsg = `data: ${JSON.stringify({ type: 'connected', payload: {}, timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(connectMsg));

      // Subscribe to the event bus
      const unsubscribe = eventBus.subscribe((event: BusEvent) => {
        try {
          const msg = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        } catch {
          // Stream may be closed; ignore
        }
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30_000);

      // Cleanup when the client disconnects
      // Note: ReadableStream cancel is called when the client disconnects
      const originalCancel = stream.cancel?.bind(stream);
      stream.cancel = async (reason) => {
        unsubscribe();
        clearInterval(heartbeatInterval);
        if (originalCancel) await originalCancel(reason);
      };
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
