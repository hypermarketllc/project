-- Script to check for duplicate notifications

-- Count total notifications
SELECT COUNT(*) as total_notifications FROM discord_notifications;

-- Count unique deal/webhook combinations
SELECT COUNT(DISTINCT (deal_id, webhook_url)) as unique_combinations FROM discord_notifications;

-- Find deals with multiple notifications
SELECT 
  deal_id, 
  webhook_url, 
  COUNT(*) as notification_count,
  STRING_AGG(id::text, ', ') as notification_ids,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM discord_notifications
GROUP BY deal_id, webhook_url
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, MAX(created_at) DESC;

-- Count pending notifications
SELECT COUNT(*) as pending_notifications FROM discord_notifications WHERE sent = false;

-- Count sent notifications
SELECT COUNT(*) as sent_notifications FROM discord_notifications WHERE sent = true;

-- Check if unique constraint exists
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'unique_deal_notification';