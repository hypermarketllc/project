# Telegram Integration SQL Troubleshooting

## Common Issues

### Error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

This error occurs because the original SQL script uses an `ON CONFLICT (name) DO NOTHING` clause, but there might not be a unique constraint on the "name" column in the integrations table.

**Solution:**
We've updated the `setup-telegram.sql` script to use a different approach that doesn't rely on the ON CONFLICT clause. Instead, it:
1. Checks if the integration already exists
2. Only inserts it if it doesn't exist

### Why can't we directly run some Supabase SQL commands?

There are several reasons why some SQL commands might fail in Supabase:

1. **Missing Permissions**: Some SQL commands require elevated permissions that might not be available through the SQL Editor.

2. **Database Configuration**: Supabase databases might have specific configurations or restrictions that prevent certain operations.

3. **Missing Extensions**: Some functions (like `pg_net` for HTTP requests) require extensions that might not be enabled.

4. **Schema Differences**: Your database schema might differ slightly from what we expected, causing compatibility issues.

## Step-by-Step Troubleshooting

If you encounter issues with the SQL script:

1. **Run statements individually**: Instead of running the entire script at once, try running each statement separately to identify which one is causing the issue.

2. **Check table structure**: Verify the structure of your tables using:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'integrations';
   ```

3. **Check for existing constraints**:
   ```sql
   SELECT conname, contype, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conrelid = 'integrations'::regclass;
   ```

4. **Verify if the integration already exists**:
   ```sql
   SELECT * FROM integrations WHERE name = 'Telegram Bot';
   ```

## Alternative Setup Approach

If you continue to have issues with the SQL script, you can set up the integration manually through the UI:

1. Go to Configuration > Integrations
2. Click "Add Integration"
3. Select "Telegram" as the integration type
4. Enter "Telegram Bot" as the name
5. Enter "8180040341:AAHwTw3qGuWsywdvuvtZzGQgcSXCcyHS9ok" as the bot token
6. Configure the notification settings
7. Save the integration
8. Toggle the integration to "Active"

Then, manually register the chat:
```sql
-- Create the telegram_chats table if it doesn't exist
CREATE TABLE IF NOT EXISTS telegram_chats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chat_id TEXT NOT NULL,
  chat_title TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(chat_id)
);

-- Insert the chat ID
INSERT INTO telegram_chats (chat_id, chat_title, is_active)
VALUES ('-4751491670', 'ACC Internal', TRUE)
ON CONFLICT (chat_id) DO UPDATE SET 
  chat_title = 'ACC Internal',
  is_active = TRUE;