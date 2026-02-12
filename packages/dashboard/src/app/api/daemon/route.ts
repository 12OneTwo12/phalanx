/**
 * GET  /api/daemon — daemon status
 * POST /api/daemon — start or stop the daemon
 *
 * The daemon runs the OrchestratorScheduler + HeartbeatService inside the
 * Next.js server process, enabling automatic ticket assignment and execution.
 */
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { startDaemon, stopDaemon, isDaemonRunning } from '@/lib/daemon';

/** GET /api/daemon — return daemon status */
export async function GET() {
  return jsonResponse({ running: isDaemonRunning() });
}

/** POST /api/daemon — { action: 'start' | 'stop' } */
export async function POST(request: Request) {
  const body = await parseBody<{ action: string }>(request);
  if (!body?.action) {
    return errorResponse('action is required ("start" or "stop")');
  }

  switch (body.action) {
    case 'start':
      try {
        startDaemon();
        return jsonResponse({ running: true, message: 'Daemon started' });
      } catch (err) {
        return errorResponse(
          `Failed to start daemon: ${err instanceof Error ? err.message : String(err)}`,
          500,
        );
      }

    case 'stop':
      await stopDaemon();
      return jsonResponse({ running: false, message: 'Daemon stopped' });

    default:
      return errorResponse(`Unknown action: ${body.action}. Use "start" or "stop".`);
  }
}
