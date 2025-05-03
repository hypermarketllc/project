import readline from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Telegram Notification Test Guide');
console.log('===============================\n');

console.log('This script provides instructions for testing the Telegram integration.');
console.log('To test the Telegram integration, follow these steps:\n');

console.log('1. Make sure the Telegram integration is active:');
console.log('   - Go to Configuration > Integrations');
console.log('   - Find the "Telegram Bot" integration and make sure it\'s active\n');

console.log('2. Add the bot to your Telegram chat:');
console.log('   - Add @acc_policy_bot to your Telegram group or channel');
console.log('   - Make the bot an administrator');
console.log('   - Send the command /start in the chat\n');

console.log('3. Use the "ACC Internal" group chat:');
console.log('   - Chat ID: -4751491670');
console.log('   - The bot has already been added to this chat\n');

console.log('4. Test the integration:');
console.log('   - Go to Configuration > Integrations');
console.log('   - Find the "Telegram Bot" integration and click "Configure"');
console.log('   - Scroll down to the "Telegram Chat Status" section');
console.log('   - Enter -4751491670 in the "Test Bot" field');
console.log('   - Click "Test Bot" to send a test notification\n');

console.log('5. Check your Telegram chat for the test notification\n');

console.log('For more detailed instructions, refer to TELEGRAM_INTEGRATION.md');

// Ask if the user wants to enter a chat ID for testing
rl.question('\nWould you like to enter a chat ID for testing? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    rl.question('Enter your Telegram chat ID (or press Enter to use -4751491670): ', (chatId) => {
      // Use the ACC Internal chat ID if none provided
      if (!chatId.trim()) {
        chatId = '-4751491670';
        console.log('Using the "ACC Internal" group chat ID: -4751491670');
      }
      console.log(`\nTo test with chat ID ${chatId}:`);
      console.log('1. Go to Configuration > Integrations');
      console.log('2. Find the "Telegram Bot" integration and click "Configure"');
      console.log('3. Scroll down to the "Telegram Chat Status" section');
      console.log(`4. Enter ${chatId} in the "Test Bot" field`);
      console.log('5. Click "Test Bot" to send a test notification');
      console.log('6. Check your Telegram chat for the test notification');
      rl.close();
    });
  } else {
    console.log('\nFollow the instructions above to test the Telegram integration.');
    rl.close();
  }
});