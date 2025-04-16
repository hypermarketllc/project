/*
  # Remove RLS from storage buckets
  
  1. Changes
    - Disable RLS on storage.buckets
    - Disable RLS on storage.objects
    - Drop all storage policies
    - Make all buckets public
*/

-- Disable RLS on storage tables
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Drop all storage policies
DROP POLICY IF EXISTS "Allow public bucket access" ON storage.buckets;
DROP POLICY IF EXISTS "Allow public object access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated bucket access" ON storage.buckets;
DROP POLICY IF EXISTS "Allow authenticated object access" ON storage.objects;

-- Make all buckets public
UPDATE storage.buckets SET public = true;

-- Update logos bucket to ensure it's public and accessible
DO $$
BEGIN
  -- Create logos bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('logos', 'logos', true)
  ON CONFLICT (id) DO UPDATE
  SET public = true,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif'],
      file_size_limit = 2097152; -- 2MB in bytes
END $$;