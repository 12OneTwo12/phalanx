/**
 * Convention injector — loads conventions from disk and injects into executor config.
 */
import { ConventionLoader } from '../conventions/loader.js';
import type { AgentTicketExecutorConfig } from './agent-ticket-executor.js';

/**
 * Build AgentTicketExecutorConfig with conventions loaded from the project directory.
 * Returns the config unchanged if no convention files exist.
 */
export function injectConventions(
  config: Omit<AgentTicketExecutorConfig, 'conventions'>,
  projectDir: string,
): AgentTicketExecutorConfig {
  const loader = new ConventionLoader(projectDir);
  const conventions = loader.formatForPrompt();
  return {
    ...config,
    conventions: conventions || undefined,
  };
}
