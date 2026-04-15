-- Migration: Security Audit and Policy Hardening for New Schema

-- 1. Activities (formerly lesson_blocks)
-- Ensure students can view activities in lessons they have access to
CREATE POLICY "Users can view activities in their courses" ON activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      JOIN memberships ON memberships.tenant_id = courses.tenant_id
      WHERE activities.lesson_id = lessons.id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage activities" ON activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      JOIN memberships ON memberships.tenant_id = courses.tenant_id
      WHERE activities.lesson_id = lessons.id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('school_admin', 'teacher')
    )
  );

-- 2. Quiz Questions (formerly questions)
-- Rename policies if they exist, or create new ones
DROP POLICY IF EXISTS "Anyone can view questions of accessible quizzes" ON quiz_questions;
CREATE POLICY "Anyone can view questions of accessible quizzes" ON quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN memberships ON quizzes.tenant_id = memberships.tenant_id
      WHERE quizzes.quiz_id = quiz_questions.quiz_id
      AND memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage questions" ON quiz_questions;
CREATE POLICY "Admins can manage questions" ON quiz_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN memberships ON quizzes.tenant_id = memberships.tenant_id
      WHERE quizzes.quiz_id = quiz_questions.quiz_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('school_admin', 'teacher')
    )
  );

-- 3. Quiz Submissions (formerly quiz_attempts)
DROP POLICY IF EXISTS "Users can view their own attempts" ON quiz_submissions;
CREATE POLICY "Users can view their own submissions" ON quiz_submissions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own attempts" ON quiz_submissions;
CREATE POLICY "Users can insert their own submissions" ON quiz_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. User Progress (formerly progress)
DROP POLICY IF EXISTS "Users can manage their own progress" ON user_progress;
CREATE POLICY "Users can manage their own progress" ON user_progress
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Parents can view their children's progress" ON user_progress;
CREATE POLICY "Parents can view their children's progress" ON user_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_student
      WHERE parent_student.parent_id = auth.uid()
      AND parent_student.student_id = user_progress.user_id
    )
  );

-- 5. User Stats (formerly user_gamification)
DROP POLICY IF EXISTS "Users can view their own gamification stats" ON user_stats;
CREATE POLICY "Users can view their own stats" ON user_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Allow public viewing of stats for leaderboards if needed, or keep restricted
CREATE POLICY "Anyone in tenant can view stats for leaderboard" ON user_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m1.tenant_id = m2.tenant_id
      WHERE m1.user_id = auth.uid()
      AND m2.user_id = user_stats.user_id
    )
  );
