/**
 * Heartbeat report detail + user response processing.
 * Supports [Approve All] [Review Individually] [Later] user actions.
 */
import { getHeartbeatLogRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { eventBus } from '@/lib/event-bus';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Valid user response actions for heartbeat reports */
type HeartbeatAction = 'acknowledge' | 'approve_all' | 'review' | 'later';

const ACTION_TO_STATUS: Record<HeartbeatAction, 'acknowledged' | 'acted' | 'pending'> = {
  acknowledge: 'acknowledged',
  approve_all: 'acted',
  review: 'pending',
  later: 'pending',
};

const VALID_ACTIONS: HeartbeatAction[] = ['acknowledge', 'approve_all', 'review', 'later'];

/** GET /api/heartbeat/:id — get a single heartbeat report */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const repo = getHeartbeatLogRepository();
  const log = repo.findById(id);

  if (!log) return errorResponse('Heartbeat report not found', 404);
  return jsonResponse(log);
}

/** PATCH /api/heartbeat/:id — process user response to a heartbeat report */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<{ action: HeartbeatAction }>(request);

  if (!body?.action || !VALID_ACTIONS.includes(body.action)) {
    return errorResponse(
      `action must be one of: ${VALID_ACTIONS.join(', ')}`,
    );
  }

  const repo = getHeartbeatLogRepository();
  const existing = repo.findById(id);
  if (!existing) return errorResponse('Heartbeat report not found', 404);

  const newStatus = ACTION_TO_STATUS[body.action];

  // 'later' keeps status as pending — no update needed
  if (body.action === 'later') {
    return jsonResponse({ ...existing, action: 'later' });
  }

  // 'review' keeps status as pending but emits event for navigation
  if (body.action === 'review') {
    eventBus.emit('heartbeat:response', {
      heartbeatId: id,
      action: body.action,
      status: 'pending',
    });
    return jsonResponse({ ...existing, action: 'review' });
  }

  const updated = repo.update(id, { status: newStatus });
  if (!updated) return errorResponse('Failed to update heartbeat report', 500);

  eventBus.emit('heartbeat:response', {
    heartbeatId: id,
    action: body.action,
    status: newStatus,
  });

  return jsonResponse({ ...updated, action: body.action });
}
