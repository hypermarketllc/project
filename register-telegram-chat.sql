-- This script registers the "ACC Internal" chat for Telegram notifications
-- Run this in the Supabase SQL Editor

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

-- Verify the chat was registered
SELECT * FROM telegram_chats WHERE chat_id = '-4751491670';