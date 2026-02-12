import { jsonResponse } from '@/lib/api-utils';
import { getChannelRegistry, isChannelSystemRunning } from '@/lib/channel-wiring';

/** GET /api/channels/status — registered channel providers and their status */
export async function GET() {
  const registry = getChannelRegistry();
  const providers = registry.getAll().map((p) => ({
    id: p.id,
    name: p.name,
    running: p.isRunning(),
    capabilities: p.capabilities,
  }));

  return jsonResponse({
    channelSystemRunning: isChannelSystemRunning(),
    providers,
  });
}
