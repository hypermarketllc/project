/*
  # Add mock user data

  1. New Data
    - Creates a mock user in auth.users
    - Creates corresponding user record in users table
    - Creates user account record in user_accs table

  2. Security
    - No changes to security policies
*/

-- Insert mock user into auth.users
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
  'a96ea309-a1a4-4e8c-a76f-0fb24d9e4a87',
  '00000000-0000-0000-0000-000000000000',
  'demo@example.com',
  '$2a$10$Q7QJVW9S0D7C3z8HGJGXn.ZK.Vt.pJJeZkGwL.tU6nWHv4YdHlQ2q', -- Password: demo123
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Demo User"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Insert user record
INSERT INTO public.users (
  id,
  email,
  full_name,
  is_active,
  created_at,
  updated_at
) VALUES (
  'a96ea309-a1a4-4e8c-a76f-0fb24d9e4a87',
  'demo@example.com',
  'Demo User',
  true,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Insert user account record
INSERT INTO public.user_accs (
  user_id,
  display_name,
  theme_preference,
  notification_preferences,
  created_at,
  updated_at
) VALUES (
  'a96ea309-a1a4-4e8c-a76f-0fb24d9e4a87',
  'Demo User',
  'light',
  '{
    "email": true,
    "push": true,
    "deals": true,
    "system": true
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (user_id) DO NOTHING;