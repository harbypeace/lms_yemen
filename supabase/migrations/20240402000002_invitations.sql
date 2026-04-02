-- 13. Invitations Table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('school_admin', 'teacher', 'student', 'parent')),
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Invitations
CREATE POLICY "Admins can manage invitations" ON invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = invitations.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'school_admin'
    )
  );

CREATE POLICY "Users can view their own invitations" ON invitations
  FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Function to accept invitation
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
