-- Migration: Gamification Module v2

-- 1. Core Tables
CREATE TABLE IF NOT EXISTS learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  course_id uuid,
  unit_id uuid,
  lesson_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gamification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  event_type text NOT NULL,
  entity_type text,
  condition jsonb DEFAULT '{}'::jsonb,
  reward jsonb DEFAULT '{}'::jsonb,
  priority int DEFAULT 0,
  cooldown_seconds int DEFAULT 0,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_gamification (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp bigint DEFAULT 0,
  level int DEFAULT 1,
  streak_days int DEFAULT 0,
  last_activity_date date,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_course_gamification (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  xp bigint DEFAULT 0,
  level int DEFAULT 1,
  progress numeric DEFAULT 0,
  last_activity_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE,
  title text,
  description text,
  icon text
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- 2. Indexes and Constraints
CREATE INDEX IF NOT EXISTS idx_events_user ON learning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_course ON learning_events(course_id);

-- Anti-cheat: Prevent duplicate events for the same entity
CREATE UNIQUE INDEX IF NOT EXISTS unique_event ON learning_events(user_id, event_type, entity_id) WHERE entity_id IS NOT NULL;

-- 3. Functions
CREATE OR REPLACE FUNCTION add_user_xp(uid uuid, xp_to_add int)
RETURNS void AS $$
BEGIN
  INSERT INTO user_gamification (user_id, total_xp, last_activity_date)
  VALUES (uid, xp_to_add, CURRENT_DATE)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    total_xp = user_gamification.total_xp + xp_to_add,
    last_activity_date = CURRENT_DATE,
    updated_at = now();

  UPDATE user_gamification
  SET level = floor(sqrt(total_xp / 100)) + 1
  WHERE user_id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_course_xp(uid uuid, cid uuid, xp_to_add int)
RETURNS void AS $$
BEGIN
  INSERT INTO user_course_gamification (user_id, course_id, xp, last_activity_at)
  VALUES (uid, cid, xp_to_add, now())
  ON CONFLICT (user_id, course_id)
  DO UPDATE SET 
    xp = user_course_gamification.xp + xp_to_add,
    last_activity_at = now();
    
  UPDATE user_course_gamification
  SET level = floor(sqrt(xp / 100)) + 1
  WHERE user_id = uid AND course_id = cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Event Processing RPC (Replaces Edge Function for simplicity & transaction safety)
CREATE OR REPLACE FUNCTION track_learning_event(
  p_user_id uuid,
  p_event_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_course_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_lesson_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_org_id uuid DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  v_rule record;
  v_reward jsonb;
  v_xp int;
  v_course_xp int;
  v_badge_key text;
  v_badge_id uuid;
BEGIN
  -- 1. Insert Event (will fail if unique constraint violated, which is good for anti-cheat)
  BEGIN
    INSERT INTO learning_events (
      user_id, org_id, event_type, entity_type, entity_id, 
      course_id, unit_id, lesson_id, metadata
    ) VALUES (
      p_user_id, COALESCE(p_org_id, p_user_id), p_event_type, p_entity_type, p_entity_id,
      p_course_id, p_unit_id, p_lesson_id, p_metadata
    );
  EXCEPTION WHEN unique_violation THEN
    -- Event already processed, ignore
    RETURN false;
  END;

  -- 2. Find matching rules and apply rewards
  FOR v_rule IN 
    SELECT * FROM gamification_rules 
    WHERE event_type = p_event_type AND is_active = true
    ORDER BY priority DESC
  LOOP
    -- Simple condition matching (can be expanded)
    -- For now, we assume if it matches event_type, it applies. 
    -- In a real scenario, we'd parse the JSON condition here or in a helper function.
    -- To keep it performant in SQL, we'll apply the reward directly if no complex condition is needed.
    
    v_reward := v_rule.reward;
    
    IF v_reward ? 'xp' THEN
      v_xp := (v_reward->>'xp')::int;
      PERFORM add_user_xp(p_user_id, v_xp);
    END IF;
    
    IF v_reward ? 'course_xp' AND p_course_id IS NOT NULL THEN
      v_course_xp := (v_reward->>'course_xp')::int;
      PERFORM add_course_xp(p_user_id, p_course_id, v_course_xp);
    END IF;
    
    IF v_reward ? 'badge' THEN
      v_badge_key := v_reward->>'badge';
      SELECT id INTO v_badge_id FROM badges WHERE key = v_badge_key;
      IF v_badge_id IS NOT NULL THEN
        BEGIN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge_id);
        EXCEPTION WHEN unique_violation THEN
          -- Already has badge
        END;
      END IF;
    END IF;
    
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Default Data
INSERT INTO gamification_rules (event_type, reward) VALUES
('lesson_completed', '{"xp": 10, "course_xp": 5}'),
('quiz_passed', '{"xp": 50, "course_xp": 20}'),
('course_completed', '{"xp": 200, "badge": "course_master"}')
ON CONFLICT DO NOTHING;

INSERT INTO badges (key, title, description, icon) VALUES
('course_master', 'Course Master', 'Completed a full course', '🏆'),
('fast_learner', 'Fast Learner', 'Completed 5 lessons in one day', '⚡')
ON CONFLICT (key) DO NOTHING;

-- 6. RLS Policies
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own gamification stats" ON user_gamification FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE user_course_gamification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own course gamification stats" ON user_course_gamification FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own events" ON learning_events FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own badges" ON user_badges FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON badges FOR SELECT USING (true);
