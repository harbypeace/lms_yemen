-- Migration: Adaptive Slide Engine

-- 1. User Learning Preferences
CREATE TABLE IF NOT EXISTS user_learning_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_style TEXT DEFAULT 'visual' CHECK (preferred_style IN ('visual', 'auditory', 'reading', 'kinesthetic')),
  difficulty_level TEXT DEFAULT 'intermediate' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  interests TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Lesson Adaptive Configuration
-- Extends lessons with metadata for the engine
CREATE TABLE IF NOT EXISTS lesson_adaptive_config (
  lesson_id UUID PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  learning_style TEXT DEFAULT 'visual' CHECK (learning_style IN ('visual', 'auditory', 'reading', 'kinesthetic')),
  required_plan TEXT DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  tags TEXT[] DEFAULT '{}',
  prerequisites UUID[] DEFAULT '{}', -- Array of lesson IDs
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Adaptive Branching Rules
-- Defines how to jump between lessons based on performance
CREATE TABLE IF NOT EXISTS adaptive_branching_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source_lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL, -- 'score_above', 'score_below', 'preference_match'
  condition_value JSONB NOT NULL,
  target_lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_learning_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_adaptive_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptive_branching_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own preferences" ON user_learning_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view lesson config" ON lesson_adaptive_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage lesson config" ON lesson_adaptive_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships 
      JOIN lessons ON lessons.id = lesson_adaptive_config.lesson_id
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE memberships.tenant_id = courses.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('super_admin', 'school_admin', 'teacher')
    )
  );

CREATE POLICY "Anyone can view branching rules" ON adaptive_branching_rules
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage branching rules" ON adaptive_branching_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.tenant_id = adaptive_branching_rules.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('super_admin', 'school_admin', 'teacher')
    )
  );
