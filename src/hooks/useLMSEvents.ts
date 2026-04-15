import { useCallback } from 'react';
import { eventService, LMSEventParams } from '../services/eventService';
import { useAuth } from '../context/AuthContext';

export const useLMSEvents = () => {
  const { user, activeTenant } = useAuth();

  const emit = useCallback(async (params: Omit<LMSEventParams, 'tenantId'>) => {
    if (!user) return null;
    
    return eventService.dispatch({
      ...params,
      tenantId: activeTenant?.id
    });
  }, [user, activeTenant]);

  const trackLessonStart = useCallback((lessonId: string, courseId: string) => {
    return emit({
      eventType: 'lesson_started',
      entityType: 'lesson',
      entityId: lessonId,
      courseId
    });
  }, [emit]);

  const trackLessonComplete = useCallback((lessonId: string, courseId: string) => {
    return emit({
      eventType: 'lesson_completed',
      entityType: 'lesson',
      entityId: lessonId,
      courseId
    });
  }, [emit]);

  const trackQuizResult = useCallback((quizId: string, score: number, passed: boolean, courseId: string) => {
    return emit({
      eventType: passed ? 'quiz_passed' : 'quiz_failed',
      entityType: 'quiz',
      entityId: quizId,
      courseId,
      score,
      metadata: { passed }
    });
  }, [emit]);

  return {
    emit,
    trackLessonStart,
    trackLessonComplete,
    trackQuizResult
  };
};
