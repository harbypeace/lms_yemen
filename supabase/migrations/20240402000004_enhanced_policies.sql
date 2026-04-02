-- 15. Enhanced Membership and Tenant Policies

-- Memberships: Only school_admins can update or delete memberships in their tenant
CREATE POLICY "Admins can update memberships" ON memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.tenant_id = memberships.tenant_id
      AND m.user_id = auth.uid()
      AND m.role = 'school_admin'
    )
  );

CREATE POLICY "Admins can delete memberships" ON memberships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.tenant_id = memberships.tenant_id
      AND m.user_id = auth.uid()
      AND m.role = 'school_admin'
    )
  );

-- Tenants: Only owners or admins can update tenant info
CREATE POLICY "Admins can update tenant info" ON tenants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = tenants.id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'school_admin'
    )
  );
