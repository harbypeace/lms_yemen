-- 11. Trigger for default tenant creation
CREATE OR REPLACE FUNCTION public.handle_new_user_tenant()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
  tenant_name TEXT;
  tenant_slug TEXT;
BEGIN
  tenant_name := COALESCE(new.raw_user_meta_data->>'full_name', 'My School');
  tenant_slug := LOWER(REPLACE(tenant_name, ' ', '-')) || '-' || SUBSTRING(new.id::text, 1, 8);

  -- Create a default tenant for the user
  INSERT INTO public.tenants (name, slug, owner_id)
  VALUES (tenant_name, tenant_slug, new.id)
  RETURNING id INTO new_tenant_id;

  -- Assign the user as school_admin of their new tenant
  INSERT INTO public.memberships (user_id, tenant_id, role)
  VALUES (new.id, new_tenant_id, 'school_admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to avoid errors on push
DROP TRIGGER IF EXISTS on_auth_user_created_tenant ON auth.users;
CREATE TRIGGER on_auth_user_created_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_tenant();

-- 12. Additional RLS Policies

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Memberships: Users can view memberships in their tenants
CREATE POLICY "Users can view memberships in their tenants" ON memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.tenant_id = memberships.tenant_id
      AND m.user_id = auth.uid()
    )
  );

-- Courses: Users can view courses in their tenants
CREATE POLICY "Users can view courses in their tenants" ON courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = courses.tenant_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Teachers can manage courses" ON courses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = courses.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('school_admin', 'teacher')
    )
  );

-- Modules, Lessons, Lesson Blocks: Inherit from course access
CREATE POLICY "Users can view modules in their courses" ON modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses
      JOIN memberships ON memberships.tenant_id = courses.tenant_id
      WHERE courses.id = modules.course_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view lessons in their courses" ON lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses
      JOIN modules ON modules.course_id = courses.id
      JOIN memberships ON memberships.tenant_id = courses.tenant_id
      WHERE lessons.module_id = modules.id
      AND memberships.user_id = auth.uid()
    )
  );

-- Progress: Users can manage their own progress
CREATE POLICY "Users can manage their own progress" ON progress
  FOR ALL USING (auth.uid() = user_id);
