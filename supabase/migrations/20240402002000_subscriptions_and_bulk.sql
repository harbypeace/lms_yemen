-- Migration: Add subscriptions and bulk import support
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all subscriptions" ON subscriptions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'school_admin')
  )
);

CREATE TABLE IF NOT EXISTS bulk_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  imported_by UUID REFERENCES auth.users(id),
  total_records INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  errors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bulk_import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view import logs" ON bulk_import_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'school_admin')
  )
);
