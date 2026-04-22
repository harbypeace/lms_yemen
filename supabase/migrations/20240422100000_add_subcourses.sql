-- Add sub_courses table
CREATE TABLE IF NOT EXISTS sub_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT,
  img_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add sub_course_id to modules
ALTER TABLE modules ADD COLUMN IF NOT EXISTS sub_course_id UUID REFERENCES sub_courses(id) ON DELETE CASCADE;

-- Update RLS for sub_courses
ALTER TABLE sub_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_courses_public_read" ON sub_courses
  FOR SELECT USING (true);

CREATE POLICY "sub_courses_admin_all" ON sub_courses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'school_admin', 'teacher')
    )
  );
