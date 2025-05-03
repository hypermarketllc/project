-- Enhance Discord Notifications SQL Script
-- Run this script in the Supabase SQL Editor

-- Create a function to count deals by agent for the current day
CREATE OR REPLACE FUNCTION count_agent_deals_today(agent_id_param uuid)
RETURNS INTEGER AS $$
DECLARE
  deal_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deal_count
  FROM deals
  WHERE agent_id = agent_id_param
    AND DATE(created_at) = CURRENT_DATE;
  
  RETURN deal_count;
END;
$$ LANGUAGE plpgsql;

-- Update the notify_discord_on_deal function
CREATE OR REPLACE FUNCTION notify_discord_on_deal()
RETURNS TRIGGER AS $$
DECLARE
  discord_config jsonb;
  webhook_url text;
  agent_name text;
  carrier_name text;
  deal_count integer;
  title_text text;
  message jsonb;
  integration_is_active boolean;
BEGIN
  -- Get Discord integration config with explicit column references
  SELECT i.config, i.is_active INTO discord_config, integration_is_active
  FROM integrations i
  WHERE i.type = 'discord' AND i.name = 'Discord Webhook'
  LIMIT 1;
  
  -- Check if Discord integration is active
  IF NOT FOUND OR NOT integration_is_active THEN
    RETURN NEW;
  END IF;
  
  -- Get webhook URL
  webhook_url := discord_config->>'webhook_url';
  
  -- If no webhook URL is configured, exit
  IF webhook_url IS NULL OR webhook_url = '' THEN
    RETURN NEW;
  END IF;
  
  -- Get agent name
  SELECT u.full_name INTO agent_name
  FROM users u
  WHERE u.id = NEW.agent_id;
  
  -- Get carrier name
  SELECT c.name INTO carrier_name
  FROM carriers c
  WHERE c.id = NEW.carrier_id;
  
  -- Count deals for this agent today (including the current one)
  deal_count := count_agent_deals_today(NEW.agent_id);
  
  -- Create title text with deal counter if needed
  IF deal_count > 1 THEN
    title_text := CONCAT('💰 New Deal Submitted x', deal_count, ' 💰');
  ELSE
    title_text := '💰 New Deal Submitted 💰';
  END IF;
  
  -- Build Discord message
  message := jsonb_build_object(
    'username', COALESCE(discord_config->>'username', 'MyAgentView Bot'),
    'avatar_url', COALESCE(discord_config->>'avatar_url', 'https://i.imgur.com/4M34hi2.png'),
    'content', '',
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', title_text,
        'color', 5814783, -- Blue color in decimal
        'fields', jsonb_build_array(
          jsonb_build_object(
            'name', 'Client',
            'value', NEW.client_name,
            'inline', true
          ),
          jsonb_build_object(
            'name', 'Premium',
            'value', CONCAT('$', NEW.annual_premium),
            'inline', true
          ),
          CASE WHEN (discord_config->>'include_agent_name')::boolean AND agent_name IS NOT NULL THEN
            jsonb_build_object(
              'name', 'Agent',
              'value', agent_name,
              'inline', true
            )
          ELSE NULL END,
          CASE WHEN (discord_config->>'include_carrier')::boolean AND carrier_name IS NOT NULL THEN
            jsonb_build_object(
              'name', 'Carrier',
              'value', carrier_name,
              'inline', true
            )
          ELSE NULL END
          -- Product information removed as requested
        ),
        'timestamp', CURRENT_TIMESTAMP
      )
    )
  );
  
  -- Remove null fields from the embeds array
  message := jsonb_set(
    message,
    '{embeds,0,fields}',
    (SELECT jsonb_agg(field) FROM jsonb_array_elements(message->'embeds'->0->'fields') AS field WHERE field IS NOT NULL)
  );
  
  -- Queue the notification in the discord_notifications table
  INSERT INTO discord_notifications (deal_id, message, webhook_url)
  VALUES (NEW.id, message, webhook_url);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the test_discord_webhook function to match the new format
CREATE OR REPLACE FUNCTION test_discord_webhook(webhook_url TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
  test_message jsonb;
BEGIN
  -- Create a test message
  test_message := jsonb_build_object(
    'username', 'MyAgentView Test Bot',
    'avatar_url', 'https://i.imgur.com/4M34hi2.png',
    'content', '',
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', '💰 Test Notification 💰',
        'description', 'This is a test notification from MyAgentView CRM',
        'color', 5814783, -- Blue color in decimal
        'fields', jsonb_build_array(
          jsonb_build_object(
            'name', 'Client',
            'value', 'Test Client',
            'inline', true
          ),
          jsonb_build_object(
            'name', 'Premium',
            'value', '$1,200.00',
            'inline', true
          ),
          jsonb_build_object(
            'name', 'Agent',
            'value', 'Test Agent',
            'inline', true
          ),
          jsonb_build_object(
            'name', 'Status',
            'value', 'If you can see this message, Discord integration is working!',
            'inline', false
          )
        ),
        'timestamp', CURRENT_TIMESTAMP
      )
    )
  );
  
  -- Queue the test notification
  INSERT INTO discord_notifications (
    deal_id, 
    message, 
    webhook_url
  )
  VALUES (
    (SELECT id FROM deals ORDER BY created_at DESC LIMIT 1), -- Get the latest deal ID
    test_message,
    webhook_url
  );
  
  RETURN QUERY SELECT true, 'Test notification queued successfully. It will be sent within 30 seconds.';
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Add comments to explain function usage
COMMENT ON FUNCTION notify_discord_on_deal IS 'Queues a notification to Discord webhook when a new deal is created. Includes emojis, deal counter, and customizable fields.';
COMMENT ON FUNCTION test_discord_webhook IS 'Tests a Discord webhook by sending a test notification with the enhanced format.';
COMMENT ON FUNCTION count_agent_deals_today IS 'Counts how many deals an agent has submitted today.';

-- Verify setup
SELECT 'Discord notification enhancements complete!' AS result;