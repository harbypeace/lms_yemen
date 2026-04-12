-- Migration: Simplified xAPI Backend (xAPI Lite)

CREATE TABLE IF NOT EXISTS xapi_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  verb TEXT NOT NULL CHECK (verb IN ('start', 'end', 'score', 'store')),
  activity_id TEXT NOT NULL,
  activity_type TEXT,
  score NUMERIC,
  max_score NUMERIC,
  success BOOLEAN,
  completion BOOLEAN,
  duration INTERVAL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE xapi_statements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own xapi statements"
  ON xapi_statements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own xapi statements"
  ON xapi_statements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view public xapi statements"
  ON xapi_statements FOR SELECT
  USING (is_public = true);

-- RPC Functions for xAPI Lite

-- 1. Start Activity
CREATE OR REPLACE FUNCTION xapi_start(
  p_activity_id TEXT,
  p_activity_type TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_is_public BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO xapi_statements (user_id, tenant_id, verb, activity_id, activity_type, metadata, is_public)
  VALUES (auth.uid(), p_tenant_id, 'start', p_activity_id, p_activity_type, p_metadata, p_is_public)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. End Activity
CREATE OR REPLACE FUNCTION xapi_end(
  p_activity_id TEXT,
  p_activity_type TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT NULL,
  p_completion BOOLEAN DEFAULT NULL,
  p_duration INTERVAL DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_is_public BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO xapi_statements (user_id, tenant_id, verb, activity_id, activity_type, success, completion, duration, metadata, is_public)
  VALUES (auth.uid(), p_tenant_id, 'end', p_activity_id, p_activity_type, p_success, p_completion, p_duration, p_metadata, p_is_public)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Score Activity
CREATE OR REPLACE FUNCTION xapi_score(
  p_activity_id TEXT,
  p_score NUMERIC,
  p_max_score NUMERIC DEFAULT 100,
  p_activity_type TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_is_public BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO xapi_statements (user_id, tenant_id, verb, activity_id, activity_type, score, max_score, metadata, is_public)
  VALUES (auth.uid(), p_tenant_id, 'score', p_activity_id, p_activity_type, p_score, p_max_score, p_metadata, p_is_public)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Store Generic Statement
CREATE OR REPLACE FUNCTION xapi_store(
  p_activity_id TEXT,
  p_verb TEXT,
  p_activity_type TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_is_public BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO xapi_statements (user_id, tenant_id, verb, activity_id, activity_type, metadata, is_public)
  VALUES (auth.uid(), p_tenant_id, p_verb, p_activity_id, p_activity_type, p_metadata, p_is_public)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
