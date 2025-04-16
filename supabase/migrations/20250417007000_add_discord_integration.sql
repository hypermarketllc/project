/*
  # Add Discord Integration
  
  1. Changes
    - Add default Discord integration to the integrations table
    - Create a function to send Discord notifications when deals are created
    - Add a trigger to call the notification function on deal insert
*/

-- Insert default Discord integration if it doesn't exist
INSERT INTO integrations (name, type, config, is_active)
VALUES (
  'Discord Webhook',
  'discord',
  jsonb_build_object(
    'webhook_url', '',
    'notify_on_new_deal', true,
    'notify_on_status_change', true,
    'include_agent_name', true,
    'include_premium', true,
    'include_carrier', true,
    'include_product', true,
    'avatar_url', 'https://i.imgur.com/4M34hi2.png',
    'username', 'MyAgentView Bot'
  ),
  false
)
ON CONFLICT (name) DO NOTHING;

-- Create a function to send Discord notifications
CREATE OR REPLACE FUNCTION notify_discord_on_deal()
RETURNS TRIGGER AS $$
DECLARE
  discord_config jsonb;
  webhook_url text;
  agent_name text;
  carrier_name text;
  product_name text;
  message jsonb;
  is_active boolean;
BEGIN
  -- Get Discord integration config
  SELECT config, is_active INTO discord_config, is_active
  FROM integrations
  WHERE type = 'discord' AND name = 'Discord Webhook'
  LIMIT 1;
  
  -- Check if Discord integration is active
  IF NOT FOUND OR NOT is_active THEN
    RETURN NEW;
  END IF;
  
  -- Get webhook URL
  webhook_url := discord_config->>'webhook_url';
  
  -- If no webhook URL is configured, exit
  IF webhook_url IS NULL OR webhook_url = '' THEN
    RETURN NEW;
  END IF;
  
  -- Get agent name
  SELECT full_name INTO agent_name
  FROM users
  WHERE id = NEW.agent_id;
  
  -- Get carrier name
  SELECT name INTO carrier_name
  FROM carriers
  WHERE id = NEW.carrier_id;
  
  -- Get product name
  SELECT name INTO product_name
  FROM products
  WHERE id = NEW.product_id;
  
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
  
  -- Send webhook notification (using pg_net extension)
  PERFORM net.http_post(
    url := webhook_url,
    body := message::text,
    headers := '{"Content-Type": "application/json"}'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to send Discord notification on deal insert
DROP TRIGGER IF EXISTS trigger_discord_notification_on_deal ON deals;
CREATE TRIGGER trigger_discord_notification_on_deal
AFTER INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION notify_discord_on_deal();

-- Add comment to explain function usage
COMMENT ON FUNCTION notify_discord_on_deal IS 'Sends a notification to Discord webhook when a new deal is created. The notification includes configurable fields like agent name, premium amount, carrier, and product.';