/*
  # Fix Login Issues

  1. Changes
    - Add admin user with correct credentials
    - Ensure proper password hashing
    - Add necessary user records
*/

-- Insert admin user into auth.users if not exists
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
  recovery_token
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '00000000-0000-0000-0000-000000000000',
  'admin@example.com',
  crypt('Admin123!', gen_salt('bf')), -- Using proper password hashing
  now(),
  jsonb_build_object(
    'provider', 'email',
    'providers', array['email']
  ),
  jsonb_build_object(
    'full_name', 'Admin User'
  ),
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO UPDATE
SET encrypted_password = crypt('Admin123!', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now();

-- Insert corresponding user record
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
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Insert user account record
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