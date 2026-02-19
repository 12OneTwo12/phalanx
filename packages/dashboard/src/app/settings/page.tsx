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
  teamMode?: { mode: string; smartThreshold?: string; agentsPerRole?: number };
}

interface SmartRules {
  maxFilesChanged?: number;
  forbiddenPaths?: string;
  requireTestsPass?: boolean;
  allowNewDependencies?: boolean;
}

// ---------------------------------------------------------------------------
// Provider type configuration
// ---------------------------------------------------------------------------

interface AuthModeOption {
  value: string;
  label: string;
}

interface ProviderTypeConfig {
  label: string;
  color: string;
  authModes: AuthModeOption[];
  secretPlaceholder?: string;
  needsBaseUrl?: boolean;
  defaultBaseUrl?: string;
  knownModels: string[];
}

const PROVIDER_TYPES: Record<string, ProviderTypeConfig> = {
  anthropic: {
    label: 'Anthropic',
    color: 'bg-orange-500/20 text-orange-400',
    authModes: [
      { value: 'api_key', label: 'API Key' },
      { value: 'token', label: 'Setup Token' },
    ],
    secretPlaceholder: 'sk-ant-...',
    knownModels: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-6'],
  },
  openai: {
    label: 'OpenAI',
    color: 'bg-green-500/20 text-green-400',
    authModes: [
      { value: 'api_key', label: 'API Key' },
      { value: 'oauth', label: 'OAuth Token' },
    ],
    secretPlaceholder: 'sk-...',
    knownModels: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
  },
  ollama: {
    label: 'Ollama',
    color: 'bg-blue-500/20 text-blue-400',
    authModes: [],
    needsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    knownModels: [],
  },
  gemini: {
    label: 'Gemini',
    color: 'bg-cyan-500/20 text-cyan-400',
    authModes: [{ value: 'api_key', label: 'API Key' }],
    secretPlaceholder: 'AIza...',
    knownModels: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  custom: {
    label: 'Custom',
    color: 'bg-gray-500/20 text-gray-400',
    authModes: [
      { value: 'api_key', label: 'API Key' },
      { value: 'token', label: 'Bearer Token' },
      { value: 'none', label: 'None' },
    ],
    needsBaseUrl: true,
    secretPlaceholder: 'Enter secret...',
    knownModels: [],
  },
};

// ---------------------------------------------------------------------------
// Section: Unified LLM Providers
// ---------------------------------------------------------------------------

function ProvidersSection() {
  const { data: providers, isLoading } = useSWR<ProviderConfig[]>('/api/providers', fetcher);
  const { data: credentials } = useSWR<Record<string, CredentialStatus>>('/api/credentials', fetcher);

  // Add provider state
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    type: 'anthropic',
    name: '',
    baseUrl: '',
    defaultModel: '',
    authMode: 'api_key',
    secret: '',
  });
  const [saving, setSaving] = useState(false);

  // Configure existing provider state
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [editAuthMode, setEditAuthMode] = useState('api_key');
  const [editSecret, setEditSecret] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Test connection state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Model discovery state
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);

  const typeConfig = PROVIDER_TYPES[addForm.type] ?? PROVIDER_TYPES.custom;
  const needsSecret = typeConfig.authModes.length > 0;

  // Reset add form when type changes
  const handleTypeChange = (type: string) => {
    const tc = PROVIDER_TYPES[type] ?? PROVIDER_TYPES.custom;
    setAddForm({
      type,
      name: tc.label,
      baseUrl: tc.defaultBaseUrl ?? '',
      defaultModel: '',
      authMode: tc.authModes[0]?.value ?? 'none',
      secret: '',
    });
  };

  // Add provider: create config + save credential if needed
  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    setSaving(true);
    try {
      await apiPost('/providers', {
        type: addForm.type,
        name: addForm.name,
        baseUrl: addForm.baseUrl || undefined,
        defaultModel: addForm.defaultModel || undefined,
      });

      // Save credential if secret provided
      if (addForm.secret.trim()) {
        await fetch(`/api/credentials/${addForm.type}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: addForm.secret, authMode: addForm.authMode }),
        });
        await mutate('/api/credentials');
      }

      await mutate('/api/providers');
      setAddForm({ type: 'anthropic', name: '', baseUrl: '', defaultModel: '', authMode: 'api_key', secret: '' });
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  // Toggle provider enabled/disabled
  const toggleEnabled = async (id: string, enabled: boolean) => {
    await apiPatch(`/providers/${id}`, { enabled: !enabled });
    await mutate('/api/providers');
  };

  // Delete provider
  const handleDelete = async (id: string) => {
    await apiDelete(`/providers/${id}`);
    await mutate('/api/providers');
  };

  // Open configure panel for a provider
  const openConfigure = (provider: ProviderConfig) => {
    const tc = PROVIDER_TYPES[provider.type] ?? PROVIDER_TYPES.custom;
    const cred = credentials?.[provider.type];
    setConfiguringId(provider.id);
    setEditAuthMode(cred?.authMode ?? tc.authModes[0]?.value ?? 'none');
    setEditSecret('');
    setEditBaseUrl(provider.baseUrl ?? tc.defaultBaseUrl ?? '');
    setEditModel(provider.defaultModel ?? '');
    setTestResult(null);
    setDiscoveredModels([]);
  };

  // Save configure changes
  const handleSaveConfigure = async (provider: ProviderConfig) => {
    setEditSaving(true);
    try {
      // Update provider config (baseUrl, model)
      await apiPatch(`/providers/${provider.id}`, {
        baseUrl: editBaseUrl || null,
        defaultModel: editModel || null,
      });

      // Save credential if secret provided
      if (editSecret.trim()) {
        await fetch(`/api/credentials/${provider.type}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: editSecret, authMode: editAuthMode }),
        });
        await mutate('/api/credentials');
      }

      await mutate('/api/providers');
      setConfiguringId(null);
    } finally {
      setEditSaving(false);
    }
  };

  // Test connection
  const handleTestConnection = async (provider: ProviderConfig) => {
    setTestingId(provider.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/providers/${provider.id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
    } catch {
      setTestResult({ success: false, message: 'Request failed' });
    } finally {
      setTestingId(null);
    }
  };

  // Discover models (Ollama)
  const handleDiscoverModels = async (provider: ProviderConfig) => {
    setDiscoveringId(provider.id);
    setDiscoveredModels([]);
    try {
      const res = await fetch(`/api/providers/${provider.id}/models`);
      const data = await res.json();
      if (data.models?.length > 0) {
        setDiscoveredModels(data.models);
      } else {
        setDiscoveredModels([]);
        setTestResult({ success: false, message: data.error ?? 'No models found' });
      }
    } catch {
      setTestResult({ success: false, message: 'Discovery request failed' });
    } finally {
      setDiscoveringId(null);
    }
  };

  // Remove credential
  const handleRemoveCredential = async (providerType: string) => {
    await fetch(`/api/credentials/${providerType}`, { method: 'DELETE' });
    await mutate('/api/credentials');
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">LLM Providers</h3>
        <button
          onClick={() => { setAdding(!adding); if (!adding) handleTypeChange('anthropic'); }}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          {adding ? 'Cancel' : 'Add Provider'}
        </button>
      </div>

      {/* --- Add Provider Form --- */}
      {adding && (
        <div className="mb-4 space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Provider Type</label>
              <select
                value={addForm.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(PROVIDER_TYPES).map(([key, tc]) => (
                  <option key={key} value={key}>{tc.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Display Name</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Base URL for Ollama / Custom */}
          {typeConfig.needsBaseUrl && (
            <div>
              <label className="mb-1 block text-xs text-gray-400">Base URL</label>
              <input
                type="text"
                value={addForm.baseUrl}
                onChange={(e) => setAddForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder={typeConfig.defaultBaseUrl ?? 'https://api.example.com'}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Auth mode + secret for cloud providers */}
          {needsSecret && (
            <div className="grid grid-cols-2 gap-3">
              {typeConfig.authModes.length > 1 && (
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Auth Mode</label>
                  <select
                    value={addForm.authMode}
                    onChange={(e) => setAddForm((f) => ({ ...f, authMode: e.target.value }))}
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                  >
                    {typeConfig.authModes.map((am) => (
                      <option key={am.value} value={am.value}>{am.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={typeConfig.authModes.length > 1 ? '' : 'col-span-2'}>
                <label className="mb-1 block text-xs text-gray-400">
                  {typeConfig.authModes.find((a) => a.value === addForm.authMode)?.label ?? 'Secret'}
                </label>
                <input
                  type="password"
                  value={addForm.secret}
                  onChange={(e) => setAddForm((f) => ({ ...f, secret: e.target.value }))}
                  placeholder={typeConfig.secretPlaceholder ?? 'Enter secret...'}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Model selection */}
          {typeConfig.knownModels.length > 0 && (
            <div>
              <label className="mb-1 block text-xs text-gray-400">Default Model</label>
              <select
                value={addForm.defaultModel}
                onChange={(e) => setAddForm((f) => ({ ...f, defaultModel: e.target.value }))}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select model...</option>
                {typeConfig.knownModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {addForm.type === 'ollama' && (
            <p className="text-xs text-gray-500">
              Ollama runs locally and requires no API key. Make sure Ollama is running at the specified URL.
            </p>
          )}

          <button
            onClick={handleAdd}
            disabled={saving || !addForm.name.trim()}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Provider'}
          </button>
        </div>
      )}

      {/* --- Provider List --- */}
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !providers?.length ? (
        <p className="text-gray-500">No providers configured. Click &quot;Add Provider&quot; to get started.</p>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => {
            const tc = PROVIDER_TYPES[provider.type] ?? PROVIDER_TYPES.custom;
            const cred = credentials?.[provider.type];
            const isConfiguring = configuringId === provider.id;

            return (
              <div key={provider.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                {/* Provider header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${tc.color}`}>
                      {tc.label}
                    </span>
                    <span className="font-medium text-gray-200">{provider.name}</span>
                    {provider.defaultModel && (
                      <span className="text-xs text-gray-500">{provider.defaultModel}</span>
                    )}
                    {/* Credential status */}
                    {tc.authModes.length > 0 && (
                      cred?.exists ? (
                        <span className="text-xs text-green-400">{cred.masked}</span>
                      ) : (
                        <span className="text-xs text-yellow-400">No credentials</span>
                      )
                    )}
                    {provider.type === 'ollama' && provider.baseUrl && (
                      <span className="text-xs text-gray-500">{provider.baseUrl}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => isConfiguring ? setConfiguringId(null) : openConfigure(provider)}
                      className="rounded-md bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600"
                    >
                      {isConfiguring ? 'Close' : 'Configure'}
                    </button>
                    <button
                      onClick={() => toggleEnabled(provider.id, provider.enabled)}
                      className={`rounded-md px-3 py-1 text-xs ${
                        provider.enabled
                          ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                          : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                      }`}
                    >
                      {provider.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleDelete(provider.id)}
                      className="rounded-md bg-red-600/20 px-3 py-1 text-xs text-red-400 hover:bg-red-600/30"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Configure panel */}
                {isConfiguring && (
                  <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
                    {/* Base URL (Ollama / Custom) */}
                    {(tc.needsBaseUrl || provider.baseUrl) && (
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Base URL</label>
                        <input
                          type="text"
                          value={editBaseUrl}
                          onChange={(e) => setEditBaseUrl(e.target.value)}
                          placeholder={tc.defaultBaseUrl ?? 'https://api.example.com'}
                          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Auth mode + secret for cloud providers */}
                    {tc.authModes.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {tc.authModes.length > 1 && (
                          <div>
                            <label className="mb-1 block text-xs text-gray-400">Auth Mode</label>
                            <select
                              value={editAuthMode}
                              onChange={(e) => setEditAuthMode(e.target.value)}
                              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                            >
                              {tc.authModes.map((am) => (
                                <option key={am.value} value={am.value}>{am.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className={tc.authModes.length > 1 ? '' : 'col-span-2'}>
                          <label className="mb-1 block text-xs text-gray-400">
                            {cred?.exists ? 'Update Secret' : 'Secret'}
                          </label>
                          <input
                            type="password"
                            value={editSecret}
                            onChange={(e) => setEditSecret(e.target.value)}
                            placeholder={cred?.exists ? `Current: ${cred.masked}` : (tc.secretPlaceholder ?? 'Enter secret...')}
                            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Model selection */}
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Default Model</label>
                      {(tc.knownModels.length > 0 || discoveredModels.length > 0) ? (
                        <select
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">Select model...</option>
                          {[...tc.knownModels, ...discoveredModels].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          placeholder="Enter model name..."
                          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleSaveConfigure(provider)}
                        disabled={editSaving}
                        className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {editSaving ? 'Saving...' : 'Save'}
                      </button>

                      <button
                        onClick={() => handleTestConnection(provider)}
                        disabled={testingId === provider.id}
                        className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                      >
                        {testingId === provider.id ? 'Testing...' : 'Test Connection'}
                      </button>

                      {provider.type === 'ollama' && (
                        <button
                          onClick={() => handleDiscoverModels(provider)}
                          disabled={discoveringId === provider.id}
                          className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                        >
                          {discoveringId === provider.id ? 'Discovering...' : 'Discover Models'}
                        </button>
                      )}

                      {cred?.exists && (
                        <button
                          onClick={() => handleRemoveCredential(provider.type)}
                          className="rounded-md bg-red-600/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-600/30"
                        >
                          Remove Credential
                        </button>
                      )}
                    </div>

                    {/* Test result */}
                    {testResult && configuringId === provider.id && (
                      <div className={`rounded-md px-3 py-2 text-sm ${
                        testResult.success
                          ? 'bg-green-600/10 text-green-400'
                          : 'bg-red-600/10 text-red-400'
                      }`}>
                        {testResult.success ? '  ' : '  '}{testResult.message}
                      </div>
                    )}

                    {/* Discovered models (Ollama) */}
                    {discoveredModels.length > 0 && configuringId === provider.id && (
                      <div className="rounded-md bg-blue-600/10 px-3 py-2 text-sm text-blue-400">
                        Found {discoveredModels.length} model(s): {discoveredModels.join(', ')}
                      </div>
                    )}
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
// Section: Team Mode
// ---------------------------------------------------------------------------

const TEAM_MODE_DESCRIPTIONS: Record<string, string> = {
  lean: 'Single agent per ticket. No team discussions. Fastest and cheapest.',
  smart: 'Agents can initiate team discussions when facing design decisions. Different AI models provide diverse perspectives. (Recommended)',
  debate: 'Agents must discuss their approach with the team before implementing. Most thorough but slowest.',
};

function TeamModeSection({ config, onSave }: { config: DaemonConfig | undefined; onSave: () => void }) {
  const currentMode = config?.teamMode?.mode ?? 'lean';
  const threshold = config?.teamMode?.smartThreshold ?? 'high';
  const [saving, setSaving] = useState(false);

  const handleModeChange = async (mode: string) => {
    setSaving(true);
    try {
      await apiPatch('/config', { teamMode: { mode } });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  const handleThresholdChange = async (smartThreshold: string) => {
    setSaving(true);
    try {
      await apiPatch('/config', { teamMode: { mode: 'smart', smartThreshold } });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-8">
      <h3 className="mb-3 text-lg font-semibold">Team Mode</h3>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex gap-4">
          {['lean', 'smart', 'debate'].map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="team-mode"
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
          <div className="mt-4 border-t border-gray-700 pt-4">
            <label className="mb-1 block text-xs text-gray-400">Complexity Threshold</label>
            <select
              value={threshold}
              onChange={(e) => handleThresholdChange(e.target.value)}
              disabled={saving}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="low">Low — debate most tickets</option>
              <option value="medium">Medium — debate moderately complex tickets</option>
              <option value="high">High — debate only highly complex tickets</option>
            </select>
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500">
          {TEAM_MODE_DESCRIPTIONS[currentMode] ?? ''}
        </p>
      </div>
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
      <TeamModeSection config={config} onSave={reloadConfig} />
      <ApprovalSection config={config} onSave={reloadConfig} />
      <PRModeSection config={config} onSave={reloadConfig} />
    </div>
  );
}
