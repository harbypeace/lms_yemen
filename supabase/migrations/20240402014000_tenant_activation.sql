-- Add status to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'deactivated'));

-- Update existing tenants to active
UPDATE tenants SET status = 'active' WHERE status IS NULL;

-- Update accept_invitation to activate tenant
CREATE OR REPLACE FUNCTION accept_invitation(invitation_id UUID)
RETURNS void AS $$
DECLARE
  target_invitation RECORD;
BEGIN
  SELECT * FROM invitations WHERE id = invitation_id AND status = 'pending' INTO target_invitation;
  
  IF target_invitation IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;

  -- Create membership
  INSERT INTO memberships (user_id, tenant_id, role)
  VALUES (auth.uid(), target_invitation.tenant_id, target_invitation.role)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = target_invitation.role;

  -- Update invitation status
  UPDATE invitations SET status = 'accepted' WHERE id = invitation_id;

  -- Activate tenant
  UPDATE tenants SET status = 'active' WHERE id = target_invitation.tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
