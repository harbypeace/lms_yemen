-- Migration: Apply clear naming conventions for LMS tables

-- 1. Quizzes
ALTER TABLE quizzes RENAME COLUMN id TO quiz_id;
ALTER TABLE quizzes RENAME COLUMN title TO quiz_title;
ALTER TABLE quizzes RENAME COLUMN target_id TO lesson_id;
ALTER TABLE quizzes DROP COLUMN IF EXISTS target_type;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER;

-- 2. QuizQuestions
ALTER TABLE questions RENAME TO quiz_questions;
ALTER TABLE quiz_questions RENAME COLUMN id TO question_id;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 1;

-- 3. QuizSubmissions
ALTER TABLE quiz_attempts RENAME TO quiz_submissions;
ALTER TABLE quiz_submissions RENAME COLUMN id TO submission_id;
ALTER TABLE quiz_submissions RENAME COLUMN completed_at TO submitted_at;
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS time_taken INTEGER;

-- 4. UserProgress
ALTER TABLE progress RENAME TO user_progress;
ALTER TABLE user_progress RENAME COLUMN id TO progress_id;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed'));
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS accuracy_percentage NUMERIC;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS attempts_count INTEGER DEFAULT 0;

-- Update existing progress records
UPDATE user_progress SET status = 'completed', completion_date = updated_at WHERE completed = true;

-- 5. UserStats
ALTER TABLE user_gamification RENAME TO user_stats;
-- Add stat_id as PK, keep user_id as FK/Unique
ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS user_gamification_pkey CASCADE;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE user_stats ADD CONSTRAINT user_stats_user_id_key UNIQUE (user_id);
ALTER TABLE user_stats RENAME COLUMN streak_days TO current_streak;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS hearts INTEGER DEFAULT 5;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS gems INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS league_id UUID;

-- 6. LessonAttempts
CREATE TABLE IF NOT EXISTS lesson_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score INTEGER,
  mistakes_count INTEGER DEFAULT 0,
  hearts_lost INTEGER DEFAULT 0
);

-- 7. Challenges (Needed for ChallengeProgress FK)
CREATE TABLE IF NOT EXISTS challenges (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT
);

-- 8. ChallengeProgress
CREATE TABLE IF NOT EXISTS challenge_progress (
  progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES lesson_attempts(attempt_id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(challenge_id) ON DELETE CASCADE,
  user_answer TEXT,
  is_correct BOOLEAN,
  time_spent INTEGER,
  hints_used INTEGER DEFAULT 0
);

-- 9. Friends
CREATE TABLE IF NOT EXISTS friends (
  friendship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Re-apply RLS policies for renamed tables
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Basic policies for new tables
CREATE POLICY "Users can view their own lesson attempts" ON lesson_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own lesson attempts" ON lesson_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own challenge progress" ON challenge_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM lesson_attempts WHERE lesson_attempts.attempt_id = challenge_progress.attempt_id AND lesson_attempts.user_id = auth.uid())
);

CREATE POLICY "Users can view their friends" ON friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
