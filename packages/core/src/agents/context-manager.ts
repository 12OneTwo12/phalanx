/**
 * ContextManager — monitors and manages context window usage.
 *
 * Estimates token counts, warns at configurable thresholds, and prunes
 * old messages when the context window is nearly full.
 */
import type { Message } from '../llm/types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ContextManagerConfig {
  /** Maximum context window size in tokens */
  contextWindowSize: number;
  /** Warn when usage exceeds this fraction (default: 0.7) */
  warningThreshold: number;
  /** Critical threshold triggering pruning (default: 0.85) */
  criticalThreshold: number;
  /** Average characters per token for estimation (default: 4) */
  charsPerToken: number;
}

const DEFAULT_CONFIG: ContextManagerConfig = {
  contextWindowSize: 200_000,
  warningThreshold: 0.7,
  criticalThreshold: 0.85,
  charsPerToken: 4,
};

export type ContextPressure = 'low' | 'warning' | 'critical' | 'exceeded';

// ---------------------------------------------------------------------------
// ContextManager
// ---------------------------------------------------------------------------

export class ContextManager {
  private readonly config: ContextManagerConfig;

  constructor(config?: Partial<ContextManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Estimate token count for a message array.
   * Uses a simple characters/4 heuristic (good enough for management decisions).
   */
  estimateTokens(messages: Message[]): number {
    let totalChars = 0;

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else {
        // MessageContent array
        for (const item of msg.content) {
          if (item.type === 'text') {
            totalChars += item.text.length;
          } else if (item.type === 'tool_use') {
            totalChars += JSON.stringify(item.input).length + item.name.length;
          } else if (item.type === 'tool_result') {
            totalChars += item.content.length;
          } else {
            // Unknown content type — estimate via serialization as safety fallback
            totalChars += JSON.stringify(item).length;
          }
        }
      }
    }

    return Math.ceil(totalChars / this.config.charsPerToken);
  }

  /**
   * Check the current context pressure level.
   */
  checkPressure(messages: Message[], systemPromptTokens: number = 0): ContextPressure {
    const estimated = this.estimateTokens(messages) + systemPromptTokens;
    const ratio = estimated / this.config.contextWindowSize;

    if (ratio >= 1.0) return 'exceeded';
    if (ratio >= this.config.criticalThreshold) return 'critical';
    if (ratio >= this.config.warningThreshold) return 'warning';
    return 'low';
  }

  /**
   * Prune messages to fit within the context window.
   *
   * Strategy:
   * 1. Always preserve the first message (task prompt) and last N messages
   * 2. Remove oldest tool_result contents first (replace with summaries)
   * 3. Remove oldest conversation turns if still over limit
   */
  prune(
    messages: Message[],
    systemPromptTokens: number = 0,
    preserveLastN: number = 6,
  ): Message[] {
    const target = Math.floor(this.config.contextWindowSize * this.config.criticalThreshold);
    let current = this.estimateTokens(messages) + systemPromptTokens;

    if (current <= target) return messages;

    const result = [...messages];

    // Phase 1: Truncate old tool results (keep first and last N)
    const startIdx = 1; // preserve first message
    const endIdx = Math.max(startIdx, result.length - preserveLastN);

    for (let i = startIdx; i < endIdx && current > target; i++) {
      const msg = result[i];
      if (typeof msg.content !== 'string' && Array.isArray(msg.content)) {
        const before = this.estimateMessageTokens(msg);
        // Create a new message object to avoid mutating the original
        result[i] = {
          ...msg,
          content: msg.content.map((item) => {
            if (item.type === 'tool_result' && item.content.length > 200) {
              return { ...item, content: '[pruned — tool output truncated]' };
            }
            return item;
          }),
        };
        const after = this.estimateMessageTokens(result[i]);
        current -= (before - after);
      }
    }

    if (current <= target) return result;

    // Phase 2: Remove entire old turns (keep first and last N)
    const pruned: Message[] = [
      result[0],
      { role: 'user' as const, content: '[Earlier conversation pruned to fit context window]' },
      ...result.slice(Math.max(1, result.length - preserveLastN)),
    ];

    return pruned;
  }

  /** Get the remaining token budget */
  remainingBudget(messages: Message[], systemPromptTokens: number = 0): number {
    const used = this.estimateTokens(messages) + systemPromptTokens;
    return Math.max(0, this.config.contextWindowSize - used);
  }

  private estimateMessageTokens(msg: Message): number {
    return this.estimateTokens([msg]);
  }
}
