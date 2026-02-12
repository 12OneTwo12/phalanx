'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiPost } from '@/lib/api-client';
import type { Goal } from '@phalanx/core';
import Link from 'next/link';

interface GoalWithEpicCount extends Goal {
  epicCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  completed: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
};

export default function GoalsPage() {
  const { data: goals, isLoading } = useSWR<GoalWithEpicCount[]>('/api/goals', fetcher);
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!description.trim()) return;
    setCreating(true);
    try {
      await apiPost('/goals', { description: description.trim() });
      setDescription('');
      await mutate('/api/goals');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Goals</h2>

      {/* Create goal form */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Describe a new goal..."
          className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !description.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Goal'}
        </button>
      </div>

      {/* Goal list */}
      {isLoading ? (
        <p className="text-gray-500">Loading goals...</p>
      ) : !goals?.length ? (
        <p className="text-gray-500">No goals yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <Link
              key={goal.id}
              href={`/goals/${goal.id}`}
              className="block rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{goal.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-400">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[goal.status] ?? ''}`}>
                      {goal.status}
                    </span>
                    <span>{goal.epicCount} {goal.epicCount === 1 ? 'epic' : 'epics'}</span>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-lg font-bold">{Math.round(goal.progress)}%</div>
                  <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
