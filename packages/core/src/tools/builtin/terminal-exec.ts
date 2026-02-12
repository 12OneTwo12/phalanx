import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_CHARS = 50_000;

// ---------------------------------------------------------------------------
// Command Allowlist
// ---------------------------------------------------------------------------

/** Commands allowed when allowlist mode is enabled */
const DEFAULT_ALLOWED_COMMANDS: string[] = [
  'npm', 'pnpm', 'yarn', 'node', 'npx',
  'tsc', 'eslint', 'prettier',
  'vitest', 'jest', 'mocha',
  'git', 'gh',
  'cat', 'ls', 'find', 'grep', 'head', 'tail', 'wc',
  'echo', 'pwd', 'which', 'env', 'printenv',
  'mkdir', 'touch', 'cp', 'mv', 'rm',
  'docker', 'docker-compose',
];

export interface TerminalSecurityConfig {
  /** When true, only allowed commands can be executed */
  allowlistMode: boolean;
  /** Additional commands to allow (extends default list) */
  customAllowlist?: string[];
}

/**
 * Check if a command contains shell command substitution ($() or backticks).
 * These are too complex to parse safely — reject when allowlist is active.
 */
function hasCommandSubstitution(command: string): boolean {
  return /\$\(/.test(command) || /`/.test(command);
}

/**
 * Extract the base command from each segment of a piped/chained command.
 * Returns all base commands found.
 */
function extractBaseCommands(command: string): string[] {
  // Split on pipes, &&, ||, ;, and newlines — extract the first word from each part.
  // Newlines are command separators in /bin/sh, so they MUST be split here
  // to prevent newline injection bypassing the allowlist.
  return command
    .split(/[\n|&;]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.split(/\s+/)[0]);
}

/**
 * Check if all commands in a pipeline are in the allowlist.
 */
export function isCommandAllowed(command: string, config: TerminalSecurityConfig): boolean {
  if (!config.allowlistMode) return true;
  // Block command substitution — too complex to parse safely
  if (hasCommandSubstitution(command)) return false;
  const allowed = [...DEFAULT_ALLOWED_COMMANDS, ...(config.customAllowlist ?? [])];
  const bases = extractBaseCommands(command);
  return bases.every(base => allowed.includes(base));
}

/** Dangerous command patterns that are always blocked */
const BLOCKED_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|--force\s+).*\//,  // rm -rf / variants
  /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+\/\s*$/,               // rm -r /
  /\bmkfs\b/,                                              // format filesystem
  /\bdd\s+.*of=\/dev\//,                                  // dd to device
  />\s*\/dev\/sd[a-z]/,                                    // redirect to disk
  /\b:()\s*\{\s*:\|\s*:&\s*\}\s*;?\s*:/,                  // fork bomb
  /\bcurl\b.*\|.*(ba)?sh\b/,                               // curl pipe to shell
  /\bwget\b.*\|.*(ba)?sh\b/,                               // wget pipe to shell
  /\bchmod\s+(-[a-zA-Z]*\s+)?777\s+\//,                  // chmod 777 /
  /\bchown\s+.*\s+\/\s*$/,                                // chown / root
];

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  command: z.string().describe('Shell command to execute'),
  timeout: z.number().optional().describe('Timeout in milliseconds (default: 120000)'),
};

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const terminalExecTool: Tool<typeof schema> = {
  name: 'terminal_exec',
  description:
    'Execute a shell command via /bin/sh. Returns combined stdout and stderr. ' +
    'Output is truncated if it exceeds 50 000 characters.',
  category: 'terminal',
  schema,

  async execute(
    params: z.infer<z.ZodObject<typeof schema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    // Check against blocked command patterns
    for (const pattern of BLOCKED_COMMAND_PATTERNS) {
      if (pattern.test(params.command)) {
        return {
          success: false,
          content: '',
          error: 'Command blocked: matches a dangerous command pattern',
        };
      }
    }

    // Enforce command allowlist via security policy or default config
    if (context.securityPolicy) {
      if (!context.securityPolicy.isCommandAllowed(params.command)) {
        return {
          success: false,
          content: '',
          error: 'Command blocked: not in the allowed commands list',
        };
      }
    } else if (!isCommandAllowed(params.command, { allowlistMode: true })) {
      return {
        success: false,
        content: '',
        error: 'Command blocked: not in the allowed commands list',
      };
    }

    try {
      const timeoutMs = params.timeout ?? context.timeout ?? DEFAULT_TIMEOUT_MS;

      const { stdout, stderr } = await execFileAsync('/bin/sh', ['-c', params.command], {
        cwd: context.workingDirectory,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
        env: {
          ...process.env,
          GIT_EDITOR: 'true',
          GIT_PAGER: 'cat',
          GIT_TERMINAL_PROMPT: '0',
        },
      });

      let output = (stdout + stderr).trim();
      if (output.length > MAX_OUTPUT_CHARS) {
        output = output.slice(0, MAX_OUTPUT_CHARS) + '\n... (output truncated)';
      }

      return { success: true, content: output || '(no output)' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // execFile error objects may include stdout/stderr
      const execErr = err as { stdout?: string; stderr?: string };
      const partial = ((execErr.stdout ?? '') + (execErr.stderr ?? '')).trim();
      const content = partial
        ? partial.slice(0, MAX_OUTPUT_CHARS)
        : '';
      return { success: false, content, error: msg };
    }
  },
};
