import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface TrackEventParams {
  eventType: 'lesson_completed' | 'quiz_passed' | 'course_completed';
  entityType?: 'lesson' | 'quiz' | 'course';
  entityId?: string;
  courseId?: string;
  unitId?: string;
  lessonId?: string;
  metadata?: Record<string, any>;
}

export const useGamification = () => {
  const { user, activeTenant } = useAuth();

  const trackEvent = useCallback(async (params: TrackEventParams) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('track_learning_event', {
        p_user_id: user.id,
        p_event_type: params.eventType,
        p_entity_type: params.entityType,
        p_entity_id: params.entityId,
        p_course_id: params.courseId,
        p_unit_id: params.unitId,
        p_lesson_id: params.lessonId,
        p_metadata: params.metadata || {},
        p_org_id: activeTenant?.id || user.id
      });

      if (error) {
        console.error('Error tracking gamification event:', error);
        return false;
      }

      return data as boolean;
    } catch (err) {
      console.error('Unexpected error tracking gamification event:', err);
      return false;
    }
  }, [user, activeTenant]);

  const checkCourseCompletion = useCallback(async (courseId: string) => {
    if (!user) return false;

    try {
      // 1. Get all lessons for this course
      const { data: lessons } = await supabase
        .from('modules')
        .select('lessons(id)')
        .eq('course_id', courseId);
      
      const allLessonIds = lessons?.flatMap(m => m.lessons.map((l: any) => l.id)) || [];
      if (allLessonIds.length === 0) return false;

      // 2. Get completed lessons for this user
      const { data: completed } = await supabase
        .from('progress')
        .select('lesson_id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .in('lesson_id', allLessonIds);
      
      const completedIds = completed?.map(p => p.lesson_id) || [];

      // 3. If all completed, trigger course_completed event
      if (completedIds.length === allLessonIds.length) {
        return await trackEvent({
          eventType: 'course_completed',
          entityType: 'course',
          entityId: courseId,
          courseId: courseId
        });
      }

      return false;
    } catch (err) {
      console.error('Error checking course completion:', err);
      return false;
    }
  }, [user, trackEvent]);

  return { trackEvent, checkCourseCompletion };
};
