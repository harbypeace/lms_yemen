-- Migration: Update profiles policy for leaderboard visibility

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create a new policy that allows viewing profiles of users who share a tenant
CREATE POLICY "Users can view profiles in their tenants" ON profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.tenant_id = m2.tenant_id
    WHERE m1.user_id = auth.uid()
    AND m2.user_id = profiles.id
  )
);

-- Also allow super_admins to see all profiles
CREATE POLICY "Super admins can view all profiles" ON profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);
