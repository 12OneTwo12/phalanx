'use client';

import useSWR, { mutate } from 'swr';
import { fetcher, apiPatch } from '@/lib/api-client';
import type { HeartbeatLog, Proposal } from '@phalanx/core';

export default function HeartbeatPage() {
  const { data: heartbeats, isLoading: loadingHb } = useSWR<HeartbeatLog[]>('/api/heartbeat', fetcher);
  const { data: proposals, isLoading: loadingPr } = useSWR<Proposal[]>('/api/proposals', fetcher);

  const handleProposalAction = async (id: string, status: 'approved' | 'rejected') => {
    await apiPatch(`/proposals/${id}`, { status });
    await mutate('/api/proposals');
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Heartbeat & Proposals</h2>

      {/* Proposals Section */}
      <section className="mb-8">
        <h3 className="mb-3 text-lg font-semibold">Pending Proposals</h3>
        {loadingPr ? (
          <p className="text-gray-500">Loading...</p>
        ) : !proposals?.filter((p) => p.status === 'pending').length ? (
          <p className="text-gray-500">No pending proposals.</p>
        ) : (
          <div className="space-y-3">
            {proposals
              .filter((p) => p.status === 'pending')
              .map((proposal) => (
                <div key={proposal.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                        {proposal.type}
                      </span>
                      <h4 className="mt-1 font-medium">{proposal.title}</h4>
                      <p className="mt-1 text-sm text-gray-400">{proposal.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleProposalAction(proposal.id, 'approved')}
                        aria-label={`Approve proposal: ${proposal.title}`}
                        className="rounded bg-green-600/20 px-3 py-1 text-sm text-green-400 hover:bg-green-600/30"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleProposalAction(proposal.id, 'rejected')}
                        aria-label={`Reject proposal: ${proposal.title}`}
                        className="rounded bg-red-600/20 px-3 py-1 text-sm text-red-400 hover:bg-red-600/30"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Heartbeat Reports Section */}
      <section>
        <h3 className="mb-3 text-lg font-semibold">Heartbeat Reports</h3>
        {loadingHb ? (
          <p className="text-gray-500">Loading...</p>
        ) : !heartbeats?.length ? (
          <p className="text-gray-500">No heartbeat reports yet.</p>
        ) : (
          <div className="space-y-3">
            {heartbeats.map((hb) => (
              <div key={hb.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    hb.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    hb.status === 'acted' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {hb.status}
                  </span>
                  <span className="text-gray-500">Every {hb.interval} min</span>
                  <span className="text-gray-600">{hb.createdAt}</span>
                </div>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-800 p-2 text-xs text-gray-300">
                  {hb.report}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
