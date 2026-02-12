/**
 * Heartbeat SSE bridge — connects the HeartbeatService to the EventBus
 * so heartbeat reports are delivered to SSE-connected dashboard clients.
 */
import type { HeartbeatService, HeartbeatReport } from '@phalanx/core';
import { eventBus } from './event-bus';

/**
 * Wire a HeartbeatService instance to the dashboard EventBus.
 * Returns a cleanup function that removes all listeners.
 */
export function bridgeHeartbeatToSSE(heartbeatService: HeartbeatService): () => void {
  const onReport = (data: { report: HeartbeatReport }) => {
    eventBus.emit('heartbeat:report', {
      report: data.report,
    });
  };

  const onError = (data: { error: unknown }) => {
    eventBus.emit('heartbeat:error', {
      message: data.error instanceof Error ? data.error.message : String(data.error),
    });
  };

  heartbeatService.on('heartbeat:report', onReport);
  heartbeatService.on('heartbeat:error', onError);

  return () => {
    heartbeatService.off('heartbeat:report', onReport);
    heartbeatService.off('heartbeat:error', onError);
  };
}
