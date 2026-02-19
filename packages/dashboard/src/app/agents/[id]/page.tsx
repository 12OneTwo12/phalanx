'use client';

import { use, useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiPatch } from '@/lib/api-client';
import type { Agent } from '@phalanx/core';
import Link from 'next/link';
import { SoulEditor } from '@/components/soul-editor';
import { useTicketTitles } from '@/hooks/use-ticket-titles';

const STATUS_BADGE: Record<string, string> = {
  idle: 'bg-gray-500/20 text-gray-400',
  running: 'bg-green-500/20 text-green-400',
  completed: 'bg-blue-500/20 text-blue-400',
  error: 'bg-red-500/20 text-red-400',
  escalated: 'bg-yellow-500/20 text-yellow-400',
};

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: agent, isLoading } = useSWR<Agent>(`/api/agents/${id}`, fetcher);
  const { data: modelCatalog } = useSWR<{ providers: string[]; models: Record<string, { id: string; name: string }[]> }>('/api/models', fetcher);
  const ticketTitles = useTicketTitles();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', provider: '', model: '' });
  const [saving, setSaving] = useState(false);

  const startEditing = useCallback(() => {
    if (!agent) return;
    setEditForm({
      name: agent.name,
      provider: agent.provider ?? '',
      model: agent.model ?? '',
    });
    setEditing(true);
  }, [agent]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiPatch(`/agents/${id}`, {
        name: editForm.name,
        provider: editForm.provider || null,
        model: editForm.model || null,
      });
      await mutate(`/api/agents/${id}`);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [id, editForm]);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!agent) return <p className="text-gray-500">Agent not found</p>;

  return (
    <div>
      <Link href="/agents" className="mb-4 inline-block text-sm text-gray-400 hover:text-gray-200">
        ← Back to Agents
      </Link>

      <div className="mb-6">
        {editing ? (
          <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Provider</label>
                <select
                  value={editForm.provider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    const providerModels = modelCatalog?.models[newProvider] ?? [];
                    setEditForm((f) => ({
                      ...f,
                      provider: newProvider,
                      model: providerModels[0]?.id ?? '',
                    }));
                  }}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select provider</option>
                  {modelCatalog?.providers.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Model</label>
                <select
                  value={editForm.model}
                  onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select model</option>
                  {(modelCatalog?.models[editForm.provider] ?? []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !editForm.name.trim()}
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
          <>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{agent.name}</h2>
              <button
                onClick={startEditing}
                className="rounded-md bg-gray-800 px-3 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              >
                Edit
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[agent.status] ?? ''}`}>
                {agent.status}
              </span>
              <span className="text-gray-400">Role: {agent.role}</span>
              {agent.provider && <span className="text-gray-500">{agent.provider}/{agent.model}</span>}
            </div>
            {agent.currentTicketId && (
              <p className="mt-2 text-sm text-gray-400">
                Currently working on:{' '}
                <Link href={`/tickets/${agent.currentTicketId}`} className="text-gray-300 hover:text-blue-400">
                  {ticketTitles.get(agent.currentTicketId) ?? agent.currentTicketId}
                </Link>
              </p>
            )}
          </>
        )}
      </div>

      <h3 className="mb-3 text-lg font-semibold">Soul Configuration</h3>
      <SoulEditor agentId={id} />
    </div>
  );
}
