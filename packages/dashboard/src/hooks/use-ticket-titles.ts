import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';

interface TicketSummary {
  id: string;
  title: string;
}

/** Fetch all tickets and return a lookup map from ticket ID to title. */
export function useTicketTitles() {
  const { data: tickets } = useSWR<TicketSummary[]>('/api/tickets', fetcher);

  const titleMap = new Map<string, string>();
  if (tickets) {
    for (const t of tickets) {
      titleMap.set(t.id, t.title);
    }
  }

  return titleMap;
}
