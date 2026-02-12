/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Auto-starts the daemon (OrchestratorScheduler + HeartbeatService)
 * so tickets are processed automatically without manual API calls.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (not during build or edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startDaemon } = await import('./lib/daemon');
    try {
      startDaemon();
    } catch (err) {
      console.error(
        '[phalanx] Failed to auto-start daemon:',
        err instanceof Error ? err.message : err,
      );
      // Non-fatal: Dashboard still works, daemon can be started via API
    }
  }
}
