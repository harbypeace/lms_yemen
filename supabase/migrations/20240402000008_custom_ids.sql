-- Migration: Custom IDs and Parent Selection Support

-- 1. Add custom_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_id TEXT UNIQUE;

-- 2. Create tenant_sequences table to track serial numbers per tenant and role
CREATE TABLE IF NOT EXISTS tenant_sequences (
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  next_val INTEGER DEFAULT 1000,
  PRIMARY KEY (tenant_id, role)
);

-- 3. Function to generate custom_id
-- Format: [ROLE_PREFIX][TENANT_ID_SHORT]-[SERIAL]
-- Example: STU-ABC1-1001, PAR-ABC1-1001
CREATE OR REPLACE FUNCTION generate_custom_id(p_user_id UUID, p_tenant_id UUID, p_role TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_tenant_short TEXT;
  v_serial INTEGER;
  v_custom_id TEXT;
BEGIN
  -- Determine prefix
  v_prefix := CASE 
    WHEN p_role = 'student' THEN 'STU'
    WHEN p_role = 'parent' THEN 'PAR'
    WHEN p_role = 'teacher' THEN 'TEA'
    WHEN p_role = 'school_admin' THEN 'ADM'
    ELSE 'USR'
  END;

  -- Get short tenant ID (first 4 chars of UUID)
  v_tenant_short := UPPER(SUBSTRING(p_tenant_id::TEXT FROM 1 FOR 4));

  -- Get and increment serial number
  INSERT INTO tenant_sequences (tenant_id, role, next_val)
  VALUES (p_tenant_id, p_role, 1001)
  ON CONFLICT (tenant_id, role)
  DO UPDATE SET next_val = tenant_sequences.next_val + 1
  RETURNING next_val - 1 INTO v_serial;

  v_custom_id := v_prefix || '-' || v_tenant_short || '-' || v_serial;
  
  RETURN v_custom_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update handle_new_user to handle custom_id if tenant and role are known
-- Note: Usually tenant and role are assigned AFTER profile creation via memberships.
-- So we might need a trigger on memberships instead.

CREATE OR REPLACE FUNCTION public.sync_profile_custom_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate custom_id if it doesn't exist yet
  IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id AND custom_id IS NULL) THEN
    UPDATE profiles 
    SET custom_id = generate_custom_id(NEW.user_id, NEW.tenant_id, NEW.role)
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_membership_created ON memberships;
CREATE TRIGGER on_membership_created
  AFTER INSERT ON memberships
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_custom_id();

-- 5. Backfill existing profiles if any
-- (This is a simplified backfill, might need adjustment if many tenants exist)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id, tenant_id, role FROM memberships LOOP
    IF EXISTS (SELECT 1 FROM profiles WHERE id = r.user_id AND custom_id IS NULL) THEN
      UPDATE profiles 
      SET custom_id = generate_custom_id(r.user_id, r.tenant_id, r.role)
      WHERE id = r.user_id;
    END IF;
  END LOOP;
END $$;
