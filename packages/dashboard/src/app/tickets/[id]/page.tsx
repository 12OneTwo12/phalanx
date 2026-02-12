'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { fetcher, apiPost } from '@/lib/api-client';
import { useEventStream } from '@/hooks/use-event-stream';
import Link from 'next/link';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedAgentId: string | null;
  branch: string | null;
  prUrl: string | null;
  epicId: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketComment {
  id: string;
  ticketId: string;
  author: string;
  type: string;
  content: string;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending_approval: 'bg-yellow-500/20 text-yellow-400',
  backlog: 'bg-gray-500/20 text-gray-400',
  assigned: 'bg-purple-500/20 text-purple-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  verification: 'bg-orange-500/20 text-orange-400',
  done: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  escalated: 'bg-red-500/20 text-red-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
};

const COMMENT_TYPE_ICONS: Record<string, string> = {
  plan: 'P',
  progress: '>',
  completion: '*',
  review: '?',
  comment: '#',
};

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: ticket, isLoading } = useSWR<Ticket>(`/api/tickets/${id}`, fetcher);
  const { data: comments, mutate: refreshComments } = useSWR<TicketComment[]>(
    `/api/tickets/${id}/comments`,
    fetcher,
  );
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState('comment');
  const [sending, setSending] = useState(false);

  useEventStream({
    filterPrefix: 'ticket:',
    onEvent: () => void refreshComments(),
  });

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      await apiPost(`/tickets/${id}/comments`, {
        author: 'user',
        type: commentType,
        content: newComment,
      });
      setNewComment('');
      await refreshComments();
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!ticket) return <p className="text-gray-500">Ticket not found</p>;

  return (
    <div>
      <Link href="/tickets" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-200">
        &larr; Back to Tickets
      </Link>

      {/* Ticket Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{ticket.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[ticket.status] ?? ''}`}>
            {ticket.status}
          </span>
          <span className={`text-xs ${PRIORITY_COLORS[ticket.priority] ?? ''}`}>
            {ticket.priority}
          </span>
          {ticket.assignedAgentId && (
            <span className="text-gray-400">Agent: {ticket.assignedAgentId}</span>
          )}
          {ticket.branch && (
            <span className="font-mono text-xs text-gray-500">{ticket.branch}</span>
          )}
          {ticket.prUrl && (
            <span className="text-blue-400">{ticket.prUrl}</span>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-400">Description</h3>
        <p className="whitespace-pre-wrap text-sm text-gray-200">{ticket.description}</p>
      </div>

      {/* Comments */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-4 text-sm font-semibold text-gray-400">
          Comments ({comments?.length ?? 0})
        </h3>

        {!comments?.length ? (
          <p className="py-4 text-center text-sm text-gray-600">No comments yet</p>
        ) : (
          <div className="mb-4 space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md border border-gray-700 bg-gray-800 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-gray-300">
                    {COMMENT_TYPE_ICONS[c.type] ?? '#'} {c.type}
                  </span>
                  <span className="font-medium text-gray-300">{c.author}</span>
                  <span className="text-gray-500">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-200">{c.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add Comment */}
        <div className="border-t border-gray-700 pt-3">
          <div className="mb-2 flex gap-2">
            <select
              value={commentType}
              onChange={(e) => setCommentType(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300"
            >
              <option value="comment">Comment</option>
              <option value="plan">Plan</option>
              <option value="progress">Progress</option>
              <option value="completion">Completion</option>
              <option value="review">Review</option>
            </select>
          </div>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={sending || !newComment.trim()}
            className="mt-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Add Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}
