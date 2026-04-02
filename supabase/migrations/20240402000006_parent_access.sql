-- 17. Parent-Student Relationship Policies
CREATE POLICY "Parents can manage their student links" ON parent_student
  FOR ALL USING (auth.uid() = parent_id);

CREATE POLICY "Students can view their parent links" ON parent_student
  FOR SELECT USING (auth.uid() = student_id);

-- 18. Update Progress Policies for Parent Access
CREATE POLICY "Parents can view their children's progress" ON progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_student
      WHERE parent_student.student_id = progress.user_id
      AND parent_student.parent_id = auth.uid()
    )
  );

-- 19. Update Profiles Policies for Parent Access
CREATE POLICY "Parents can view their children's profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_student
      WHERE parent_student.student_id = profiles.id
      AND parent_student.parent_id = auth.uid()
    )
  );

-- 20. Update Enrollments Policies for Parent Access
CREATE POLICY "Parents can view their children's enrollments" ON enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_student
      WHERE parent_student.student_id = enrollments.user_id
      AND parent_student.parent_id = auth.uid()
    )
  );
