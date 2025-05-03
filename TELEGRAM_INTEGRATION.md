# Telegram Integration for MyAgentView CRM

This document provides instructions for setting up and using the Telegram integration in MyAgentView CRM.

## Quick Start

The bot has already been added to the "ACC Internal" group chat (ID: -4751491670).

## Overview

The Telegram integration allows MyAgentView to send notifications to multiple Telegram channels when certain events occur, such as:

- New deals being submitted
- Deal status changes
- (Future) Commission payments

Notifications are sent via the Telegram Bot API and can be customized to include specific information about the deals.

## Setup Instructions

### 1. Apply the Telegram Integration Migration

Run the migration script to set up the Telegram integration in the database:

```bash
node apply-telegram-integration.js
```

This will:
- Add a Telegram integration entry to the `integrations` table
- Create tables to store Telegram chats and notifications
- Create functions to send Telegram notifications
- Add a trigger to call the notification function when deals are created

### 2. Run the SQL Setup Script

We've provided a SQL script that sets up all the necessary database objects and registers the "ACC Internal" group chat:

1. **Option A: Run the SQL Script Directly**
   - Open the Supabase SQL Editor
   - Open the file `setup-telegram.sql`
   - Run the entire script

2. **Option B: Use the Setup Script**
   - Run the setup script:
   ```bash
   node setup-telegram-db.js
   ```
   - Follow the prompts to enter your Supabase URL and service role key

This will:
- Create the necessary tables and functions
- Register the "ACC Internal" group chat (ID: -4751491670) to receive notifications

### 3. Deploy the Telegram Webhook Function (Optional)

If you want to enable automatic chat registration through the bot commands, deploy the Telegram webhook function:

```bash
npx supabase functions deploy telegram-webhook --no-verify-jwt
```

Then set up the webhook URL in Telegram:

```
https://api.telegram.org/bot8180040341:AAHwTw3qGuWsywdvuvtZzGQgcSXCcyHS9ok/setWebhook?url=<YOUR_FUNCTION_URL>
```

Replace `<YOUR_FUNCTION_URL>` with the URL of your deployed function (e.g., https://your-project.supabase.co/functions/v1/telegram-webhook)

### 4. Configure the Telegram Integration

1. Log in to MyAgentView as an admin
2. Go to Configuration > Integrations
3. Find the "Telegram Bot" integration and click "Configure"
4. Verify the bot token is correct (it should be pre-filled)
5. Configure the notification settings:
   - Choose which events trigger notifications
   - Select what information to include in notifications
6. Click "Save"
7. Toggle the integration to "Active"

## Adding the Bot to Telegram Chats

To receive notifications in a Telegram chat:

1. Add the bot @acc_policy_bot to your Telegram group or channel
2. Make the bot an administrator in the group/channel
3. Send the command `/start` in the chat
4. The bot will register the chat and start sending deal notifications

## Bot Commands

The Telegram bot supports the following commands:

- `/start` - Register the chat to receive notifications
- `/stop` - Unregister the chat from receiving notifications
- `/help` - Show help information
- `/status` - Check if the chat is registered and active

## Testing the Integration

You can test the Telegram integration from the admin interface:

1. Go to Configuration > Integrations
2. Find the "Telegram Bot" integration and click "Configure"
3. Scroll down to the "Telegram Chat Status" section
4. Enter the chat ID `-4751491670` in the "Test Bot" field
5. Click "Test Bot" to send a test notification

Alternatively, you can test directly from the database:

```sql
-- Run this in the Supabase SQL Editor
SELECT test_telegram_bot('-4751491670');
```

## Customizing Notifications

You can customize the Telegram notifications by editing the configuration in the Integrations UI:

### Notification Content Options

- **Include Agent Name**: Include the name of the agent who submitted the deal
- **Include Premium**: Include the premium amount of the deal
- **Include Carrier**: Include the carrier name
- **Include Product**: Include the product name

### Notification Triggers

- **Notify on New Deal**: Send a notification when a new deal is submitted
- **Notify on Status Change**: Send a notification when a deal's status changes

## Troubleshooting

If notifications are not being sent to Telegram:

1. **Check Integration Status**: Make sure the integration is set to "Active" in the Configuration > Integrations page
2. **Verify Bot Token**: Ensure the bot token is correct
3. **Check Chat Registration**: Verify the chat is registered and active in the Telegram Chat Status section
4. **Check Webhook**: Make sure the webhook is properly set up in Telegram
5. **Check Logs**: Look at the Supabase function logs for any errors

## Technical Details

The Telegram integration uses the following components:

1. **Database Tables**:
   - `integrations` stores the configuration
   - `telegram_chats` stores registered chat IDs
   - `telegram_notifications` stores the notification queue

2. **Database Functions**:
   - `notify_telegram_on_deal()` queues notifications when deals are created
   - `register_telegram_chat()` registers a chat to receive notifications
   - `unregister_telegram_chat()` unregisters a chat from receiving notifications
   - `test_telegram_bot()` sends a test notification to a chat

3. **Edge Function**:
   - `telegram-webhook` handles incoming messages from Telegram

4. **Frontend Components**:
   - Integration configuration UI
   - Telegram chat status UI
   - Queue processor to send notifications

The notifications are sent using a queue-based system for improved reliability and error handling.