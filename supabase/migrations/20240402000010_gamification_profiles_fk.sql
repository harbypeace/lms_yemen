-- Migration: Add foreign keys to profiles for gamification tables

ALTER TABLE user_gamification
ADD CONSTRAINT user_gamification_user_id_profile_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE user_course_gamification
ADD CONSTRAINT user_course_gamification_user_id_profile_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE learning_events
ADD CONSTRAINT learning_events_user_id_profile_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE user_badges
ADD CONSTRAINT user_badges_user_id_profile_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Also update the RLS policy for user_course_gamification to allow anyone to view it for the leaderboard
DROP POLICY IF EXISTS "Users can view their own course gamification stats" ON user_course_gamification;
CREATE POLICY "Anyone can view course gamification stats" ON user_course_gamification FOR SELECT USING (true);
