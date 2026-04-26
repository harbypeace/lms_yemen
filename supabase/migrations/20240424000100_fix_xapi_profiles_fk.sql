-- Migration: Fix relationship between xapi_statements and profiles
-- Date: 2024-04-24

ALTER TABLE xapi_statements 
DROP CONSTRAINT IF EXISTS xapi_statements_user_id_fkey;

ALTER TABLE xapi_statements
ADD CONSTRAINT xapi_statements_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
