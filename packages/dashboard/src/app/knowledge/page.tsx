'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, apiUrl } from '@/lib/api-client';

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  learnedFrom: string | null;
  createdBy: string;
  createdAt: string;
}

const CATEGORIES = ['all', 'architecture', 'pattern', 'failure', 'research', 'context'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  architecture: 'bg-blue-500/20 text-blue-400',
  pattern: 'bg-green-500/20 text-green-400',
  failure: 'bg-red-500/20 text-red-400',
  research: 'bg-purple-500/20 text-purple-400',
  context: 'bg-yellow-500/20 text-yellow-400',
};

export default function KnowledgePage() {
  const [category, setCategory] = useState<string>('all');
  const url = category === 'all'
    ? '/api/knowledge'
    : apiUrl('/knowledge', { category });
  const { data: entries, isLoading } = useSWR<KnowledgeEntry[]>(url, fetcher);

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Knowledge Base</h2>

      <div className="mb-4 flex gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-500">Loading...</p>}

      {!entries?.length && !isLoading ? (
        <p className="py-8 text-center text-gray-600">No knowledge entries yet</p>
      ) : (
        <div className="space-y-3">
          {entries?.map((e) => (
            <div key={e.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <div className="mb-2 flex items-start gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_COLORS[e.category] ?? ''}`}>
                  {e.category}
                </span>
                <h3 className="text-sm font-semibold text-gray-200">{e.title}</h3>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-300">{e.content}</p>
              <div className="mt-2 text-xs text-gray-500">
                By: {e.createdBy}
                {e.learnedFrom && <span> | From: {e.learnedFrom}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
