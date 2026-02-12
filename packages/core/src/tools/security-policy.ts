/**
 * SecurityPolicy — unified interface for command and path security enforcement.
 *
 * Consolidates the security checks from path-utils.ts and terminal-exec.ts
 * into a single injectable policy that can be extended per-project.
 */
import { isSensitivePath, resolveSafePath } from './builtin/path-utils.js';
import { isCommandAllowed, type TerminalSecurityConfig } from './builtin/terminal-exec.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SecurityPolicy {
  /** Check if a file path is allowed for read/write operations */
  isPathAllowed(absolutePath: string): boolean;
  /** Check if a terminal command is allowed for execution */
  isCommandAllowed(command: string): boolean;
  /** Resolve a path safely within the working directory (returns null if blocked) */
  resolveSafePath(filePath: string, workingDirectory: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface SecurityConfig {
  /** Additional file patterns to block (glob-like basename patterns) */
  blockedPaths: string[];
  /** Additional commands to allow beyond defaults */
  allowedCommands: string[];
  /** When true, only allowlisted commands can execute (default: true) */
  allowlistMode: boolean;
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  blockedPaths: [],
  allowedCommands: [],
  allowlistMode: true,
};

// ---------------------------------------------------------------------------
// Default Implementation
// ---------------------------------------------------------------------------

export class DefaultSecurityPolicy implements SecurityPolicy {
  private readonly config: SecurityConfig;
  private readonly terminalConfig: TerminalSecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.terminalConfig = {
      allowlistMode: this.config.allowlistMode,
      customAllowlist: this.config.allowedCommands,
    };
  }

  isPathAllowed(absolutePath: string): boolean {
    return !isSensitivePath(absolutePath, this.config.blockedPaths);
  }

  isCommandAllowed(command: string): boolean {
    return isCommandAllowed(command, this.terminalConfig);
  }

  async resolveSafePath(filePath: string, workingDirectory: string): Promise<string | null> {
    // Pre-check: reject obviously sensitive paths before resolution
    if (isSensitivePath(filePath, this.config.blockedPaths)) return null;
    const resolved = await resolveSafePath(filePath, workingDirectory);
    if (resolved === null) return null;
    // Post-check: reject if resolved path (after symlink resolution) is sensitive
    if (isSensitivePath(resolved, this.config.blockedPaths)) return null;
    return resolved;
  }
}
