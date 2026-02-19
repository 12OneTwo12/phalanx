'use client';

import { use, useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/api-client';
import Link from 'next/link';

interface SkillDetail {
  name: string;
  description: string;
  content: string;
  filePath: string;
  baseDir: string;
  source: 'workspace' | 'managed' | 'bundled';
  metadata?: {
    emoji?: string;
    roles?: string[];
    requires?: { bins?: string[]; env?: string[] };
  };
}

export default function SkillDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const { data: skill, isLoading, error } = useSWR<SkillDetail>(`/api/skills/${name}`, fetcher);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const startEditing = useCallback(() => {
    if (!skill) return;
    setEditContent(skill.content);
    setEditDesc(skill.description);
    setEditing(true);
  }, [skill]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/skills/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDesc, content: editContent }),
      });
      await mutate(`/api/skills/${name}`);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [name, editDesc, editContent]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete skill "${name}"?`)) return;
    await fetch(`/api/skills/${name}`, { method: 'DELETE' });
    window.location.href = '/skills';
  }, [name]);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (error || !skill) return <p className="text-gray-500">Skill not found</p>;

  const isEditable = skill.source === 'workspace';

  return (
    <div>
      <Link href="/skills" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-200">
        ← Back to Skills
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{skill.metadata?.emoji ?? '🛠️'}</span>
          <h2 className="text-2xl font-bold">{skill.name}</h2>
          {isEditable && !editing && (
            <div className="flex gap-2">
              <button
                onClick={startEditing}
                className="rounded-md bg-gray-800 px-3 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-900/30 px-3 py-1 text-xs text-red-400 hover:bg-red-900/50"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            skill.source === 'workspace' ? 'bg-green-500/20 text-green-400' :
            skill.source === 'managed' ? 'bg-blue-500/20 text-blue-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {skill.source}
          </span>
          {skill.metadata?.roles?.map((role) => (
            <span key={role} className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
              {role}
            </span>
          ))}
          {(!skill.metadata?.roles || skill.metadata.roles.length === 0) && (
            <span className="text-xs text-gray-500">Available to all roles</span>
          )}
        </div>

        <p className="mt-2 text-sm text-gray-400">{skill.description || 'No description'}</p>
        <p className="mt-1 text-xs text-gray-600">{skill.filePath}</p>
      </div>

      {editing ? (
        <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Description</label>
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Content</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="h-96 w-full resize-y rounded-md border border-gray-700 bg-gray-800 p-3 font-mono text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md bg-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-400">Skill Instructions</h3>
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300">{skill.content}</pre>
        </div>
      )}
    </div>
  );
}
