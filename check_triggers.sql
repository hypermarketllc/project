-- Check for all triggers on the deals table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'deals';

-- Check for all functions that might be inserting into discord_notifications
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%discord%' OR p.proname LIKE '%notification%';

-- Check for any rows in discord_notifications with the same deal_id
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
ORDER BY MAX(created_at) DESC;