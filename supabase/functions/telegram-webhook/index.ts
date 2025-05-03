// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    date: number;
    text?: string;
    entities?: Array<{
      offset: number;
      length: number;
      type: string;
    }>;
  };
  my_chat_member?: {
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    date: number;
    old_chat_member: {
      user: {
        id: number;
        is_bot: boolean;
        first_name: string;
        username?: string;
      };
      status: string;
    };
    new_chat_member: {
      user: {
        id: number;
        is_bot: boolean;
        first_name: string;
        username?: string;
      };
      status: string;
    };
  };
}

serve(async (req) => {
  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the bot token from the environment variables
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "Bot token not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse the request body
    const update: TelegramUpdate = await req.json();
    console.log("Received update:", JSON.stringify(update));

    // Handle different types of updates
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id.toString();
      const chatTitle = update.message.chat.title || update.message.chat.username || "Private Chat";
      const text = update.message.text;

      // Handle commands
      if (text.startsWith("/start")) {
        // Register the chat
        const { data, error } = await supabaseClient.rpc("register_telegram_chat", {
          p_chat_id: chatId,
          p_chat_title: chatTitle,
        });

        if (error) {
          console.error("Error registering chat:", error);
          await sendTelegramMessage(
            botToken,
            chatId,
            "Error registering chat. Please try again later."
          );
          return new Response(JSON.stringify({ success: false }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Send welcome message
        await sendTelegramMessage(
          botToken,
          chatId,
          "👋 Hello! This chat has been registered to receive deal notifications from MyAgentView CRM.\n\nYou will now receive notifications when new deals are submitted."
        );
      } else if (text.startsWith("/stop")) {
        // Unregister the chat
        const { data, error } = await supabaseClient.rpc("unregister_telegram_chat", {
          p_chat_id: chatId,
        });

        if (error) {
          console.error("Error unregistering chat:", error);
          await sendTelegramMessage(
            botToken,
            chatId,
            "Error unregistering chat. Please try again later."
          );
          return new Response(JSON.stringify({ success: false }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Send goodbye message
        await sendTelegramMessage(
          botToken,
          chatId,
          "👋 This chat has been unregistered. You will no longer receive deal notifications."
        );
      } else if (text.startsWith("/help")) {
        // Send help message
        await sendTelegramMessage(
          botToken,
          chatId,
          "🤖 *MyAgentView Bot Commands*\n\n" +
            "/start - Register this chat to receive notifications\n" +
            "/stop - Unregister this chat from receiving notifications\n" +
            "/help - Show this help message\n" +
            "/status - Check if this chat is registered\n\n" +
            "For more information, contact your administrator."
        );
      } else if (text.startsWith("/status")) {
        // Check if the chat is registered
        const { data, error } = await supabaseClient
          .from("telegram_chats")
          .select("is_active, added_at")
          .eq("chat_id", chatId)
          .single();

        if (error) {
          console.error("Error checking chat status:", error);
          await sendTelegramMessage(
            botToken,
            chatId,
            "Error checking chat status. Please try again later."
          );
          return new Response(JSON.stringify({ success: false }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        if (data) {
          const status = data.is_active ? "active" : "inactive";
          const addedAt = new Date(data.added_at).toLocaleString();
          await sendTelegramMessage(
            botToken,
            chatId,
            `📊 *Chat Status*\n\n` +
              `Status: ${status === "active" ? "✅ Active" : "❌ Inactive"}\n` +
              `Registered on: ${addedAt}\n\n` +
              `You ${status === "active" ? "will" : "will not"} receive deal notifications in this chat.`
          );
        } else {
          await sendTelegramMessage(
            botToken,
            chatId,
            "❌ This chat is not registered. Use /start to register."
          );
        }
      }
    } else if (update.my_chat_member) {
      // Bot was added to or removed from a chat
      const chatId = update.my_chat_member.chat.id.toString();
      const chatTitle = update.my_chat_member.chat.title || update.my_chat_member.chat.username || "Unknown Chat";
      const newStatus = update.my_chat_member.new_chat_member.status;
      const oldStatus = update.my_chat_member.old_chat_member.status;

      if (
        (oldStatus === "left" || oldStatus === "kicked") &&
        (newStatus === "member" || newStatus === "administrator")
      ) {
        // Bot was added to a chat
        console.log(`Bot was added to chat ${chatId} (${chatTitle})`);
        
        // Send welcome message
        await sendTelegramMessage(
          botToken,
          chatId,
          "👋 Hello! I'm the MyAgentView notification bot. Use /start to register this chat for deal notifications."
        );
      } else if (
        (oldStatus === "member" || oldStatus === "administrator") &&
        (newStatus === "left" || newStatus === "kicked")
      ) {
        // Bot was removed from a chat
        console.log(`Bot was removed from chat ${chatId} (${chatTitle})`);
        
        // Unregister the chat
        const { error } = await supabaseClient.rpc("unregister_telegram_chat", {
          p_chat_id: chatId,
        });
        
        if (error) {
          console.error("Error unregistering chat:", error);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// Helper function to send a message to a Telegram chat
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error sending Telegram message:", errorData);
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}