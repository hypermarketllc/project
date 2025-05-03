import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Telegram Integration Database Setup');
console.log('==================================\n');

// Read the migration SQL file
const migrationPath = path.join(__dirname, 'supabase/migrations/20250417011000_add_telegram_integration.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Ask for Supabase credentials
rl.question('Enter your Supabase URL: ', (supabaseUrl) => {
  rl.question('Enter your Supabase service role key: ', async (supabaseKey) => {
    try {
      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      console.log('\nConnecting to Supabase...');
      
      // Execute the SQL commands
      console.log('Executing SQL commands...');
      
      console.log('Checking if Telegram integration exists...');
      const { data: existingIntegration, error: checkError } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'Telegram Bot')
        .maybeSingle();
      
      if (checkError) {
        console.error('Error checking for existing integration:', checkError);
      } else {
        if (existingIntegration) {
          console.log('Telegram integration already exists, skipping creation.');
        } else {
          console.log('Creating Telegram integration...');
          const { error: insertError } = await supabase
            .from('integrations')
            .insert({
              name: 'Telegram Bot',
              type: 'telegram',
              config: {
                bot_token: '8180040341:AAHwTw3qGuWsywdvuvtZzGQgcSXCcyHS9ok',
                notify_on_new_deal: true,
                notify_on_status_change: true,
                include_agent_name: true,
                include_premium: true,
                include_carrier: true,
                include_product: true
              },
              is_active: false
            });
          
          if (insertError) {
            console.error('Error creating Telegram integration:', insertError);
          } else {
            console.log('Telegram integration created successfully.');
          }
        }
      }
      
      console.log('Creating telegram_chats table...');
      const createChatsTableSQL = `
        CREATE TABLE IF NOT EXISTS telegram_chats (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          chat_id TEXT NOT NULL,
          chat_title TEXT,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE,
          UNIQUE(chat_id)
        );
      `;
      
      const { error: createTableError } = await supabase.rpc('exec_sql', { sql: createChatsTableSQL });
      if (createTableError) {
        console.error('Error creating telegram_chats table:', createTableError);
      } else {
        console.log('telegram_chats table created successfully.');
      }
      
      console.log('Creating telegram_notifications table...');
      const createNotificationsTableSQL = `
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
      `;
      
      const { error: createNotificationsTableError } = await supabase.rpc('exec_sql', { sql: createNotificationsTableSQL });
      if (createNotificationsTableError) {
        console.error('Error creating telegram_notifications table:', createNotificationsTableError);
      } else {
        console.log('telegram_notifications table created successfully.');
      }
      
      // Create the functions and trigger
      console.log('Creating functions and trigger...');
      const functionsAndTriggerSQL = [
        // notify_telegram_on_deal function
        `CREATE OR REPLACE FUNCTION notify_telegram_on_deal()
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
          
          -- Build Telegram message
          message := '💰 New Deal Submitted 💰' || E'\\n\\n';
          message := message || 'Client: ' || NEW.client_name || E'\\n';
          
          IF (telegram_config->>'include_premium')::boolean THEN
            message := message || 'Premium: $' || NEW.annual_premium || E'\\n';
          END IF;
          
          IF (telegram_config->>'include_agent_name')::boolean AND agent_name IS NOT NULL THEN
            message := message || 'Agent: ' || agent_name || E'\\n';
          END IF;
          
          IF (telegram_config->>'include_carrier')::boolean AND carrier_name IS NOT NULL THEN
            message := message || 'Carrier: ' || carrier_name || E'\\n';
          END IF;
          
          IF (telegram_config->>'include_product')::boolean AND product_name IS NOT NULL THEN
            message := message || 'Product: ' || product_name || E'\\n';
          END IF;
          
          -- Queue the notification for each active chat
          FOR chat_record IN
            SELECT * FROM telegram_chats WHERE is_active = TRUE
          LOOP
            INSERT INTO telegram_notifications (deal_id, message, bot_token, chat_id)
            VALUES (NEW.id, message, bot_token, chat_record.chat_id);
          END LOOP;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;`,
        
        // register_telegram_chat function
        `CREATE OR REPLACE FUNCTION register_telegram_chat(p_chat_id TEXT, p_chat_title TEXT)
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
        $$ LANGUAGE plpgsql;`,
        
        // unregister_telegram_chat function
        `CREATE OR REPLACE FUNCTION unregister_telegram_chat(p_chat_id TEXT)
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
        $$ LANGUAGE plpgsql;`,
        
        // test_telegram_bot function
        `CREATE OR REPLACE FUNCTION test_telegram_bot(p_chat_id TEXT)
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
            'Test Notification from MyAgentView CRM' || E'\\n\\n' ||
            'If you can see this message, Telegram integration is working!',
            bot_token,
            p_chat_id
          );
          
          RETURN QUERY SELECT true, 'Test notification queued successfully. It will be sent within 30 seconds.';
        EXCEPTION
          WHEN OTHERS THEN
            RETURN QUERY SELECT false, 'Error: ' || SQLERRM;
        END;
        $$ LANGUAGE plpgsql;`,
        
        // Create trigger
        `DROP TRIGGER IF EXISTS trigger_telegram_notification_on_deal ON deals;`,
        
        `CREATE TRIGGER trigger_telegram_notification_on_deal
        AFTER INSERT ON deals
        FOR EACH ROW
        EXECUTE FUNCTION notify_telegram_on_deal();`
      ];
      
      for (let i = 0; i < functionsAndTriggerSQL.length; i++) {
        const sql = functionsAndTriggerSQL[i];
        console.log(`Executing SQL command ${i + 1}/${functionsAndTriggerSQL.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql });
        
        if (error) {
          console.error(`Error executing SQL command ${i + 1}:`, error);
        }
      }
      
      // Register the ACC Internal chat
      console.log('\nRegistering the ACC Internal chat...');
      const { data, error } = await supabase.rpc('register_telegram_chat', {
        p_chat_id: '-4751491670',
        p_chat_title: 'ACC Internal'
      });
      
      if (error) {
        console.error('Error registering chat:', error);
      } else {
        console.log('Chat registered successfully!');
      }
      
      console.log('\nSetup complete!');
      console.log('\nNext steps:');
      console.log('1. Go to Configuration > Integrations in the UI');
      console.log('2. Find the Telegram integration and click "Configure"');
      console.log('3. Verify the bot token is correct');
      console.log('4. Save the configuration');
      console.log('5. Toggle the integration to "Active"');
      console.log('6. Test the integration using the "Test Bot" button');
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      rl.close();
    }
  });
});