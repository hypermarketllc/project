/*
  # Add Telegram Integration
  
  1. Changes
    - Add default Telegram integration to the integrations table
    - Create a table to store Telegram chat IDs
    - Create a function to send Telegram notifications when deals are created
    - Add a trigger to call the notification function on deal insert
*/

-- Insert default Telegram integration if it doesn't exist
INSERT INTO integrations (name, type, config, is_active)
VALUES (
  'Telegram Bot',
  'telegram',
  jsonb_build_object(
    'bot_token', '8180040341:AAHwTw3qGuWsywdvuvtZzGQgcSXCcyHS9ok',
    'notify_on_new_deal', true,
    'notify_on_status_change', true,
    'include_agent_name', true,
    'include_premium', true,
    'include_carrier', true,
    'include_product', true
  ),
  false
)
ON CONFLICT (name) DO NOTHING;

-- Create a table to store Telegram chat IDs
CREATE TABLE IF NOT EXISTS telegram_chats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chat_id TEXT NOT NULL,
  chat_title TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(chat_id)
);

-- Create a table to store Telegram notifications
CREATE TABLE IF NOT EXISTS telegram_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) NOT NULL,
  message TEXT NOT NULL,
  bot_token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create a function to queue Telegram notifications
CREATE OR REPLACE FUNCTION notify_telegram_on_deal()
RETURNS TRIGGER AS $$
DECLARE
  telegram_config jsonb;
  bot_token text;
  agent_name text;
  carrier_name text;
  product_name text;
  message text;
  integration_is_active boolean;
  chat_record RECORD;
BEGIN
  -- Get Telegram integration config
  SELECT i.config, i.is_active INTO telegram_config, integration_is_active
  FROM integrations i
  WHERE i.type = 'telegram' AND i.name = 'Telegram Bot'
  LIMIT 1;
  
  -- Check if Telegram integration is active
  IF NOT FOUND OR NOT integration_is_active THEN
    RETURN NEW;
  END IF;
  
  -- Get bot token
  bot_token := telegram_config->>'bot_token';
  
  -- If no bot token is configured, exit
  IF bot_token IS NULL OR bot_token = '' THEN
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
  
  -- Check if this is a multiple deal for the same agent today
  DECLARE
    deal_count INTEGER;
    message_title TEXT;
  BEGIN
    -- Count deals by this agent today
    SELECT COUNT(*) INTO deal_count
    FROM deals
    WHERE agent_id = NEW.agent_id
      AND DATE(created_at) = CURRENT_DATE
      AND id != NEW.id;
    
    -- Build message title with counter if needed
    IF deal_count > 0 THEN
      message_title := '💰 New Deal Submitted x' || (deal_count + 1)::TEXT || ' 💰';
    ELSE
      message_title := '💰 New Deal Submitted 💰';
    END IF;
    
    -- Build Telegram message
    message := message_title || E'\n\n';
    message := message || 'Client: ' || NEW.client_name || E'\n';
    
    IF (telegram_config->>'include_premium')::boolean THEN
      message := message || 'Premium: $' || NEW.annual_premium || E'\n';
    END IF;
    
    IF (telegram_config->>'include_agent_name')::boolean AND agent_name IS NOT NULL THEN
      message := message || 'Agent: ' || agent_name || E'\n';
    END IF;
    
    IF (telegram_config->>'include_carrier')::boolean AND carrier_name IS NOT NULL THEN
      message := message || 'Carrier: ' || carrier_name || E'\n';
    END IF;
    
    IF (telegram_config->>'include_product')::boolean AND product_name IS NOT NULL THEN
      message := message || 'Product: ' || product_name || E'\n';
    END IF;
  END;
  
  -- Queue the notification for each active chat
  FOR chat_record IN 
    SELECT * FROM telegram_chats WHERE is_active = TRUE
  LOOP
    INSERT INTO telegram_notifications (deal_id, message, bot_token, chat_id)
    VALUES (NEW.id, message, bot_token, chat_record.chat_id);
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to send Telegram notification on deal insert
DROP TRIGGER IF EXISTS trigger_telegram_notification_on_deal ON deals;
CREATE TRIGGER trigger_telegram_notification_on_deal
AFTER INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION notify_telegram_on_deal();

-- Add comment to explain function usage
COMMENT ON FUNCTION notify_telegram_on_deal IS 'Queues notifications to Telegram chats when a new deal is created. The notification includes configurable fields like agent name, premium amount, carrier, and product.';

-- Create a function to register a new Telegram chat
CREATE OR REPLACE FUNCTION register_telegram_chat(p_chat_id TEXT, p_chat_title TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
BEGIN
  -- Insert the chat ID if it doesn't exist, or update it if it does
  INSERT INTO telegram_chats (chat_id, chat_title, is_active)
  VALUES (p_chat_id, p_chat_title, TRUE)
  ON CONFLICT (chat_id) 
  DO UPDATE SET 
    chat_title = p_chat_title,
    is_active = TRUE;
    
  RETURN QUERY SELECT true, 'Chat registered successfully. You will now receive deal notifications in this chat.';
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create a function to unregister a Telegram chat
CREATE OR REPLACE FUNCTION unregister_telegram_chat(p_chat_id TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
BEGIN
  -- Update the chat to inactive
  UPDATE telegram_chats
  SET is_active = FALSE
  WHERE chat_id = p_chat_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Chat unregistered successfully. You will no longer receive deal notifications in this chat.';
  ELSE
    RETURN QUERY SELECT false, 'Chat not found.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create a function to test Telegram bot
CREATE OR REPLACE FUNCTION test_telegram_bot(p_chat_id TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
  telegram_config jsonb;
  bot_token text;
BEGIN
  -- Get Telegram integration config
  SELECT config INTO telegram_config
  FROM integrations
  WHERE type = 'telegram' AND name = 'Telegram Bot'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Telegram integration not found.';
    RETURN;
  END IF;
  
  -- Get bot token
  bot_token := telegram_config->>'bot_token';
  
  -- If no bot token is configured, exit
  IF bot_token IS NULL OR bot_token = '' THEN
    RETURN QUERY SELECT false, 'Bot token not configured.';
    RETURN;
  END IF;
  
  -- Queue a test message
  INSERT INTO telegram_notifications (
    deal_id, 
    message, 
    bot_token, 
    chat_id
  )
  VALUES (
    (SELECT id FROM deals ORDER BY created_at DESC LIMIT 1), -- Get the latest deal ID
    'Test Notification from MyAgentView CRM' || E'\n\n' ||
    'If you can see this message, Telegram integration is working!',
    bot_token,
    p_chat_id
  );
  
  RETURN QUERY SELECT true, 'Test notification queued successfully. It will be sent within 30 seconds.';
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION register_telegram_chat IS 'Registers a Telegram chat to receive notifications.';
COMMENT ON FUNCTION unregister_telegram_chat IS 'Unregisters a Telegram chat from receiving notifications.';
COMMENT ON FUNCTION test_telegram_bot IS 'Tests the Telegram bot by sending a test notification to the specified chat.';