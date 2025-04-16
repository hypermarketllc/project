/*
  # Fix Admin User Authentication
  
  1. Changes
    - Drop and recreate admin user with correct password hash
    - Ensure all related records are properly created
    - Use proper password hashing with pgcrypto
*/

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First, ensure the admin user exists in auth.users with correct password
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  aud,
  role
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '00000000-0000-0000-0000-000000000000',
  'admin@example.com',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "Admin User"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  '',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO UPDATE
SET encrypted_password = crypt('Admin123!', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now(),
    raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
    raw_user_meta_data = '{"full_name": "Admin User"}'::jsonb;

-- Ensure the user record exists in public.users
INSERT INTO public.users (
  id,
  email,
  full_name,
  is_active,
  created_at,
  updated_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'admin@example.com',
  'Admin User',
  true,
  now(),
  now()
) ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_active = true,
    updated_at = now();

-- Ensure the user account record exists
INSERT INTO public.user_accs (
  user_id,
  display_name,
  theme_preference,
  notification_preferences,
  created_at,
  updated_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Admin User',
  'light',
  '{
    "email": true,
    "push": true,
    "deals": true,
    "system": true
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    theme_preference = EXCLUDED.theme_preference,
    notification_preferences = EXCLUDED.notification_preferences,
    updated_at = now();