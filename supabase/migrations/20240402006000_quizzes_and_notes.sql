-- Migration: Flexible Quizzes and Notes

-- 1. Quizzes Table (Attachable to any entity)
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_type TEXT NOT NULL, -- 'course', 'module', 'lesson', etc.
  target_id UUID NOT NULL,
  passing_score INTEGER DEFAULT 70,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice', -- 'multiple_choice', 'true_false', 'short_answer'
  options JSONB DEFAULT '[]'::jsonb, -- Array of strings for choices
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Notes Table (Attachable to any entity)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, -- 'course', 'module', 'lesson', etc.
  target_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Policies for Quizzes
CREATE POLICY "Anyone in tenant can view quizzes" ON quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.tenant_id = quizzes.tenant_id 
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage quizzes" ON quizzes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.tenant_id = quizzes.tenant_id 
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('super_admin', 'school_admin', 'teacher')
    )
  );

-- Policies for Questions
CREATE POLICY "Anyone can view questions of accessible quizzes" ON questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN memberships ON quizzes.tenant_id = memberships.tenant_id
      WHERE quizzes.id = questions.quiz_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage questions" ON questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN memberships ON quizzes.tenant_id = memberships.tenant_id
      WHERE quizzes.id = questions.quiz_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('super_admin', 'school_admin', 'teacher')
    )
  );

-- Policies for Quiz Attempts
CREATE POLICY "Users can view their own attempts" ON quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts" ON quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for Notes
CREATE POLICY "Users can manage their own notes" ON notes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view public notes in their tenant" ON notes
  FOR SELECT USING (
    is_private = false 
    AND EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.tenant_id = notes.tenant_id 
      AND memberships.user_id = auth.uid()
    )
  );
