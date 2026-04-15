-- Migration: Enhance lesson_blocks into activities

-- 1. Rename table and primary key
ALTER TABLE lesson_blocks RENAME TO activities;
ALTER TABLE activities RENAME COLUMN id TO activity_id;

-- 2. Rename columns for clarity
ALTER TABLE activities RENAME COLUMN type TO activity_type;
ALTER TABLE activities RENAME COLUMN content_json TO content;

-- 3. Drop old check constraint on type
ALTER TABLE activities DROP CONSTRAINT IF EXISTS lesson_blocks_type_check;

-- 4. Add new check constraint for expanded types
ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check 
CHECK (activity_type IN ('video', 'html', 'link', 'quiz', 'challenge', 'flashcards', 'text', 'pdf', 'embed'));

-- 5. Add new columns
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 10;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS time_estimate_minutes INTEGER;

-- 6. Re-apply RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- 7. Create activity_progress table to track completion per activity
CREATE TABLE IF NOT EXISTS activity_progress (
  progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(activity_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  score INTEGER,
  time_spent_seconds INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, activity_id)
);

ALTER TABLE activity_progress ENABLE ROW LEVEL SECURITY;

-- Basic policies
CREATE POLICY "Users can view their own activity progress" ON activity_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activity progress" ON activity_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activity progress" ON activity_progress FOR UPDATE USING (auth.uid() = user_id);
