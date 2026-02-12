/**
 * Channel configuration loader.
 *
 * Reads the `channels` section from `.phalanx/config.json` and provides
 * a typed ChannelsConfig object for the ChannelRegistry.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { ChannelsConfig } from '@phalanx/core';

/** Default channels config — web is always enabled. */
const DEFAULT_CHANNELS_CONFIG: ChannelsConfig = {
  web: { enabled: true },
};

/**
 * Load the channels configuration from `.phalanx/config.json`.
 * Falls back to default config (web-only) if not found or malformed.
 */
export function loadChannelsConfig(): ChannelsConfig {
  const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? process.cwd();
  const configPath = resolve(projectRoot, '.phalanx', 'config.json');

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CHANNELS_CONFIG };
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    const channels = raw?.channels;

    if (!channels || typeof channels !== 'object' || Array.isArray(channels)) {
      return { ...DEFAULT_CHANNELS_CONFIG };
    }

    // Ensure web is always present
    if (!channels.web) {
      channels.web = { enabled: true };
    }

    return channels as ChannelsConfig;
  } catch {
    return { ...DEFAULT_CHANNELS_CONFIG };
  }
}
