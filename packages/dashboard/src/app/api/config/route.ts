import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { findProjectRoot } from '@/lib/convention-sync';

function getConfigPath(): string {
  const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? findProjectRoot(process.cwd());
  return resolve(projectRoot, '.phalanx', 'config.json');
}

function loadConfig(): Record<string, unknown> {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config: Record<string, unknown>): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/** GET /api/config — return daemon config (approval, pr) */
export async function GET() {
  const config = loadConfig();
  const daemon = (config.daemon ?? {}) as Record<string, unknown>;
  return jsonResponse({
    approval: daemon.approval ?? { mode: 'manual' },
    pr: daemon.pr ?? { mode: 'manual' },
    teamMode: daemon.teamMode ?? { mode: 'lean', smartThreshold: 'high', agentsPerRole: 2 },
  });
}

/** PATCH /api/config — deep-merge body into daemon section */
export async function PATCH(request: Request) {
  const body = await parseBody<{
    approval?: { mode: string };
    pr?: { mode: string; smartRules?: Record<string, unknown> };
    teamMode?: { mode: string; smartThreshold?: string; agentsPerRole?: number };
  }>(request);
  if (!body) return errorResponse('Request body is required');

  const config = loadConfig();
  const daemon = (config.daemon ?? {}) as Record<string, unknown>;

  if (body.approval) {
    daemon.approval = { ...(daemon.approval as Record<string, unknown> ?? {}), ...body.approval };
  }
  if (body.pr) {
    const existingPr = (daemon.pr ?? {}) as Record<string, unknown>;
    const newPr = { ...existingPr, ...body.pr };
    if (body.pr.smartRules) {
      newPr.smartRules = { ...(existingPr.smartRules as Record<string, unknown> ?? {}), ...body.pr.smartRules };
    }
    daemon.pr = newPr;
  }
  if (body.teamMode) {
    daemon.teamMode = { ...(daemon.teamMode as Record<string, unknown> ?? {}), ...body.teamMode };
  }

  config.daemon = daemon;
  saveConfig(config);

  return jsonResponse({
    approval: daemon.approval ?? { mode: 'manual' },
    pr: daemon.pr ?? { mode: 'manual' },
    teamMode: daemon.teamMode ?? { mode: 'lean', smartThreshold: 'high', agentsPerRole: 2 },
  });
}
