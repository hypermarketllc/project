# Discord Queue Integration for MyAgentView CRM 💰

This document provides instructions for setting up and using the enhanced queue-based Discord integration in MyAgentView CRM.

## Overview

The Discord integration allows MyAgentView to send notifications to a Discord channel when certain events occur, such as:

- New deals being submitted (with 💰 emoji and deal counter)
- Deal status changes
- (Future) Commission payments

Notifications are sent via Discord webhooks and can be customized to include specific information about the deals. This implementation uses a queue-based system for improved reliability and error handling.

### Enhanced Notification Features

The Discord notifications include several enhanced features:

1. **Money Emoji**: 💰 emoji appears before and after "New Deal Submitted" for visual emphasis
2. **Deal Counter**: When an agent submits multiple deals in a day, notifications show a counter (e.g., "💰 New Deal Submitted x2 💰")
3. **Premium Display**: Annual premium is always shown in the notification
4. **Streamlined Information**: Product information is omitted for cleaner notifications

## How It Works

1. When a deal is created, a trigger function queues a notification in the `discord_notifications` table
2. A background process checks the queue every 30 seconds and sends pending notifications
3. Failed notifications can be retried automatically (up to 3 times)
4. The system tracks which notifications have been sent and any errors that occurred

## Setup Instructions

### 1. Create a Discord Webhook

First, you need to create a webhook in your Discord server:

1. Open Discord and go to the server where you want to receive notifications
2. Go to Server Settings > Integrations > Webhooks
3. Click "New Webhook"
4. Give your webhook a name (e.g., "MyAgentView Notifications")
5. Select the channel where notifications should be sent
6. Click "Copy Webhook URL" to copy the webhook URL
7. Click "Save"

### 2. Apply the Discord Queue Migration

You have two options to set up the Discord queue system:

#### Option A: Run the SQL Script Directly

1. Open the Supabase SQL Editor
2. Copy the contents of `discord_queue_setup.sql`
3. Paste it into the SQL Editor and run it
4. To apply the enhanced notification features, run `enhance_discord_notifications.sql`

#### Option B: Use the Migration Script

Run the migration scripts to set up the Discord queue system:

```bash
# First, set up the basic queue system
node apply-discord-queue.js

# Then, apply the notification enhancements
node apply-discord-enhancements.js
```

### 3. Configure the Discord Integration

1. Log in to MyAgentView as an admin
2. Go to Configuration > Integrations
3. Find the "Discord Webhook" integration and click "Configure"
4. Paste the webhook URL you copied from Discord
5. Configure the notification settings:
   - Choose which events trigger notifications
   - Select what information to include in notifications
6. Click the "Test Webhook" button to verify the integration works
7. Click "Save"
8. Toggle the integration to "Active"

## Testing the Integration

You can test the Discord integration directly from the UI:

1. Go to Configuration > Integrations
2. Find the Discord integration and click "Configure"
3. Enter your webhook URL
4. Click the "Test Webhook" button
5. Check your Discord channel for the test notification

The test notification should appear in your Discord channel within 30 seconds.

## Troubleshooting

If notifications are not being sent to Discord:

1. **Check Integration Status**: Make sure the integration is set to "Active" in the Configuration > Integrations page
2. **Verify Webhook URL**: Ensure the webhook URL is correct and has not been revoked in Discord
3. **Check Queue**: Look at the `discord_notifications` table to see if notifications are being queued
4. **Check for Errors**: Look at the `error` column in the `discord_notifications` table for any error messages
5. **Restart the Queue Processor**: Refresh the page to restart the queue processor

## Technical Details

The Discord queue integration uses the following components:

1. **Database Table**: `discord_notifications` stores the queued notifications
2. **Database Function**: `notify_discord_on_deal()` queues notifications when deals are created
3. **Database Trigger**: Calls the function when a deal is inserted
4. **Test Function**: `test_discord_webhook()` allows testing the webhook
5. **Frontend Queue Processor**: Runs every 30 seconds to process the queue
6. **UI Component**: Allows configuration and testing of the integration

## Customizing Notifications

You can customize the Discord notifications by editing the configuration in the Integrations UI:

### Notification Content Options

- **Bot Username**: The name that appears as the sender in Discord
- **Bot Avatar URL**: The avatar image for the bot in Discord
- **Include Agent Name**: Include the name of the agent who submitted the deal
- **Include Carrier**: Include the carrier name
- **Premium**: Always included in notifications (not configurable)
- **Deal Counter**: Automatically shows x2, x3, etc. for multiple deals by the same agent in one day

### Notification Format

The enhanced notifications have the following format:

```
💰 New Deal Submitted 💰
(or 💰 New Deal Submitted x2 💰 for multiple deals)

Client: [Client Name]
Premium: $[Amount]
Agent: [Agent Name]
Carrier: [Carrier Name]
```

### Notification Triggers

- **Notify on New Deal**: Send a notification when a new deal is submitted
- **Notify on Status Change**: Send a notification when a deal's status changes

### Example Notification

Here's an example of how the enhanced notifications appear in Discord:

```
💰 New Deal Submitted 💰

Client: John Smith
Premium: $1,200.00
Agent: Jane Doe
Carrier: Liberty Mutual
```

For an agent's second deal of the day:

```
💰 New Deal Submitted x2 💰

Client: Sarah Johnson
Premium: $850.00
Agent: Jane Doe
Carrier: Nationwide
```