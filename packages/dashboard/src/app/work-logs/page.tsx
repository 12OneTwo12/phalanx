'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';
import { useAgentNames } from '@/hooks/use-agent-names';
import { useTicketTitles } from '@/hooks/use-ticket-titles';

interface AgentSummary {
  agentId: string;
  ticketsWorked: string[];
  started: number;
  progressed: number;
  completed: number;
  blocked: number;
}

interface DailySummary {
  date: string;
  totalEntries: number;
  agentSummaries: AgentSummary[];
}

interface TraceToolCall {
  name: string;
  input: string;
}

interface ExecutionTraceData {
  id: string;
  ticketId: string | null;
  agentId: string | null;
  status: string;
  iterations: number;
  toolCallCount: number;
  tokenUsage: string | null;
  finalContent: string | null;
  error: string | null;
  createdAt: string;
  toolCalls: TraceToolCall[];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function TicketTraceDetail({ ticketId }: { ticketId: string }) {
  const { data: traces, isLoading } = useSWR<ExecutionTraceData[]>(
    `/api/work-logs/${ticketId}/trace`,
    fetcher,
  );

  if (isLoading) return <p className="py-2 text-xs text-gray-500">Loading traces...</p>;
  if (!traces || traces.length === 0)
    return <p className="py-2 text-xs text-gray-600">No execution traces found</p>;

  return (
    <div className="mt-2 space-y-3">
      {traces.map((trace) => {
        let tokenInfo: { input?: number; output?: number } = {};
        try {
          if (trace.tokenUsage) tokenInfo = JSON.parse(trace.tokenUsage);
        } catch { /* ignore */ }

        return (
          <div key={trace.id} className="rounded border border-gray-700 bg-gray-800 p-3">
            <div className="mb-2 flex items-center gap-3 text-xs">
              <span
                className={
                  trace.status === 'completed'
                    ? 'text-green-400'
                    : trace.status === 'error'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                }
              >
                {trace.status}
              </span>
              <span className="text-gray-500">
                {trace.iterations} iterations, {trace.toolCallCount} tool calls
              </span>
              {(tokenInfo.input || tokenInfo.output) && (
                <span className="text-gray-500">
                  Tokens: {tokenInfo.input ?? 0} in / {tokenInfo.output ?? 0} out
                </span>
              )}
              <span className="text-gray-600">{trace.createdAt}</span>
            </div>

            {trace.error && (
              <p className="mb-2 text-xs text-red-400">Error: {trace.error}</p>
            )}

            {trace.toolCalls.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400">Tool Calls:</p>
                {trace.toolCalls.map((tc, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="font-medium text-blue-300">{tc.name}</span>
                    <span className="truncate text-gray-500">{tc.input}</span>
                  </div>
                ))}
              </div>
            )}

            {trace.finalContent && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-gray-400">Agent Thinking:</p>
                <p className="whitespace-pre-wrap text-xs italic text-gray-500">
                  {trace.finalContent.slice(0, 500)}
                  {trace.finalContent.length > 500 ? '...' : ''}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WorkLogsPage() {
  const [date, setDate] = useState(today);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const { data: summary, isLoading } = useSWR<DailySummary>(
    `/api/work-logs/summary?date=${date}`,
    fetcher,
  );
  const agentNames = useAgentNames();
  const ticketTitles = useTicketTitles();

  const toggleTicket = (ticketId: string) => {
    setExpandedTicket((prev) => (prev === ticketId ? null : ticketId));
  };

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Work Logs</h2>

      <div className="mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {isLoading && <p className="text-gray-500">Loading...</p>}

      {summary && (
        <>
          <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm text-gray-400">
              <span className="font-semibold text-gray-200">{summary.date}</span>
              {' — '}
              {summary.totalEntries} log entries from {summary.agentSummaries.length} agents
            </p>
          </div>

          {summary.agentSummaries.length === 0 ? (
            <p className="py-8 text-center text-gray-600">No work logs for this date</p>
          ) : (
            <div className="space-y-3">
              {summary.agentSummaries.map((agent) => (
                <div
                  key={agent.agentId}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-4"
                >
                  <h3 className="mb-2 text-sm font-semibold text-gray-200">
                    {agentNames.get(agent.agentId) ?? agent.agentId}
                  </h3>
                  <div className="flex gap-4 text-xs">
                    {agent.started > 0 && (
                      <span className="text-blue-400">Started: {agent.started}</span>
                    )}
                    {agent.progressed > 0 && (
                      <span className="text-yellow-400">Progressed: {agent.progressed}</span>
                    )}
                    {agent.completed > 0 && (
                      <span className="text-green-400">Completed: {agent.completed}</span>
                    )}
                    {agent.blocked > 0 && (
                      <span className="text-red-400">Blocked: {agent.blocked}</span>
                    )}
                  </div>
                  {agent.ticketsWorked.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-500">Tickets:</p>
                      {agent.ticketsWorked.map((id) => (
                        <div key={id}>
                          <button
                            type="button"
                            onClick={() => toggleTicket(id)}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            {expandedTicket === id ? '[-]' : '[+]'}{' '}
                            {ticketTitles.get(id) ?? id}
                          </button>
                          {expandedTicket === id && <TicketTraceDetail ticketId={id} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
