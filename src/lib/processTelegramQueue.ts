import { supabase } from './supabase';
import toast from 'react-hot-toast';

interface TelegramNotification {
  id: string;
  deal_id: string;
  message: string;
  bot_token: string;
  chat_id: string;
  sent: boolean;
  error: string | null;
  retry_count: number;
  created_at: string;
  sent_at: string | null;
}

interface TelegramChat {
  id: string;
  chat_id: string;
  chat_title: string | null;
  added_at: string;
  is_active: boolean;
}

// Keep track of processed notification IDs to prevent duplicates
const processedNotifications = new Set<string>();

/**
 * Process pending Telegram notifications in the queue
 * @returns Promise<{ processed: number, success: number, failed: number }>
 */
export async function processTelegramQueue(): Promise<{ processed: number; success: number; failed: number }> {
  // Get unsent notifications
  const { data: notifications, error } = await supabase
    .from('telegram_notifications')
    .select('*')
    .eq('sent', false)
    .lt('retry_count', 3) // Only retry up to 3 times
    .order('created_at');
  
  if (error) {
    console.error('Error fetching Telegram notifications:', error);
    return { processed: 0, success: 0, failed: 0 };
  }
  
  if (!notifications || notifications.length === 0) {
    return { processed: 0, success: 0, failed: 0 };
  }
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  // Process each notification
  for (const notification of notifications as TelegramNotification[]) {
    // Skip if already processed (prevents duplicates)
    if (processedNotifications.has(notification.id)) {
      console.log(`Skipping already processed notification ${notification.id}`);
      skipped++;
      continue;
    }
    
    try {
      // Add to processed set before sending
      processedNotifications.add(notification.id);
      
      // Send to Telegram API
      const response = await fetch(`https://api.telegram.org/bot${notification.bot_token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: notification.chat_id,
          text: notification.message,
          parse_mode: 'HTML'
        }),
      });
      
      const responseData = await response.json();
      
      if (!response.ok || !responseData.ok) {
        throw new Error(`Telegram API responded with error: ${responseData.description || response.statusText}`);
      }
      
      // Mark as sent
      await supabase
        .from('telegram_notifications')
        .update({
          sent: true,
          sent_at: new Date().toISOString(),
          error: null,
        })
        .eq('id', notification.id);
      
      console.log(`Sent notification ${notification.id} for deal ${notification.deal_id} to chat ${notification.chat_id}`);
      success++;
      
    } catch (error) {
      console.error(`Error sending notification ${notification.id}:`, error);
      
      // Update retry count and error message
      await supabase
        .from('telegram_notifications')
        .update({
          retry_count: notification.retry_count + 1,
          error: error instanceof Error ? error.message : String(error),
        })
        .eq('id', notification.id);
      
      failed++;
    }
  }
  
  // Limit the size of the processed notifications set to prevent memory leaks
  if (processedNotifications.size > 1000) {
    const oldestEntries = Array.from(processedNotifications).slice(0, 500);
    oldestEntries.forEach(id => processedNotifications.delete(id));
  }
  
  return { processed: notifications.length - skipped, success, failed };
}

/**
 * Start the Telegram notification queue processor
 * Runs every 30 seconds
 * @returns A function to stop the processor
 */
export function startTelegramQueueProcessor(): () => void {
  console.log('Starting Telegram notification queue processor');
  
  // Process immediately on start
  processTelegramQueue().then(({ processed, success, failed }) => {
    if (processed > 0) {
      console.log(`Processed ${processed} Telegram notifications: ${success} succeeded, ${failed} failed`);
    }
  });
  
  // Set up interval to process every 10 seconds (faster processing)
  const intervalId = setInterval(async () => {
    const { processed, success, failed } = await processTelegramQueue();
    if (processed > 0) {
      console.log(`Processed ${processed} Telegram notifications: ${success} succeeded, ${failed} failed`);
    }
  }, 10000); // 10 seconds
  
  // Return function to stop the processor
  return () => {
    console.log('Stopping Telegram notification queue processor');
    clearInterval(intervalId);
  };
}

/**
 * Register a new Telegram chat to receive notifications
 * @param chatId The Telegram chat ID
 * @param chatTitle The title of the chat (optional)
 * @returns Promise<{ success: boolean, message: string }>
 */
export async function registerTelegramChat(chatId: string, chatTitle?: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase
      .rpc('register_telegram_chat', { 
        p_chat_id: chatId,
        p_chat_title: chatTitle || null
      });
    
    if (error) {
      console.error('Error registering Telegram chat:', error);
      return { success: false, message: `Error: ${error.message}` };
    }
    
    return { 
      success: true, 
      message: 'Chat registered successfully. You will now receive deal notifications in this chat.' 
    };
    
  } catch (error) {
    console.error('Error registering Telegram chat:', error);
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Unregister a Telegram chat from receiving notifications
 * @param chatId The Telegram chat ID
 * @returns Promise<{ success: boolean, message: string }>
 */
export async function unregisterTelegramChat(chatId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase
      .rpc('unregister_telegram_chat', { p_chat_id: chatId });
    
    if (error) {
      console.error('Error unregistering Telegram chat:', error);
      return { success: false, message: `Error: ${error.message}` };
    }
    
    return { 
      success: true, 
      message: 'Chat unregistered successfully. You will no longer receive deal notifications in this chat.' 
    };
    
  } catch (error) {
    console.error('Error unregistering Telegram chat:', error);
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Test the Telegram bot by sending a test message to a chat
 * @param chatId The Telegram chat ID to test
 * @returns Promise<{ success: boolean, message: string }>
 */
export async function testTelegramBot(chatId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase
      .rpc('test_telegram_bot', { p_chat_id: chatId });
    
    if (error) {
      console.error('Error testing Telegram bot:', error);
      return { success: false, message: `Error: ${error.message}` };
    }
    
    // Process the queue immediately to send the test notification
    await processTelegramQueue();
    
    return { 
      success: true, 
      message: 'Test notification sent successfully! Check your Telegram chat.' 
    };
    
  } catch (error) {
    console.error('Error testing Telegram bot:', error);
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Get all registered Telegram chats
 * @returns Promise<TelegramChat[]>
 */
export async function getTelegramChats(): Promise<TelegramChat[]> {
  try {
    const { data, error } = await supabase
      .from('telegram_chats')
      .select('*')
      .order('added_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching Telegram chats:', error);
      return [];
    }
    
    return data as TelegramChat[];
  } catch (error) {
    console.error('Error fetching Telegram chats:', error);
    return [];
  }
}