/**
 * E2E Integration: Goal → Decomposition → Approval → Execution → Verification → PR
 * Tests the full lifecycle from goal creation to ticket completion.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, type TestContext } from './helpers.js';
import { GoalManager } from '../../src/engine/goal-manager.js';
import {
  DecompositionService,
  ManualDecompositionStrategy,
} from '../../src/engine/decomposition-service.js';
import { ApprovalService } from '../../src/engine/approval-service.js';
import { AssignmentService } from '../../src/engine/assignment-service.js';
import { TicketStateMachine } from '../../src/engine/ticket-state-machine.js';

describe('Goal to PR Integration', () => {
  let ctx: TestContext;
  let goalManager: GoalManager;
  let decompositionService: DecompositionService;
  let approvalService: ApprovalService;
  let assignmentService: AssignmentService;

  beforeEach(() => {
    ctx = setupTestDb();
    goalManager = new GoalManager(ctx.repos.goal, ctx.repos.epic, ctx.repos.ticket);

    decompositionService = new DecompositionService(
      ctx.repos.goal,
      ctx.repos.epic,
      ctx.repos.ticket,
      new ManualDecompositionStrategy([
        {
          title: 'Auth System',
          description: 'User authentication',
          tickets: [
            {
              title: 'Implement login API',
              description: 'POST /api/login with JWT',
              priority: 'high',
              dependsOn: [],
              category: 'backend',
            },
            {
              title: 'Implement login UI',
              description: 'Login form component',
              priority: 'medium',
              dependsOn: ['Implement login API'],
              category: 'frontend',
            },
          ],
        },
      ]),
    );

    approvalService = new ApprovalService(ctx.repos.ticket);
    assignmentService = new AssignmentService(ctx.repos.ticket, ctx.repos.agent);

    // Create agents
    ctx.repos.agent.create({
      id: 'agent-be-1',
      role: 'backend',
      name: 'Backend Agent 1',
      status: 'idle',
    });
    ctx.repos.agent.create({
      id: 'agent-fe-1',
      role: 'frontend',
      name: 'Frontend Agent 1',
      status: 'idle',
    });
  });

  afterEach(() => {
    ctx.db.close();
  });

  it('should complete the full goal → ticket lifecycle', async () => {
    // 1. Create goal
    const goal = goalManager.create('Build authentication system');
    expect(goal.status).toBe('active');
    expect(goal.progress).toBe(0);

    // 2. Decompose goal into epics and tickets
    const result = await decompositionService.decompose(goal.id);
    expect(result.epics).toHaveLength(1);

    // 3. Verify tickets are pending approval
    const pending = ctx.repos.ticket.findByStatus('pending_approval');
    expect(pending).toHaveLength(2);

    // 4. Approve all tickets
    for (const ticket of pending) {
      approvalService.processApproval({ ticketId: ticket.id, decision: 'approve' });
    }
    const backlog = ctx.repos.ticket.findByStatus('backlog');
    expect(backlog).toHaveLength(2);

    // 5. Auto-assign backend ticket
    const beTicket = backlog.find((t) => t.title === 'Implement login API')!;
    const assignedAgentId = assignmentService.autoAssign(beTicket.id);
    expect(assignedAgentId).toBe('agent-be-1');

    // 6. Start execution (simulate)
    const assigned = ctx.repos.ticket.findById(beTicket.id)!;
    expect(assigned.status).toBe('assigned');
    const inProgressStatus = TicketStateMachine.transition(assigned.status, 'start');
    ctx.repos.ticket.update(beTicket.id, { status: inProgressStatus });

    // 7. Submit for verification
    const inProgress = ctx.repos.ticket.findById(beTicket.id)!;
    expect(inProgress.status).toBe('in_progress');
    const verificationStatus = TicketStateMachine.transition(inProgress.status, 'submit');
    ctx.repos.ticket.update(beTicket.id, { status: verificationStatus });

    // 8. Pass verification
    const inVerification = ctx.repos.ticket.findById(beTicket.id)!;
    expect(inVerification.status).toBe('verification');
    const doneStatus = TicketStateMachine.transition(inVerification.status, 'pass');
    ctx.repos.ticket.update(beTicket.id, { status: doneStatus, prUrl: 'https://github.com/test/repo/pull/1' });

    // 9. Verify final state
    const done = ctx.repos.ticket.findById(beTicket.id)!;
    expect(done.status).toBe('done');
    expect(done.prUrl).toBe('https://github.com/test/repo/pull/1');

    // 10. Check goal progress
    const progress = goalManager.calculateProgress(goal.id);
    expect(progress).toBe(50); // 1 of 2 tickets done
  });

  it('should handle ticket failure and retry', async () => {
    const goal = goalManager.create('Test failure flow');

    // Decompose
    await decompositionService.decompose(goal.id);
    const pending = ctx.repos.ticket.findByStatus('pending_approval');
    approvalService.processApproval({ ticketId: pending[0].id, decision: 'approve' });

    const ticket = ctx.repos.ticket.findByStatus('backlog')[0];
    assignmentService.autoAssign(ticket.id);

    // Start → error → failed
    ctx.repos.ticket.update(ticket.id, {
      status: TicketStateMachine.transition('assigned', 'start'),
    });
    ctx.repos.ticket.update(ticket.id, {
      status: TicketStateMachine.transition('in_progress', 'error'),
    });

    const failed = ctx.repos.ticket.findById(ticket.id)!;
    expect(failed.status).toBe('failed');

    // Retry
    const retryStatus = TicketStateMachine.transition('failed', 'retry');
    ctx.repos.ticket.update(ticket.id, { status: retryStatus });

    const retried = ctx.repos.ticket.findById(ticket.id)!;
    expect(retried.status).toBe('in_progress');
  });

  it('should handle approval with modifications', async () => {
    const goal = goalManager.create('Test modify flow');
    await decompositionService.decompose(goal.id);

    const pending = ctx.repos.ticket.findByStatus('pending_approval');
    approvalService.processApproval({
      ticketId: pending[0].id,
      decision: 'modify',
      modifications: {
        title: 'Updated title',
        priority: 'critical',
      },
    });

    const modified = ctx.repos.ticket.findById(pending[0].id)!;
    expect(modified.status).toBe('backlog');
    expect(modified.title).toBe('Updated title');
    expect(modified.priority).toBe('critical');
  });
});
