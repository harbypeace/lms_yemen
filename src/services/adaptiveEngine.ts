import { supabase } from '../lib/supabase';

export interface AdaptiveState {
  currentLessonId: string;
  performance: number; // 0-100
  preferences: {
    style: string;
    difficulty: string;
  };
  subscriptionPlan: string;
}

export const adaptiveEngine = {
  /**
   * Calculates the next lesson for a user based on their performance and preferences
   */
  async getNextLesson(userId: string, currentLessonId: string, tenantId: string): Promise<string | null> {
    try {
      // 1. Get User Preferences
      const { data: prefs } = await supabase
        .from('user_learning_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      // 2. Get User Subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_name')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .maybeSingle();

      const plan = sub?.plan_name || 'free';

      // 3. Get Latest Performance from activities or quizzes
      let score = 0;
      
      // Check activity_progress first (new system)
      const { data: qAct } = await supabase
        .from('activities')
        .select('id')
        .eq('parent_id', currentLessonId)
        .eq('parent_type', 'lesson')
        // Filter by quiz type if joined
        .single(); // Simplified for now, in reality might check activity_types

      if (qAct) {
        const { data: actProg } = await supabase
          .from('activity_progress')
          .select('score')
          .eq('user_id', userId)
          .eq('activity_id', qAct.id)
          .maybeSingle();
        
        if (actProg?.score !== undefined) score = actProg.score;
      }

      // Fallback/Overlap with old system
      if (score === 0) {
        const { data: quiz } = await supabase
          .from('quizzes')
          .select('quiz_id')
          .eq('lesson_id', currentLessonId)
          .maybeSingle();

        if (quiz) {
          const { data: lastAttempt } = await supabase
            .from('quiz_submissions')
            .select('score, passed')
            .eq('user_id', userId)
            .eq('quiz_id', quiz.quiz_id)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          score = lastAttempt?.score || 0;
        }
      }

      // 4. Check Branching Rules
      const { data: rules } = await supabase
        .from('adaptive_branching_rules')
        .select('*')
        .eq('source_lesson_id', currentLessonId)
        .order('priority', { ascending: false });

      if (rules && rules.length > 0) {
        for (const rule of rules) {
          if (this.evaluateCondition(rule.condition_type, rule.condition_value, score, prefs)) {
            // Check if target lesson is accessible via subscription
            const isAccessible = await this.checkAccess(rule.target_lesson_id, plan);
            if (isAccessible) return rule.target_lesson_id;
          }
        }
      }

      // 5. Fallback: Get next lesson by order_index in the same module
      const { data: currentLesson } = await supabase
        .from('lessons')
        .select('module_id, order_index')
        .eq('id', currentLessonId)
        .single();

      if (currentLesson) {
        const { data: nextLesson } = await supabase
          .from('lessons')
          .select('id')
          .eq('module_id', currentLesson.module_id)
          .gt('order_index', currentLesson.order_index)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextLesson) {
          const isAccessible = await this.checkAccess(nextLesson.id, plan);
          return isAccessible ? nextLesson.id : null;
        }
      }

      return null;
    } catch (err) {
      console.error('Adaptive Engine Error:', err);
      return null;
    }
  },

  evaluateCondition(type: string, value: any, score: number, prefs: any): boolean {
    switch (type) {
      case 'score_above':
        return score >= (value.threshold || 0);
      case 'score_below':
        return score < (value.threshold || 0);
      case 'preference_match':
        return prefs?.preferred_style === value.style;
      default:
        return false;
    }
  },

  async checkAccess(lessonId: string, userPlan: string): Promise<boolean> {
    const { data: config } = await supabase
      .from('lesson_adaptive_config')
      .select('required_plan')
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (!config) return true; // Default to accessible

    const planHierarchy: Record<string, number> = { 'free': 0, 'pro': 1, 'enterprise': 2 };
    const userLevel = planHierarchy[userPlan] || 0;
    const requiredLevel = planHierarchy[config.required_plan] || 0;

    return userLevel >= requiredLevel;
  }
};
