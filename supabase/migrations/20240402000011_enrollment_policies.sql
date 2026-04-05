-- Allow users to view their own enrollments
CREATE POLICY "Users can view their own enrollments" ON enrollments
  FOR SELECT USING (auth.uid() = user_id);

-- Allow admins and teachers to view all enrollments in their tenant
CREATE POLICY "Admins and teachers can view tenant enrollments" ON enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = enrollments.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('super_admin', 'school_admin', 'teacher')
    )
  );

-- Allow users to enroll themselves as students or if they are super_admins
CREATE POLICY "Users can enroll themselves" ON enrollments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND (role = 'student' OR EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = enrollments.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'super_admin'
    ))
    AND EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = enrollments.tenant_id
      AND memberships.user_id = auth.uid()
    )
  );

-- Allow admins and teachers to manage enrollments
CREATE POLICY "Admins and teachers can manage enrollments" ON enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = enrollments.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('super_admin', 'school_admin', 'teacher')
    )
  );
