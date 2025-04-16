-- Simple script to clean up duplicate notifications

-- Step 1: Identify and remove duplicate notifications
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Find and delete duplicates, keeping only the first one for each deal/webhook combination
  WITH duplicates AS (
    SELECT 
      id,
      deal_id, 
      webhook_url,
      ROW_NUMBER() OVER (PARTITION BY deal_id, webhook_url ORDER BY created_at) as row_num
    FROM discord_notifications
  )
  DELETE FROM discord_notifications dn
  WHERE dn.id IN (
    SELECT id FROM duplicates WHERE row_num > 1
  );
  
  GET DIAGNOSTICS duplicate_count = ROW_COUNT;
  RAISE NOTICE 'Removed % duplicate notifications', duplicate_count;
END $$;

-- Step 2: Add unique constraint if it doesn't exist
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_deal_notification'
  ) THEN
    ALTER TABLE discord_notifications 
    ADD CONSTRAINT unique_deal_notification UNIQUE (deal_id, webhook_url);
    
    RAISE NOTICE 'Added unique constraint on deal_id and webhook_url';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;

-- Verify cleanup
SELECT 'Duplicate notifications cleanup complete!' AS result;