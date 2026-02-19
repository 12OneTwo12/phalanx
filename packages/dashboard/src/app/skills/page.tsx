'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiPost } from '@/lib/api-client';
import Link from 'next/link';

interface SkillSummary {
  name: string;
  description: string;
  source: 'workspace' | 'managed' | 'bundled';
  roles: string[];
  emoji?: string;
}

const SOURCE_BADGE: Record<string, string> = {
  workspace: 'bg-green-500/20 text-green-400',
  managed: 'bg-blue-500/20 text-blue-400',
  bundled: 'bg-gray-500/20 text-gray-400',
};

export default function SkillsPage() {
  const { data: skills, isLoading } = useSWR<SkillSummary[]>('/api/skills', fetcher);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', content: '' });
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.content.trim()) return;
    setError(null);
    try {
      await apiPost('/skills', form);
      await mutate('/api/skills');
      setForm({ name: '', description: '', content: '' });
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Shared Skills Library</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          {creating ? 'Cancel' : 'Create Skill'}
        </button>
      </div>

      {creating && (
        <div className="mb-6 space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="my-skill"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What this skill does"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Content (Markdown)</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="# Skill instructions..."
              className="h-40 w-full resize-y rounded-md border border-gray-700 bg-gray-800 p-3 font-mono text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={!form.name.trim() || !form.content.trim()}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      {isLoading && <p className="text-gray-500">Loading skills...</p>}

      {skills && skills.length === 0 && (
        <p className="text-gray-500">No skills found. Create one or add SKILL.md files to the skills/ directory.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills?.map((skill) => (
          <Link
            key={skill.name}
            href={`/skills/${skill.name}`}
            className="rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">{skill.emoji ?? '🛠️'}</span>
              <h3 className="font-semibold text-gray-200">{skill.name}</h3>
            </div>
            <p className="mb-3 text-sm text-gray-400 line-clamp-2">{skill.description || 'No description'}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[skill.source] ?? ''}`}>
                {skill.source}
              </span>
              {skill.roles.map((role) => (
                <span key={role} className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                  {role}
                </span>
              ))}
              {skill.roles.length === 0 && (
                <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-xs text-gray-500">all roles</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
