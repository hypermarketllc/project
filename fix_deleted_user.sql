-- Script to fix issue with deleted user still existing in auth.users table
-- This script needs to be run by someone with admin access to the Supabase project

-- First, check if the user exists in auth.users
SELECT id, email, deleted_at 
FROM auth.users 
WHERE email = 'adam@americancoveragecenter.com';

-- If the user exists but shows as deleted (deleted_at is not null),
-- you may need to completely remove the record or update the email

-- Option 1: If you want to completely remove the user from auth.users
-- WARNING: This is destructive and should only be done if you're sure
-- you want to completely remove this user's authentication record
DELETE FROM auth.users 
WHERE email = 'adam@americancoveragecenter.com';

-- Option 2: If you want to keep the record but change the email to allow reuse
-- This is safer as it preserves the auth history but allows the email to be reused
UPDATE auth.users 
SET email = 'deleted_' || extract(epoch from now())::text || '_' || email
WHERE email = 'adam@americancoveragecenter.com';

-- Option 3: If the user exists in your application database but not in auth.users
-- You may need to delete the user from your application database
DELETE FROM users
WHERE email = 'adam@americancoveragecenter.com';

-- Check if the user exists in your application's users table
SELECT * FROM users
WHERE email = 'adam@americancoveragecenter.com';

-- Note: Since you mentioned you only have read access to auth.users,
-- you'll need to contact your Supabase administrator or use the Supabase
-- dashboard to execute these commands. Alternatively, you can use the
-- Supabase Management API if you have the appropriate access token.

-- If you're using the Supabase dashboard:
-- 1. Go to the SQL Editor
-- 2. Paste the appropriate commands
-- 3. Run the query

-- If you're using the Management API, you'll need to make a POST request to:
-- https://api.supabase.com/v1/projects/{project_id}/sql
-- With the appropriate headers and the SQL command in the request body