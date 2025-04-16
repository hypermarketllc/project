/*
  # Add Discord Notification Queue
  
  1. Changes
    - Create a table to store Discord notifications
    - Update the notify_discord_on_deal function to queue notifications instead of sending directly
    - Add a function to test Discord webhook
*/

-- Create a table to store Discord notifications
CREATE TABLE IF NOT EXISTS discord_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) NOT NULL,
  message JSONB NOT NULL,
  webhook_url TEXT NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create a function to queue Discord notifications
CREATE OR REPLACE FUNCTION notify_discord_on_deal()
RETURNS TRIGGER AS $$
DECLARE
  discord_config jsonb;
  webhook_url text;
  agent_name text;
  carrier_name text;
  product_name text;
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
  
  -- Get product name
  SELECT p.name INTO product_name
  FROM products p
  WHERE p.id = NEW.product_id;
  
  -- Build Discord message
  message := jsonb_build_object(
    'username', COALESCE(discord_config->>'username', 'MyAgentView Bot'),
    'avatar_url', COALESCE(discord_config->>'avatar_url', 'https://i.imgur.com/4M34hi2.png'),
    'content', '',
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', 'New Deal Submitted',
        'color', 5814783, -- Blue color in decimal
        'fields', jsonb_build_array(
          jsonb_build_object(
            'name', 'Client',
            'value', NEW.client_name,
            'inline', true
          ),
          CASE WHEN (discord_config->>'include_premium')::boolean THEN
            jsonb_build_object(
              'name', 'Premium',
              'value', CONCAT('$', NEW.annual_premium),
              'inline', true
            )
          ELSE NULL END,
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
          ELSE NULL END,
          CASE WHEN (discord_config->>'include_product')::boolean AND product_name IS NOT NULL THEN
            jsonb_build_object(
              'name', 'Product',
              'value', product_name,
              'inline', true
            )
          ELSE NULL END
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

-- Create a function to test Discord webhook
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
        'title', 'Test Notification',
        'description', 'This is a test notification from MyAgentView CRM',
        'color', 5814783, -- Blue color in decimal
        'fields', jsonb_build_array(
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

-- Add comment to explain function usage
COMMENT ON FUNCTION notify_discord_on_deal IS 'Queues a notification to Discord webhook when a new deal is created. The notification includes configurable fields like agent name, premium amount, carrier, and product.';
COMMENT ON FUNCTION test_discord_webhook IS 'Tests a Discord webhook by sending a test notification. Returns success status and message.';