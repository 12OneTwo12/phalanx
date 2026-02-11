'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiPatch } from '@/lib/api-client';

interface SoulData {
  soul: string;
  identity: string;
  memory: string;
  skills: string;
}

const TABS = ['soul', 'identity', 'memory', 'skills'] as const;
type TabName = (typeof TABS)[number];

const TAB_LABELS: Record<TabName, string> = {
  soul: 'SOUL.md',
  identity: 'IDENTITY.md',
  memory: 'MEMORY.md',
  skills: 'SKILLS.md',
};

const TAB_DESCRIPTIONS: Record<TabName, string> = {
  soul: 'Core identity, values, and personality of this agent',
  identity: 'Name, icon, color, and visual presentation',
  memory: 'Learned knowledge and context (auto-updated by the agent)',
  skills: 'Technical capabilities, tools, and allowed operations',
};

interface SoulEditorProps {
  agentId: string;
}

export function SoulEditor({ agentId }: SoulEditorProps) {
  const soulUrl = `/api/agents/${agentId}/soul`;
  const { data, isLoading } = useSWR<SoulData>(soulUrl, fetcher);
  const [activeTab, setActiveTab] = useState<TabName>('soul');
  const [editValue, setEditValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentContent = editValue ?? (data ? data[activeTab] : '');

  const handleTabChange = (tab: TabName) => {
    setEditValue(null);
    setActiveTab(tab);
  };

  const handleSave = async () => {
    if (editValue === null) return;
    setSaving(true);
    try {
      await apiPatch(`/agents/${agentId}/soul`, { [activeTab]: editValue });
      await mutate(soulUrl);
      setEditValue(null);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <p className="text-gray-500">Loading soul config...</p>;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div className="p-4">
        <p className="mb-3 text-xs text-gray-500">{TAB_DESCRIPTIONS[activeTab]}</p>
        <textarea
          value={currentContent}
          onChange={(e) => setEditValue(e.target.value)}
          aria-label={`Edit ${TAB_LABELS[activeTab]} content`}
          className="h-80 w-full resize-y rounded-md border border-gray-700 bg-gray-800 p-3 font-mono text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          placeholder={`Edit ${TAB_LABELS[activeTab]}...`}
        />
        {editValue !== null && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditValue(null)}
              className="rounded-md bg-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
