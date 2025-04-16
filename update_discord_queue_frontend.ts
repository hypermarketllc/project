// Alternative approach to process Discord notifications more frequently
// Use this if the pg_cron extension is not available in your Supabase instance

import { supabase } from './src/lib/supabase';

/**
 * Process pending Discord notifications in the queue
 * This function processes notifications directly from the database
 * @returns Promise<{ processed: number, success: number, failed: number }>
 */
export async function processDiscordQueueDirect(): Promise<{ processed: number; success: number; failed: number }> {
  // Get unsent notifications (limit to 10 at a time)
  const { data: notifications, error } = await supabase
    .from('discord_notifications')
    .select('*')
    .eq('sent', false)
    .lt('retry_count', 3) // Only retry up to 3 times
    .order('created_at')
    .limit(10);
  
  if (error) {
    console.error('Error fetching Discord notifications:', error);
    return { processed: 0, success: 0, failed: 0 };
  }
  
  if (!notifications || notifications.length === 0) {
    return { processed: 0, success: 0, failed: 0 };
  }
  
  let success = 0;
  let failed = 0;
  
  // Process each notification
  for (const notification of notifications) {
    try {
      // Send to Discord webhook
      const response = await fetch(notification.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification.message),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API responded with ${response.status}: ${errorText}`);
      }
      
      // Mark as sent
      await supabase
        .from('discord_notifications')
        .update({
          sent: true,
          sent_at: new Date().toISOString(),
          error: null,
        })
        .eq('id', notification.id);
      
      console.log(`Sent notification ${notification.id} for deal ${notification.deal_id}`);
      success++;
      
    } catch (error) {
      console.error(`Error sending notification ${notification.id}:`, error);
      
      // Update retry count and error message
      await supabase
        .from('discord_notifications')
        .update({
          retry_count: notification.retry_count + 1,
          error: error instanceof Error ? error.message : String(error),
        })
        .eq('id', notification.id);
      
      failed++;
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return { processed: notifications.length, success, failed };
}

/**
 * Start the Discord notification queue processor with a faster interval
 * Runs every 10 seconds instead of 30 seconds
 * @returns A function to stop the processor
 */
export function startFastDiscordQueueProcessor(): () => void {
  console.log('Starting fast Discord notification queue processor (10-second interval)');
  
  // Process immediately on start
  processDiscordQueueDirect().then(({ processed, success, failed }) => {
    if (processed > 0) {
      console.log(`Processed ${processed} Discord notifications: ${success} succeeded, ${failed} failed`);
    }
  });
  
  // Set up interval to process every 10 seconds
  const intervalId = setInterval(async () => {
    const { processed, success, failed } = await processDiscordQueueDirect();
    if (processed > 0) {
      console.log(`Processed ${processed} Discord notifications: ${success} succeeded, ${failed} failed`);
    }
  }, 10000); // 10 seconds
  
  // Return function to stop the processor
  return () => {
    console.log('Stopping Discord notification queue processor');
    clearInterval(intervalId);
  };
}

// To use this in your application, replace the existing queue processor with this one:
// 
// import { startFastDiscordQueueProcessor } from './update_discord_queue_frontend';
// 
// // In your component:
// useEffect(() => {
//   const stopProcessor = startFastDiscordQueueProcessor();
//   return () => stopProcessor();
// }, []);