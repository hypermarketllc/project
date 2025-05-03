import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Loader2, RefreshCw, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { getTelegramChats, unregisterTelegramChat, testTelegramBot } from '../../lib/processTelegramQueue';

interface TelegramChat {
  id: string;
  chat_id: string;
  chat_title: string | null;
  added_at: string;
  is_active: boolean;
}

const TelegramChatStatus = () => {
  const queryClient = useQueryClient();
  const [testChatId, setTestChatId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Query to fetch Telegram chats
  const { data: chats, isLoading, refetch } = useQuery<TelegramChat[]>(
    'telegram-chats',
    getTelegramChats,
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Mutation to unregister a chat
  const unregisterChat = useMutation(
    (chatId: string) => unregisterTelegramChat(chatId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('telegram-chats');
      },
    }
  );

  // Handle test bot submission
  const handleTestBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testChatId) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testTelegramBot(testChatId);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle unregister chat
  const handleUnregisterChat = (chatId: string) => {
    if (window.confirm('Are you sure you want to unregister this chat?')) {
      unregisterChat.mutate(chatId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Telegram Chat Status</h2>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Test Bot Form */}
      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Test Telegram Bot</h3>
        <form onSubmit={handleTestBot} className="flex items-end space-x-4">
          <div className="flex-grow">
            <label htmlFor="test-chat-id" className="block text-xs font-medium text-gray-500 mb-1">
              Chat ID
            </label>
            <input
              type="text"
              id="test-chat-id"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              placeholder="Enter chat ID to test"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isTesting || !testChatId}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Bot'
            )}
          </button>
        </form>
        {testResult && (
          <div
            className={`mt-2 p-2 text-sm rounded ${
              testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="inline-block h-4 w-4 mr-1" />
            ) : (
              <XCircle className="inline-block h-4 w-4 mr-1" />
            )}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Registered Chats */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Registered Chats</h3>
        {chats && chats.length > 0 ? (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                  >
                    Chat ID
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Chat Title
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Added At
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Status
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {chats.map((chat) => (
                  <tr key={chat.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {chat.chat_id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {chat.chat_title || 'Unnamed Chat'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(chat.added_at).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          chat.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {chat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        onClick={() => handleUnregisterChat(chat.chat_id)}
                        className="text-red-600 hover:text-red-900"
                        title="Unregister chat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-md">
            <p className="text-gray-500 text-sm">
              No chats registered yet. Add the bot to a Telegram chat and send the /start command to register.
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-blue-50 p-4 rounded-md">
        <h3 className="text-sm font-medium text-blue-800 mb-2">How to Add the Bot to Your Telegram Chats</h3>
        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-2">
          <li>Add the bot @acc_policy_bot to your Telegram group or channel</li>
          <li>Make the bot an administrator in the group/channel</li>
          <li>Send the command /start in the chat</li>
          <li>The bot will register the chat and start sending deal notifications</li>
        </ol>
      </div>
    </div>
  );
};

export default TelegramChatStatus;