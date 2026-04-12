-- Migration: Integrations and Sync Support

-- 1. External Integrations Table
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'webhook', 'zapier', 'slack'
  endpoint_url TEXT,
  api_key TEXT,
  secret_token TEXT,
  events TEXT[] DEFAULT '{}', -- e.g., ['lesson_completed', 'course_completed', 'user_joined']
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sync Logs Table
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'failed', 'pending'
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Hierarchy Support
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT; -- Redundant but helpful for quick checks

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage integrations" ON integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = integrations.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('super_admin', 'school_admin')
    )
  );

CREATE POLICY "Admins can view sync logs" ON sync_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM integrations
      JOIN memberships ON integrations.tenant_id = memberships.tenant_id
      WHERE integrations.id = sync_logs.integration_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('super_admin', 'school_admin')
    )
  );

-- 4. Function to trigger webhooks
CREATE OR REPLACE FUNCTION trigger_integration_webhook()
RETURNS TRIGGER AS $$
DECLARE
  v_integration RECORD;
BEGIN
  -- This is a placeholder for actual logic. 
  -- In a real Supabase environment, you'd use pg_net to call an edge function 
  -- that then iterates through active integrations and sends the data.
  
  -- For now, we'll just log that an event happened if there's an active integration
  -- In production, you'd have a more robust queue system.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
