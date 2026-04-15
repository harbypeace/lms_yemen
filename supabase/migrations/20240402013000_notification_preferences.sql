-- Migration: Notification Preferences

-- 1. Add category to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system';

-- 2. Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  system_announcements BOOLEAN NOT NULL DEFAULT true,
  course_updates BOOLEAN NOT NULL DEFAULT true,
  new_badges BOOLEAN NOT NULL DEFAULT true,
  parent_alerts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Users can view their own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Trigger to create default preferences for new users
CREATE OR REPLACE FUNCTION handle_new_user_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_notification_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_notification_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_notification_preferences();

-- 6. Update create_notification to check preferences
CREATE OR REPLACE FUNCTION create_notification(
  p_tenant_id UUID,
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_enabled BOOLEAN;
BEGIN
  -- Check preference
  SELECT 
    CASE 
      WHEN p_category = 'course_update' THEN course_updates
      WHEN p_category = 'badge' THEN new_badges
      WHEN p_category = 'parent_alert' THEN parent_alerts
      ELSE system_announcements
    END INTO v_enabled
  FROM notification_preferences
  WHERE user_id = p_user_id;

  -- Default to true if no preference record found
  IF v_enabled IS NULL OR v_enabled = true THEN
    INSERT INTO notifications (tenant_id, user_id, title, message, type, link, category)
    VALUES (p_tenant_id, p_user_id, p_title, p_message, p_type, p_link, p_category)
    RETURNING id INTO v_notification_id;
  END IF;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
