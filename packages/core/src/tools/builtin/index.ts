import type { Tool } from '../types.js';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { gitStatusTool } from './git-status.js';
import { gitDiffTool } from './git-diff.js';
import { gitCommitTool } from './git-commit.js';
import { gitLogTool } from './git-log.js';
import { terminalExecTool } from './terminal-exec.js';
import { githubPrTool } from './github-pr.js';
import { codeAnalyzeTool } from './code-analyze.js';

// Factory-based tools (require dependency injection)
export { createTicketCommentTool } from './ticket-comment.js';
export { createTicketReadCommentsTool } from './ticket-read-comments.js';

// ---------------------------------------------------------------------------
// All builtin tools (stateless — no DB dependency)
// ---------------------------------------------------------------------------

export const BUILTIN_TOOLS: Tool[] = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  gitStatusTool,
  gitDiffTool,
  gitCommitTool,
  gitLogTool,
  terminalExecTool,
  githubPrTool,
  codeAnalyzeTool,
];

// Re-export individual tools for selective imports
export {
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  gitStatusTool,
  gitDiffTool,
  gitCommitTool,
  gitLogTool,
  terminalExecTool,
  githubPrTool,
  codeAnalyzeTool,
};
