/**
 * MeetingOrchestrator — manages team meetings with auto-generated minutes.
 *
 * Supports standup, review, planning, and retrospective meeting types.
 * Each meeting tracks participants and their contributions, and can
 * generate meeting minutes.
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { MeetingRepository } from '../db/repositories/meeting.repository.js';
import type { MeetingParticipantRepository } from '../db/repositories/meeting-participant.repository.js';
import type { Meeting, MeetingParticipant } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeetingOrchestratorDeps {
  meetingRepo: MeetingRepository;
  participantRepo: MeetingParticipantRepository;
}

export interface MeetingConfig {
  title: string;
  type: 'standup' | 'review' | 'planning' | 'retrospective';
  facilitatorId?: string;
  agenda?: string;
}

export interface MeetingEvents {
  'meeting:scheduled': [{ meetingId: string; title: string; type: string }];
  'meeting:started': [{ meetingId: string }];
  'meeting:contribution': [{ meetingId: string; agentId: string }];
  'meeting:completed': [{ meetingId: string; summary: string }];
}

// ---------------------------------------------------------------------------
// MeetingOrchestrator
// ---------------------------------------------------------------------------

export class MeetingOrchestrator extends EventEmitter<MeetingEvents> {
  constructor(private readonly deps: MeetingOrchestratorDeps) {
    super();
  }

  /** Schedule a new meeting. */
  scheduleMeeting(config: MeetingConfig): Meeting {
    const meeting = this.deps.meetingRepo.create({
      id: randomUUID(),
      title: config.title,
      type: config.type,
      status: 'scheduled',
      facilitatorId: config.facilitatorId ?? null,
      agenda: config.agenda ?? null,
    });
    this.emit('meeting:scheduled', { meetingId: meeting.id, title: config.title, type: config.type });
    return meeting;
  }

  /** Start a scheduled meeting. */
  startMeeting(meetingId: string): Meeting | undefined {
    const meeting = this.deps.meetingRepo.findById(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);
    if (meeting.status !== 'scheduled') throw new Error(`Meeting ${meetingId} is not scheduled`);

    const updated = this.deps.meetingRepo.update(meetingId, { status: 'active' });
    this.emit('meeting:started', { meetingId });
    return updated;
  }

  /** Add a participant contribution to an active meeting. */
  addContribution(
    meetingId: string,
    agentId: string,
    role: string,
    contributions: string,
  ): MeetingParticipant {
    const meeting = this.deps.meetingRepo.findById(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    // Check if participant already exists; update if so
    const existing = this.deps.participantRepo.findByMeetingId(meetingId)
      .find(p => p.agentId === agentId);

    if (existing) {
      const updated = this.deps.participantRepo.update(existing.id, { contributions });
      this.emit('meeting:contribution', { meetingId, agentId });
      return updated!;
    }

    const participant = this.deps.participantRepo.create({
      id: randomUUID(),
      meetingId,
      agentId,
      role,
      contributions,
    });
    this.emit('meeting:contribution', { meetingId, agentId });
    return participant;
  }

  /** Complete a meeting with minutes and summary. */
  completeMeeting(meetingId: string, minutes: string, summary: string): Meeting | undefined {
    const meeting = this.deps.meetingRepo.findById(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    const updated = this.deps.meetingRepo.update(meetingId, {
      status: 'completed',
      minutes,
      summary,
    });
    this.emit('meeting:completed', { meetingId, summary });
    return updated;
  }

  /** Get all participants for a meeting. */
  getParticipants(meetingId: string): MeetingParticipant[] {
    return this.deps.participantRepo.findByMeetingId(meetingId);
  }

  /** Get meetings by status. */
  findByStatus(status: Meeting['status']): Meeting[] {
    return this.deps.meetingRepo.findByStatus(status);
  }
}
