/**
 * PR controller — decides PR handling mode (manual/smart/auto).
 */
import type { PRContext, PRDecision, PRMode } from './types.js';
import type { SmartModeEngine } from './smart-mode-rules.js';

export class PRController {
  constructor(
    private mode: PRMode,
    private readonly smartEngine?: SmartModeEngine,
  ) {}

  /** Get current mode */
  getMode(): PRMode {
    return this.mode;
  }

  /** Set mode */
  setMode(mode: PRMode): void {
    this.mode = mode;
  }

  /**
   * Decide how to handle a PR based on the current mode and context.
   */
  decide(context: PRContext): { decision: PRDecision; reasons: string[] } {
    switch (this.mode) {
      case 'manual':
        return { decision: 'manual_review', reasons: ['Mode is manual'] };

      case 'auto':
        if (context.verificationResult.status === 'passed') {
          return { decision: 'auto_merge', reasons: ['Mode is auto, verification passed'] };
        }
        return { decision: 'manual_review', reasons: ['Mode is auto but verification failed'] };

      case 'smart': {
        if (!this.smartEngine) {
          return { decision: 'manual_review', reasons: ['Smart mode but no engine configured'] };
        }
        const result = this.smartEngine.evaluate(context);
        if (result.allowed && context.verificationResult.status === 'passed') {
          return { decision: 'auto_merge', reasons: ['All smart mode rules passed'] };
        }
        return {
          decision: 'manual_review',
          reasons: result.reasons.length > 0
            ? result.reasons
            : ['Verification did not pass'],
        };
      }

      default:
        return { decision: 'manual_review', reasons: [`Unknown mode: ${this.mode}`] };
    }
  }
}
