'use client';

import { use } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import { useEventStream } from '@/hooks/use-event-stream';
import Link from 'next/link';

interface MeetingParticipant {
  id: string;
  agentId: string;
  role: string;
  contributions: string | null;
}

interface MeetingDetail {
  id: string;
  title: string;
  type: string;
  status: string;
  agenda: string | null;
  minutes: string | null;
  summary: string | null;
  participants: MeetingParticipant[];
  createdAt: string;
}

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: meeting, isLoading, mutate } = useSWR<MeetingDetail>(`/api/meetings/${id}`, fetcher);

  useEventStream({
    filterPrefix: 'meeting:',
    onEvent: () => void mutate(),
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!meeting) return <p className="text-gray-500">Meeting not found</p>;

  return (
    <div>
      <Link href="/meetings" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-200">
        &larr; Back to Meetings
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold">{meeting.title}</h2>
        <p className="mt-1 text-sm text-gray-400">
          Type: {meeting.type} | Status: {meeting.status}
        </p>
      </div>

      {meeting.agenda && (
        <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-400">Agenda</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-200">{meeting.agenda}</p>
        </div>
      )}

      {meeting.summary && (
        <div className="mb-4 rounded-lg border border-blue-800 bg-blue-900/20 p-4">
          <h3 className="mb-2 text-sm font-semibold text-blue-400">Summary</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-200">{meeting.summary}</p>
        </div>
      )}

      {meeting.minutes && (
        <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-400">Minutes</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-200">{meeting.minutes}</p>
        </div>
      )}

      <h3 className="mb-3 text-lg font-semibold">Participants ({meeting.participants.length})</h3>

      {meeting.participants.length === 0 ? (
        <p className="py-4 text-center text-gray-600">No participants yet</p>
      ) : (
        <div className="space-y-3">
          {meeting.participants.map((p) => (
            <div key={p.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="font-medium text-gray-300">{p.agentId}</span>
                <span className="rounded bg-gray-700 px-1.5 py-0.5 text-gray-400">{p.role}</span>
              </div>
              {p.contributions && (
                <p className="whitespace-pre-wrap text-sm text-gray-200">{p.contributions}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
