-- Migration: Course Permissions System
-- This table allows fine-grained control over what roles can do with specific activity types per course.

CREATE TABLE IF NOT EXISTS course_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,

  role text,                -- student, teacher, school_admin
  activity_type text,       -- matches activity_types.name

  can_view boolean DEFAULT true,
  can_create boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  
  created_at timestamp DEFAULT now(),
  UNIQUE(course_id, role, activity_type)
);

-- Enable RLS
ALTER TABLE course_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read course_permissions" ON course_permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage course_permissions" ON course_permissions 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'school_admin')
    )
  );

-- Seed default permissions for common types
-- Note: This is an example, actual permissions depend on course config
-- By default, students can view everything but not create/edit
-- Teachers might be able to create/edit in their own courses (this logic can be expanded)
