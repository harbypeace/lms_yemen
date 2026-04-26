-- Migration: Add Grade, Subject and Status to courses
-- Date: 2024-04-24

ALTER TABLE courses ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- Create an index for searching
CREATE INDEX IF NOT EXISTS idx_courses_grade ON courses(grade);
CREATE INDEX IF NOT EXISTS idx_courses_subject ON courses(subject);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
