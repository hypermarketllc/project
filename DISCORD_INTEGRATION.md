# Discord Integration for MyAgentView CRM

This document provides instructions for setting up and using the Discord integration in MyAgentView CRM.

## Overview

The Discord integration allows MyAgentView to send notifications to a Discord channel when certain events occur, such as:

- New deals being submitted
- Deal status changes
- (Future) Commission payments

Notifications are sent via Discord webhooks and can be customized to include specific information about the deals.

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

### 2. Apply the Discord Integration Migration

Run the migration script to set up the Discord integration in the database:

```bash
node apply-discord-integration.js
```

This will:
- Add a Discord integration entry to the `integrations` table
- Create a function to send Discord notifications
- Add a trigger to call the notification function when deals are created

### 3. Configure the Discord Integration

1. Log in to MyAgentView as an admin
2. Go to Configuration > Integrations
3. Find the "Discord Webhook" integration and click "Configure"
4. Paste the webhook URL you copied from Discord
5. Configure the notification settings:
   - Choose which events trigger notifications
   - Select what information to include in notifications
6. Click "Save"
7. Toggle the integration to "Active"

## Testing the Integration

You can test the Discord integration by running:

```bash
node test-discord-notification.js
```

This will:
1. Create a test deal in the database
2. Trigger the Discord notification
3. Send a message to your configured Discord channel

## Customizing Notifications

You can customize the Discord notifications by editing the configuration in the Integrations UI:

### Notification Content Options

- **Bot Username**: The name that appears as the sender in Discord
- **Bot Avatar URL**: The avatar image for the bot in Discord
- **Include Agent Name**: Include the name of the agent who submitted the deal
- **Include Premium**: Include the premium amount of the deal
- **Include Carrier**: Include the carrier name
- **Include Product**: Include the product name

### Notification Triggers

- **Notify on New Deal**: Send a notification when a new deal is submitted
- **Notify on Status Change**: Send a notification when a deal's status changes

## Troubleshooting

If notifications are not being sent to Discord:

1. **Check Integration Status**: Make sure the integration is set to "Active" in the Configuration > Integrations page
2. **Verify Webhook URL**: Ensure the webhook URL is correct and has not been revoked in Discord
3. **Check Database Function**: Verify the `notify_discord_on_deal` function exists in the database
4. **Check Trigger**: Verify the trigger is properly set up on the `deals` table
5. **Check Permissions**: Ensure the database has permission to make external HTTP requests

## Technical Details

The Discord integration uses the following components:

1. **Database Table**: `integrations` stores the configuration
2. **Database Function**: `notify_discord_on_deal()` formats and sends the notification
3. **Database Trigger**: Calls the function when a deal is inserted
4. **UI Component**: Allows configuration of the integration in the admin interface

The notification is sent using PostgreSQL's `pg_net` extension to make HTTP requests directly from the database.