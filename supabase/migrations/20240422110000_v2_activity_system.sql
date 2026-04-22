-- Migration: Activity System V2
-- This migration implements the new activity_types and polymorphic activities schema.

-- 1. Create activity_types table
CREATE TABLE IF NOT EXISTS activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,        -- video, quiz, html
  schema jsonb NOT NULL,            -- data structure definition
  capabilities jsonb NOT NULL,      -- behavior flags (e.g., scoring: true, persistence: true)
  created_at timestamp DEFAULT now()
);

-- 2. Drop existing activities and progress to rebuild with new schema
DROP TABLE IF EXISTS activity_progress CASCADE;
DROP TABLE IF EXISTS activities CASCADE;

-- 3. Create new activities table
CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid REFERENCES activity_types(id) ON DELETE CASCADE,

  title text,
  data jsonb NOT NULL,             -- actual content data

  parent_type text CHECK (parent_type IN ('course','subcourse','unit','lesson')),
  parent_id uuid NOT NULL,

  order_index int DEFAULT 0,
  is_published boolean DEFAULT true,
  is_required boolean DEFAULT true,
  xp_reward integer DEFAULT 10,
  time_estimate_minutes integer,

  created_at timestamp DEFAULT now()
);

-- 4. Recreate activity_progress for the new activities table
CREATE TABLE activity_progress (
  progress_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  score integer,
  time_spent_seconds integer DEFAULT 0,
  completed_at timestamptz,
  UNIQUE(user_id, activity_id)
);

-- 5. Enable RLS
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_progress ENABLE ROW LEVEL SECURITY;

-- 6. Basic Policies
CREATE POLICY "Public read activity_types" ON activity_types FOR SELECT USING (true);
CREATE POLICY "Public read activities" ON activities FOR SELECT USING (true);

CREATE POLICY "Users can view their own activity progress" ON activity_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activity progress" ON activity_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activity progress" ON activity_progress FOR UPDATE USING (auth.uid() = user_id);

-- 7. Seed initial activity types
INSERT INTO activity_types (name, schema, capabilities) VALUES 
('video', '{"url": "string", "provider": "string"}', '{"autoplay": false, "scoring": false}'),
('quiz', '{"questions": "array"}', '{"scoring": true, "persistence": true}'),
('html', '{"html": "string", "css": "string"}', '{"scoring": false, "persistence": false}'),
('link', '{"url": "string", "label": "string"}', '{"external": true}'),
('pdf', '{"url": "string"}', '{"preview": true}'),
('embed', '{"url": "string"}', '{"iframe": true}');
