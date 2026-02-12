import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';

interface AgentSummary {
  id: string;
  name: string;
  role: string;
}

/** Fetch all agents and return a lookup map from agent ID to display name (name + role). */
export function useAgentNames() {
  const { data: agents } = useSWR<AgentSummary[]>('/api/agents', fetcher);

  const nameMap = new Map<string, string>();
  if (agents) {
    for (const a of agents) {
      nameMap.set(a.id, a.name);
    }
  }

  return nameMap;
}
