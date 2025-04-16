-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First ensure the owner position exists
INSERT INTO positions (name, level, description)
VALUES ('owner', 5, 'Organization owner with full system access')
ON CONFLICT (name) DO NOTHING;

-- Create admin user
DO $$
DECLARE
    admin_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    owner_position_id uuid;
BEGIN
    -- Get the owner position ID
    SELECT id INTO owner_position_id FROM positions WHERE name = 'owner';
    
    -- Create auth user if not exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = admin_id) THEN
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
            admin_id,
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
        );

        -- Create user record with owner position
        INSERT INTO public.users (
            id,
            email,
            full_name,
            is_active,
            position_id,
            created_at,
            updated_at
        ) VALUES (
            admin_id,
            'admin@example.com',
            'Admin User',
            true,
            owner_position_id,
            now(),
            now()
        );

        -- Create user account record
        INSERT INTO public.user_accs (
            user_id,
            display_name,
            theme_preference,
            notification_preferences,
            created_at,
            updated_at
        ) VALUES (
            admin_id,
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
        );
    END IF;
END $$;