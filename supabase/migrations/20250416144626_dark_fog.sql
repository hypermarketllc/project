-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First ensure the owner position exists
INSERT INTO positions (name, level, description)
VALUES ('owner', 5, 'Organization owner with full system access')
ON CONFLICT (name) DO NOTHING;

-- Create admin user
DO $$
DECLARE
    admin_id uuid := gen_random_uuid();
    owner_position_id uuid;
BEGIN
    -- Get the owner position ID
    SELECT id INTO owner_position_id FROM positions WHERE name = 'owner';
    
    -- Create auth user if not exists
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE email = 'admin@americancoveragecenter.com'
    ) THEN
        -- Insert new auth user
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
            'admin@americancoveragecenter.com',
            crypt('Discord101!', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "American Coverage Center"}'::jsonb,
            now(),
            now(),
            '',
            '',
            '',
            '',
            'authenticated',
            'authenticated'
        );

        -- Create user record
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
            'admin@americancoveragecenter.com',
            'American Coverage Center',
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
            'American Coverage Center',
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
    ELSE
        -- Update existing auth user
        UPDATE auth.users
        SET encrypted_password = crypt('Discord101!', gen_salt('bf')),
            email_confirmed_at = now(),
            updated_at = now(),
            raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
            raw_user_meta_data = '{"full_name": "American Coverage Center"}'::jsonb,
            aud = 'authenticated',
            role = 'authenticated'
        WHERE email = 'admin@americancoveragecenter.com'
        RETURNING id INTO admin_id;

        -- Update or insert user record
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
            'admin@americancoveragecenter.com',
            'American Coverage Center',
            true,
            owner_position_id,
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            is_active = EXCLUDED.is_active,
            position_id = EXCLUDED.position_id,
            updated_at = EXCLUDED.updated_at;

        -- Update or insert user account record
        INSERT INTO public.user_accs (
            user_id,
            display_name,
            theme_preference,
            notification_preferences,
            created_at,
            updated_at
        ) VALUES (
            admin_id,
            'American Coverage Center',
            'light',
            '{
                "email": true,
                "push": true,
                "deals": true,
                "system": true
            }'::jsonb,
            now(),
            now()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            theme_preference = EXCLUDED.theme_preference,
            notification_preferences = EXCLUDED.notification_preferences,
            updated_at = EXCLUDED.updated_at;
    END IF;
END $$;