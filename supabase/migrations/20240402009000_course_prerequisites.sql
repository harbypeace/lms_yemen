-- Migration: Add prerequisites to courses

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS prerequisites UUID[] DEFAULT '{}'::UUID[];
