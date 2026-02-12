/**
 * Team Lead Agent — agentic AI with full tool use capabilities.
 *
 * Wires AgentExecutor with BUILTIN_TOOLS (filesystem, git, terminal) +
 * DASHBOARD_TOOLS (goal/epic/ticket/agent/proposal DB operations) to give
 * the Team Lead real action-taking ability in the channel.
 *
 * Soul/Identity/Memory/Skills are loaded from `templates/team-lead/` via
 * SoulLoader. The Skills section is augmented with dashboard-specific DB
 * tool descriptions that the template doesn't know about.
 */
import * as path from 'node:path';
import {
  AgentExecutor,
  SoulLoader,
  ToolRegistry,
  BUILTIN_TOOLS,
  ConventionLoader,
  type LLMProvider,
  type AgentConfig,
  type AgentExecutionResult,
} from '@phalanx/core';
import { DASHBOARD_TOOLS } from './tools/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'team-lead';
  content: string;
}

export interface TeamLeadAgentConfig {
  maxIterations?: number;
  /** Override templates directory path (default: <projectRoot>/templates) */
  templatesDir?: string;
}

// ---------------------------------------------------------------------------
// Dashboard-specific skill augmentation
// ---------------------------------------------------------------------------

/**
 * Additional skills section appended to the template SKILLS.md.
 * Describes the dashboard DB tools that are only available in the channel context.
 */
const DASHBOARD_SKILLS_AUGMENTATION = `

## Dashboard Database Tools (Channel-Specific)

These tools manage the project database and are available in the channel context:

### Goal Management
- **goal_list** — List goals, optionally filtered by status
- **goal_create** — Create a new project goal
- **goal_update** — Update goal description, status, or progress
- **goal_delete** — Delete a goal (cascades to epics and tickets)

### Epic Management
- **epic_list** — List epics, optionally filtered by goalId
- **epic_create** — Create an epic under a goal
- **epic_update** — Update epic title, description, or status

### Ticket Management
- **ticket_list** — List tickets, filtered by status/epic/agent
- **ticket_create** — Create a ticket under an epic
- **ticket_update** — Update ticket status, priority, or assignment

### Agent Management
- **agent_list** — View team agents and their status
- **agent_update** — Update agent status or current ticket

### Proposal Management
- **proposal_list** — List proposals for user review
- **proposal_create** — Create a proposal (new_ticket, priority_change, improvement)
- **proposal_update** — Approve or reject a proposal

### Project Overview
- **project_stats** — Aggregated dashboard statistics
- **convention_list** — List project coding conventions

## Channel Interaction Guidelines
- Always use tools to take real actions — never output fake XML tags or pretend to use tools
- When the user asks about project state → use project_stats, goal_list, ticket_list
- When asked to create goals → use goal_create, then decompose into epics and tickets
- When asked about code → use file_read, code_analyze, terminal_exec
- Be concise — summarize what you did and the results
- Use Korean when the user writes in Korean, English when they write in English
- If a tool call fails, explain the error and suggest alternatives
`;

// ---------------------------------------------------------------------------
// Agent Factory
// ---------------------------------------------------------------------------

/**
 * Create a Team Lead agent instance that can be run against channel history.
 * Loads soul config from templates/team-lead/ and augments with DB tool skills.
 */
export function createTeamLeadAgent(
  provider: LLMProvider,
  model: string,
  config?: TeamLeadAgentConfig,
) {
  const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? process.cwd();
  const templatesDir = config?.templatesDir ?? path.join(projectRoot, 'templates');
  const soulLoader = new SoulLoader(templatesDir);
  const conventionLoader = new ConventionLoader(projectRoot);

  // Build tool registry with both builtin and dashboard tools
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerAll(BUILTIN_TOOLS);
  toolRegistry.registerAll(DASHBOARD_TOOLS);

  const executor = new AgentExecutor(provider, toolRegistry);

  return {
    async run(chatHistory: ChatMessage[]): Promise<AgentExecutionResult> {
      // Load soul config from templates/team-lead/
      const soul = await soulLoader.load('team-lead');

      // Augment skills with dashboard DB tool descriptions
      const augmentedSkills = soul.skills + DASHBOARD_SKILLS_AUGMENTATION;

      const task = formatChatAsTask(chatHistory);

      // Load project conventions (graceful skip if none exist)
      const conventions = conventionLoader.formatForPrompt() || undefined;

      const agentConfig: AgentConfig = {
        id: 'team-lead',
        role: 'team-lead',
        soul: {
          soul: soul.soul,
          identity: soul.identity,
          memory: soul.memory,
          skills: augmentedSkills,
        },
        model: {
          provider: provider.name,
          model,
          fullId: `${provider.name}/${model}`,
          resolvedFrom: 'system',
        },
        tools: {}, // empty = allow all tools
        workingDirectory: projectRoot,
        maxIterations: config?.maxIterations ?? 15,
        temperature: 0.3,
        conventions,
      };

      return executor.run(agentConfig, task);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format channel chat history as a task string for the agent.
 * Includes recent messages as context so the LLM understands the conversation.
 */
function formatChatAsTask(history: ChatMessage[]): string {
  const recent = history.slice(-30);

  if (recent.length === 0) return 'No messages yet.';

  const formatted = recent.map((m) => {
    const role = m.role === 'user' ? 'User' : 'Team Lead';
    return `**${role}**: ${m.content}`;
  });

  return `Here is the recent channel conversation. Respond to the latest user message using your tools as needed.\n\n${formatted.join('\n\n')}`;
}
