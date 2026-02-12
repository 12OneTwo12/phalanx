import type { Tool } from '@phalanx/core';
import { goalListTool, goalCreateTool, goalUpdateTool, goalDeleteTool } from './goal-tools';
import { epicListTool, epicCreateTool, epicUpdateTool } from './epic-tools';
import { ticketListTool, ticketCreateTool, ticketUpdateTool } from './ticket-tools';
import { agentListTool, agentUpdateTool } from './agent-tools';
import { proposalListTool, proposalCreateTool, proposalUpdateTool } from './proposal-tools';
import { projectStatsTool, conventionListTool } from './project-stats-tools';
import { skillListTool, skillReadTool, skillCreateTool, skillUpdateTool, skillDeleteTool } from './skill-tools';

/** All dashboard-specific tools (DB operations for Team Lead agent) */
export const DASHBOARD_TOOLS: Tool[] = [
  // Goal management
  goalListTool,
  goalCreateTool,
  goalUpdateTool,
  goalDeleteTool,
  // Epic management
  epicListTool,
  epicCreateTool,
  epicUpdateTool,
  // Ticket management
  ticketListTool,
  ticketCreateTool,
  ticketUpdateTool,
  // Agent management
  agentListTool,
  agentUpdateTool,
  // Proposal management
  proposalListTool,
  proposalCreateTool,
  proposalUpdateTool,
  // Project overview
  projectStatsTool,
  conventionListTool,
  // Skill management
  skillListTool,
  skillReadTool,
  skillCreateTool,
  skillUpdateTool,
  skillDeleteTool,
];
