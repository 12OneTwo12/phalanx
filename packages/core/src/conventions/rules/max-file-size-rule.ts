/**
 * Convention rule — flags files exceeding a maximum line count.
 */
import type { ConventionRule, ConventionViolation } from '../types.js';

const DEFAULT_MAX_LINES = 500;

export class MaxFileSizeRule implements ConventionRule {
  readonly name = 'max-file-size';
  readonly description = 'Files should not exceed maximum line count';
  readonly severity = 'warning' as const;

  constructor(private readonly maxLines: number = DEFAULT_MAX_LINES) {}

  validate(filePath: string, content: string): ConventionViolation[] {
    // Skip generated/config files
    if (filePath.endsWith('.lock') || filePath.endsWith('.json') || filePath.endsWith('.svg')) {
      return [];
    }

    const lineCount = content.split('\n').length;
    if (lineCount <= this.maxLines) return [];

    return [{
      file: filePath,
      rule: this.name,
      severity: this.severity,
      message: `File has ${lineCount} lines (max: ${this.maxLines}). Consider splitting into smaller modules`,
      suggestion: `Split into smaller files. Each file should focus on a single responsibility`,
    }];
  }
}
