import { describe, it, expect } from 'vitest';
import { PRTemplate } from '../../../src/engine/pr/pr-template.js';

describe('PRTemplate', () => {
  const template = new PRTemplate();
  const ticket = { id: 't1', title: 'Add Login', description: 'Login feature', epicId: 'e1', goalId: 'g1' };
  const verification = {
    ticketId: 't1', status: 'passed' as const,
    checks: [
      { name: 'test-runner', passed: true, details: 'All tests passed' },
      { name: 'lint', passed: false, details: 'Errors found' },
    ],
  };

  it('should generate PR body with all sections', () => {
    const body = template.generate({ ticket, verificationResult: verification, changedFiles: ['a.ts', 'b.ts'] });
    expect(body).toContain('Add Login');
    expect(body).toContain('✅ **test-runner**');
    expect(body).toContain('❌ **lint**');
    expect(body).toContain('`a.ts`');
    expect(body).toContain('e1');
    expect(body).toContain('g1');
  });

  it('should generate title from ticket', () => {
    expect(template.generateTitle(ticket)).toBe('feat(t1): Add Login');
  });
});
