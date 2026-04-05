-- Migration: Fix Streak Logic and Add Level Up Trigger
-- This script updates the add_user_xp function to correctly handle streaks

CREATE OR REPLACE FUNCTION add_user_xp(uid uuid, xp_to_add int)
RETURNS void AS $$
DECLARE
  v_last_date date;
  v_current_streak int;
BEGIN
  -- Get current stats
  SELECT last_activity_date, streak_days INTO v_last_date, v_current_streak
  FROM user_gamification
  WHERE user_id = uid;

  -- Calculate streak
  IF v_last_date IS NULL THEN
    v_current_streak := 1;
  ELSIF v_last_date = CURRENT_DATE THEN
    -- Already active today, keep streak
    v_current_streak := COALESCE(v_current_streak, 1);
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Active yesterday, increment streak
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    -- Gap in activity, reset streak
    v_current_streak := 1;
  END IF;

  -- Update or Insert
  INSERT INTO user_gamification (user_id, total_xp, streak_days, last_activity_date, updated_at)
  VALUES (uid, xp_to_add, v_current_streak, CURRENT_DATE, now())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    total_xp = user_gamification.total_xp + xp_to_add,
    streak_days = v_current_streak,
    last_activity_date = CURRENT_DATE,
    updated_at = now();

  -- Update level based on new XP
  UPDATE user_gamification
  SET level = floor(sqrt(total_xp / 100)) + 1
  WHERE user_id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
