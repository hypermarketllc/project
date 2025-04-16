-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create admin user in auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE email = 'admin@americancoveragecenter.com'
    ) THEN
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
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            'admin@americancoveragecenter.com',
            crypt('DIscord101!', gen_salt('bf')),
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
        ) RETURNING id INTO user_id;

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
            user_id,
            'admin@americancoveragecenter.com',
            'American Coverage Center',
            true,
            (SELECT id FROM positions WHERE name = 'owner' LIMIT 1),
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
            user_id,
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
    END IF;
END $$;

-- Ensure owner position exists
INSERT INTO positions (name, level, description)
VALUES ('owner', 5, 'Organization owner with full system access')
ON CONFLICT (name) DO NOTHING;