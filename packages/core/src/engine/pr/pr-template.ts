/**
 * PR template generator — creates PR body from ticket and verification context.
 */
import type { VerificationResult } from '../types.js';
import type { TicketInfo } from './types.js';

export class PRTemplate {
  /**
   * Generate a PR body from ticket info and verification results.
   */
  generate(params: {
    ticket: TicketInfo;
    verificationResult: VerificationResult;
    changedFiles: string[];
  }): string {
    const sections: string[] = [];

    // Header
    sections.push(`## Ticket: ${params.ticket.title}`);
    sections.push(`**ID:** ${params.ticket.id}`);

    if (params.ticket.epicId) {
      sections.push(`**Epic:** ${params.ticket.epicId}`);
    }
    if (params.ticket.goalId) {
      sections.push(`**Goal:** ${params.ticket.goalId}`);
    }

    // Description
    sections.push('');
    sections.push('### Description');
    sections.push(params.ticket.description);

    // Verification results
    sections.push('');
    sections.push('### Verification Results');
    sections.push('');
    for (const check of params.verificationResult.checks) {
      const icon = check.passed ? '✅' : '❌';
      sections.push(`- ${icon} **${check.name}**${check.details ? `: ${check.details}` : ''}`);
    }

    // Changed files
    sections.push('');
    sections.push('### Changed Files');
    sections.push('');
    for (const file of params.changedFiles) {
      sections.push(`- \`${file}\``);
    }

    // Overall status
    sections.push('');
    const statusIcon = params.verificationResult.status === 'passed' ? '✅' : '❌';
    sections.push(`**Overall Status:** ${statusIcon} ${params.verificationResult.status}`);

    return sections.join('\n');
  }

  /**
   * Generate PR title from ticket info.
   */
  generateTitle(ticket: TicketInfo): string {
    return `feat(${ticket.id}): ${ticket.title}`;
  }
}
