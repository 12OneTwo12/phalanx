'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api-client';

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

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export default function WorkLogsPage() {
  const [date, setDate] = useState(today);
  const { data: summary, isLoading } = useSWR<DailySummary>(
    `/api/work-logs/summary?date=${date}`,
    fetcher,
  );

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
                  <h3 className="mb-2 text-sm font-semibold text-gray-200">{agent.agentId}</h3>
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
                    <p className="mt-1 text-xs text-gray-500">
                      Tickets: {agent.ticketsWorked.join(', ')}
                    </p>
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
