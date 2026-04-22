-- Migration: Add img_url, slug, and metadata to courses, modules, and lessons
-- Date: 2024-04-22

-- 1. Update courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS img_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Update modules table
ALTER TABLE modules ADD COLUMN IF NOT EXISTS img_url TEXT;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Update lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS img_url TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Note: We are not adding UNIQUE constraints on slugs yet to avoid breaking existing data 
-- that might have null values. We can add them later or handle validation in the application logic.
