'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiPost } from '@/lib/api-client';
import type { Convention } from '@phalanx/core';

const CONVENTION_TABS = [
  { type: 'conventions', label: 'Conventions', description: 'Team coding conventions and standards' },
  { type: 'architecture', label: 'Architecture', description: 'Project architecture guidelines' },
  { type: 'style', label: 'Style Guide', description: 'Code style and formatting rules' },
] as const;

type ConventionType = (typeof CONVENTION_TABS)[number]['type'];

export default function ConventionsPage() {
  const { data: conventions, isLoading } = useSWR<Convention[]>('/api/conventions', fetcher);
  const [activeTab, setActiveTab] = useState<ConventionType>('conventions');
  const [editValue, setEditValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeConvention = conventions?.find((c) => c.type === activeTab);
  const currentContent = editValue ?? activeConvention?.content ?? '';
  const activeTabMeta = CONVENTION_TABS.find((t) => t.type === activeTab)!;

  const handleTabChange = (type: ConventionType) => {
    setEditValue(null);
    setActiveTab(type);
  };

  const handleSave = async () => {
    if (editValue === null) return;
    setSaving(true);
    try {
      await apiPost('/conventions', { type: activeTab, content: editValue });
      await mutate('/api/conventions');
      setEditValue(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Conventions</h2>

      <div className="rounded-lg border border-gray-800 bg-gray-900">
        {/* Tab bar */}
        <div className="flex border-b border-gray-800">
          {CONVENTION_TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => handleTabChange(tab.type)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.type
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">{activeTabMeta.description}</p>
            {activeConvention && (
              <span className="text-xs text-gray-600">
                v{activeConvention.version} · Updated by {activeConvention.updatedBy} · {activeConvention.updatedAt}
              </span>
            )}
          </div>

          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <>
              <textarea
                value={currentContent}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-96 w-full resize-y rounded-md border border-gray-700 bg-gray-800 p-3 font-mono text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder={`Define your ${activeTabMeta.label.toLowerCase()} here using Markdown...`}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
