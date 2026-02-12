'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import { useTicketTitles } from '@/hooks/use-ticket-titles';
import Link from 'next/link';

interface DecisionRecord {
  id: string;
  title: string;
  what: string;
  why: string;
  alternatives: string | null;
  evidence: string | null;
  madeBy: string;
  relatedTicketId: string | null;
  createdAt: string;
}

export default function DecisionsPage() {
  const { data: decisions, isLoading } = useSWR<DecisionRecord[]>('/api/decisions', fetcher);
  const ticketTitles = useTicketTitles();

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Decision Records</h2>

      {isLoading && <p className="text-gray-500">Loading...</p>}

      {!decisions?.length && !isLoading ? (
        <p className="py-8 text-center text-gray-600">No decisions recorded yet</p>
      ) : (
        <div className="space-y-3">
          {decisions?.map((d) => (
            <div key={d.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="text-sm font-semibold text-gray-200">{d.title}</h3>
                <span className="text-xs text-gray-500">
                  {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-xs font-medium text-gray-400">What: </span>
                  <span className="text-gray-300">{d.what}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-400">Why: </span>
                  <span className="text-gray-300">{d.why}</span>
                </div>
                {d.alternatives && (
                  <div>
                    <span className="text-xs font-medium text-gray-400">Alternatives: </span>
                    <span className="text-gray-300">{d.alternatives}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span>By: {d.madeBy}</span>
                {d.relatedTicketId && (
                  <Link href={`/tickets/${d.relatedTicketId}`} className="hover:text-blue-400">
                    Ticket: {ticketTitles.get(d.relatedTicketId) ?? d.relatedTicketId}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
