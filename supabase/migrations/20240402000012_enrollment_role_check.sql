-- Drop the old constraint
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_role_check;

-- Add the new constraint
ALTER TABLE enrollments ADD CONSTRAINT enrollments_role_check CHECK (role IN ('student', 'teacher', 'super_admin'));
