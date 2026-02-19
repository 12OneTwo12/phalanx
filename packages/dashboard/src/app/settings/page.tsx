'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiPatch, apiPost, apiDelete } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderConfig {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  defaultModel: string | null;
  baseUrl: string | null;
}

interface CredentialStatus {
  exists: boolean;
  masked: string;
  authMode: string;
}

interface DaemonConfig {
  approval: { mode: string };
  pr: { mode: string; smartRules?: SmartRules };
}

interface SmartRules {
  maxFilesChanged?: number;
  forbiddenPaths?: string;
  requireTestsPass?: boolean;
  allowNewDependencies?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KNOWN_CREDENTIAL_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;

// ---------------------------------------------------------------------------
// Section: LLM Providers
// ---------------------------------------------------------------------------

function ProvidersSection() {
  const { data: providers, isLoading } = useSWR<ProviderConfig[]>('/api/providers', fetcher);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: 'anthropic', name: '', baseUrl: '', defaultModel: '' });
  const [saving, setSaving] = useState(false);

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await apiPatch(`/providers/${id}`, { enabled: !enabled });
    await mutate('/api/providers');
  };

  const handleDelete = async (id: string) => {
    await apiDelete(`/providers/${id}`);
    await mutate('/api/providers');
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await apiPost('/providers', {
        type: form.type,
        name: form.name,
        baseUrl: form.baseUrl || undefined,
        defaultModel: form.defaultModel || undefined,
      });
      await mutate('/api/providers');
      setForm({ type: 'anthropic', name: '', baseUrl: '', defaultModel: '' });
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">LLM Providers</h3>
        <button
          onClick={() => setAdding(!adding)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          {adding ? 'Cancel' : 'Add Provider'}
        </button>
      </div>

      {adding && (
        <div className="mb-4 space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. My Anthropic"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Base URL (optional)</label>
              <input
                type="text"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://api.example.com"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Default Model (optional)</label>
              <input
                type="text"
                value={form.defaultModel}
                onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
                placeholder="e.g. claude-sonnet-4-5-20250929"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !form.name.trim()}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create Provider'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !providers?.length ? (
        <p className="text-gray-500">No providers configured.</p>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-center gap-3">
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                  {p.type}
                </span>
                <span className="font-medium text-gray-200">{p.name}</span>
                {p.defaultModel && (
                  <span className="text-xs text-gray-500">{p.defaultModel}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleEnabled(p.id, p.enabled)}
                  className={`rounded-md px-3 py-1 text-xs ${
                    p.enabled
                      ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                      : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                  }`}
                >
                  {p.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="rounded-md bg-red-600/20 px-3 py-1 text-xs text-red-400 hover:bg-red-600/30"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: API Credentials
// ---------------------------------------------------------------------------

function CredentialsSection() {
  const { data: credentials, isLoading } = useSWR<Record<string, CredentialStatus>>('/api/credentials', fetcher);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (provider: string) => {
    if (!secretInput.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/credentials/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secretInput, authMode: 'api_key' }),
      });
      await mutate('/api/credentials');
      setEditingProvider(null);
      setSecretInput('');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (provider: string) => {
    await fetch(`/api/credentials/${provider}`, { method: 'DELETE' });
    await mutate('/api/credentials');
  };

  return (
    <section className="mb-8">
      <h3 className="mb-3 text-lg font-semibold">API Credentials</h3>
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-3">
          {KNOWN_CREDENTIAL_PROVIDERS.map((provider) => {
            const cred = credentials?.[provider];
            const isEditing = editingProvider === provider;

            return (
              <div key={provider} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium capitalize text-gray-200">{provider}</span>
                    {cred?.exists ? (
                      <span className="text-xs text-green-400">{cred.masked}</span>
                    ) : (
                      <span className="text-xs text-gray-500">Not configured</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingProvider(null);
                          setSecretInput('');
                        } else {
                          setEditingProvider(provider);
                          setSecretInput('');
                        }
                      }}
                      className="rounded-md bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600"
                    >
                      {isEditing ? 'Cancel' : 'Set Key'}
                    </button>
                    {cred?.exists && (
                      <button
                        onClick={() => handleRemove(provider)}
                        className="rounded-md bg-red-600/20 px-3 py-1 text-xs text-red-400 hover:bg-red-600/30"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="password"
                      value={secretInput}
                      onChange={(e) => setSecretInput(e.target.value)}
                      placeholder="Enter API key..."
                      className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSave(provider)}
                      disabled={saving || !secretInput.trim()}
                      className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Ticket Approval Mode
// ---------------------------------------------------------------------------

function ApprovalSection({ config, onSave }: { config: DaemonConfig | undefined; onSave: () => void }) {
  const currentMode = config?.approval?.mode ?? 'manual';
  const [saving, setSaving] = useState(false);

  const handleChange = async (mode: string) => {
    setSaving(true);
    try {
      await apiPatch('/config', { approval: { mode } });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-8">
      <h3 className="mb-3 text-lg font-semibold">Ticket Approval</h3>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex gap-4">
          {['manual', 'auto'].map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="approval-mode"
                value={mode}
                checked={currentMode === mode}
                onChange={() => handleChange(mode)}
                disabled={saving}
                className="accent-blue-500"
              />
              <span className="text-sm capitalize text-gray-200">{mode}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {currentMode === 'auto'
            ? 'Tickets are automatically approved when created.'
            : 'Tickets require manual approval before agents begin work.'}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: PR Merge Mode
// ---------------------------------------------------------------------------

function PRModeSection({ config, onSave }: { config: DaemonConfig | undefined; onSave: () => void }) {
  const currentMode = config?.pr?.mode ?? 'manual';
  const smartRules = config?.pr?.smartRules ?? {};
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<SmartRules>({
    maxFilesChanged: (smartRules.maxFilesChanged as number) ?? 20,
    forbiddenPaths: (smartRules.forbiddenPaths as string) ?? '.env,package-lock.json,pnpm-lock.yaml',
    requireTestsPass: (smartRules.requireTestsPass as boolean) ?? true,
    allowNewDependencies: (smartRules.allowNewDependencies as boolean) ?? false,
  });

  const handleModeChange = async (mode: string) => {
    setSaving(true);
    try {
      const patch: { mode: string; smartRules?: SmartRules } = { mode };
      if (mode === 'smart') {
        patch.smartRules = rules;
      }
      await apiPatch('/config', { pr: patch });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  const handleRulesSave = async () => {
    setSaving(true);
    try {
      await apiPatch('/config', { pr: { mode: 'smart', smartRules: rules } });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-8">
      <h3 className="mb-3 text-lg font-semibold">PR Merge Mode</h3>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex gap-4">
          {['manual', 'smart', 'auto'].map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="pr-mode"
                value={mode}
                checked={currentMode === mode}
                onChange={() => handleModeChange(mode)}
                disabled={saving}
                className="accent-blue-500"
              />
              <span className="text-sm capitalize text-gray-200">{mode}</span>
            </label>
          ))}
        </div>

        {currentMode === 'smart' && (
          <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Max Files Changed</label>
                <input
                  type="number"
                  value={rules.maxFilesChanged}
                  onChange={(e) => setRules((r) => ({ ...r, maxFilesChanged: Number(e.target.value) }))}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Forbidden Paths (comma-separated)</label>
                <input
                  type="text"
                  value={rules.forbiddenPaths}
                  onChange={(e) => setRules((r) => ({ ...r, forbiddenPaths: e.target.value }))}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rules.requireTestsPass}
                  onChange={(e) => setRules((r) => ({ ...r, requireTestsPass: e.target.checked }))}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-200">Require Tests Pass</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rules.allowNewDependencies}
                  onChange={(e) => setRules((r) => ({ ...r, allowNewDependencies: e.target.checked }))}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-200">Allow New Dependencies</span>
              </label>
            </div>
            <button
              onClick={handleRulesSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500">
          {currentMode === 'auto' && 'PRs are automatically merged when checks pass.'}
          {currentMode === 'smart' && 'PRs are auto-merged only when smart rules are satisfied.'}
          {currentMode === 'manual' && 'PRs require manual review and merge.'}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { data: config } = useSWR<DaemonConfig>('/api/config', fetcher);

  const reloadConfig = () => {
    mutate('/api/config');
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Settings</h2>
      <ProvidersSection />
      <CredentialsSection />
      <ApprovalSection config={config} onSave={reloadConfig} />
      <PRModeSection config={config} onSave={reloadConfig} />
    </div>
  );
}
