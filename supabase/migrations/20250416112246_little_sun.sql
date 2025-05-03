-- Add missing columns to deals table
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS app_number text,
ADD COLUMN IF NOT EXISTS client_phone text,
ADD COLUMN IF NOT EXISTS effective_date date,
ADD COLUMN IF NOT EXISTS from_referral boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Approved', 'Rejected'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_deals_agent_id ON deals(agent_id);
CREATE INDEX IF NOT EXISTS idx_deals_carrier_id ON deals(carrier_id);
CREATE INDEX IF NOT EXISTS idx_deals_product_id ON deals(product_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);