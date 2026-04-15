import { supabase } from '../lib/supabase';

export interface LMSEventParams {
  eventType: string;
  entityType?: 'lesson' | 'quiz' | 'course' | 'system';
  entityId?: string;
  courseId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  isPublic?: boolean;
  score?: number;
  maxScore?: number;
  duration?: string;
}

class EventService {
  private async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Dispatches a unified event to the backend.
   * This automatically handles xAPI, Gamification, and Webhooks.
   */
  async dispatch(params: LMSEventParams) {
    const session = await this.getSession();
    if (!session) return null;

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`Event dispatch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Event Service Error:', err);
      return null;
    }
  }

  // Helper methods for common events
  async lessonStarted(lessonId: string, courseId: string, tenantId: string) {
    return this.dispatch({
      eventType: 'lesson_started',
      entityType: 'lesson',
      entityId: lessonId,
      courseId,
      tenantId
    });
  }

  async lessonCompleted(lessonId: string, courseId: string, tenantId: string) {
    return this.dispatch({
      eventType: 'lesson_completed',
      entityType: 'lesson',
      entityId: lessonId,
      courseId,
      tenantId
    });
  }

  async quizPassed(quizId: string, score: number, courseId: string, tenantId: string) {
    return this.dispatch({
      eventType: 'quiz_passed',
      entityType: 'quiz',
      entityId: quizId,
      courseId,
      tenantId,
      score,
      metadata: { passed: true }
    });
  }

  async quizFailed(quizId: string, score: number, courseId: string, tenantId: string) {
    return this.dispatch({
      eventType: 'quiz_failed',
      entityType: 'quiz',
      entityId: quizId,
      courseId,
      tenantId,
      score,
      metadata: { passed: false }
    });
  }
}

export const eventService = new EventService();
