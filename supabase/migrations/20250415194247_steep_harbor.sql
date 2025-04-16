/*
  # Add Row Level Security Policies
  
  1. Changes
    - Enable RLS on all tables
    - Add RLS policies for:
      - Read access to reference tables (carriers, products, positions)
      - User-specific access to personal data (users, deals, commissions)
      - Authenticated access to settings
*/

-- Enable RLS on all tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'carriers' AND rowsecurity = true) THEN
        ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'products' AND rowsecurity = true) THEN
        ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'positions' AND rowsecurity = true) THEN
        ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users' AND rowsecurity = true) THEN
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'commission_splits' AND rowsecurity = true) THEN
        ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'deals' AND rowsecurity = true) THEN
        ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'commissions' AND rowsecurity = true) THEN
        ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'settings' AND rowsecurity = true) THEN
        ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Add RLS policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'carriers' AND policyname = 'Allow authenticated users to read carriers') THEN
        CREATE POLICY "Allow authenticated users to read carriers"
            ON carriers FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow authenticated users to read products') THEN
        CREATE POLICY "Allow authenticated users to read products"
            ON products FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'positions' AND policyname = 'Allow authenticated users to read positions') THEN
        CREATE POLICY "Allow authenticated users to read positions"
            ON positions FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can read own data') THEN
        CREATE POLICY "Users can read own data"
            ON users FOR SELECT
            TO authenticated
            USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commission_splits' AND policyname = 'Allow authenticated users to read commission splits') THEN
        CREATE POLICY "Allow authenticated users to read commission splits"
            ON commission_splits FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deals' AND policyname = 'Users can read own deals') THEN
        CREATE POLICY "Users can read own deals"
            ON deals FOR SELECT
            TO authenticated
            USING (agent_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commissions' AND policyname = 'Users can read own commissions') THEN
        CREATE POLICY "Users can read own commissions"
            ON commissions FOR SELECT
            TO authenticated
            USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Allow authenticated users to read settings') THEN
        CREATE POLICY "Allow authenticated users to read settings"
            ON settings FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;