import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { supabase } from '../../lib/supabase';
import { Loader2, Plus, Power, PowerOff, Send, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import toast from 'react-hot-toast';
import { testDiscordWebhook, startDiscordQueueProcessor } from '../../lib/processDiscordQueue';
import { testTelegramBot, startTelegramQueueProcessor } from '../../lib/processTelegramQueue';
import DiscordNotificationStatus from './DiscordNotificationStatus';
import TelegramChatStatus from './TelegramChatStatus';

interface Integration {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Start the Discord queue processor when the app loads
let stopDiscordQueueProcessor: (() => void) | null = null;
let stopTelegramQueueProcessor: (() => void) | null = null;

const Integrations = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);

  // Start the Discord queue processor when the component mounts
  useEffect(() => {
    // Start the queue processors if they're not already running
    if (!stopDiscordQueueProcessor) {
      stopDiscordQueueProcessor = startDiscordQueueProcessor();
    }
    
    if (!stopTelegramQueueProcessor) {
      stopTelegramQueueProcessor = startTelegramQueueProcessor();
    }
    
    // Clean up when the component unmounts
    return () => {
      if (stopDiscordQueueProcessor) {
        stopDiscordQueueProcessor();
        stopDiscordQueueProcessor = null;
      }
      
      if (stopTelegramQueueProcessor) {
        stopTelegramQueueProcessor();
        stopTelegramQueueProcessor = null;
      }
    };
  }, []);

  const { data: integrations, isLoading } = useQuery<Integration[]>('integrations', async () => {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  });

  const toggleIntegration = useMutation(
    async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('integrations')
        .update({ is_active })
        .eq('id', id)
        .select();
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('integrations');
        toast.success('Integration status updated');
      },
      onError: (error: any) => {
        toast.error('Failed to update integration status');
        console.error('Error updating integration:', error);
      }
    }
  );

  const deleteIntegration = useMutation(
    async (id: string) => {
      // First, delete any related notifications
      await supabase
        .from('discord_notifications')
        .delete()
        .eq('webhook_url', integrationToDelete?.config?.webhook_url || '');
      
      // Then delete the integration
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('integrations');
        toast.success('Integration deleted');
        setIsDeleteModalOpen(false);
        setIntegrationToDelete(null);
      },
      onError: (error: any) => {
        toast.error('Failed to delete integration');
        console.error('Error deleting integration:', error);
      }
    }
  );

  const handleDeleteClick = (integration: Integration) => {
    setIntegrationToDelete(integration);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (integrationToDelete) {
      deleteIntegration.mutate(integrationToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
          <button
            onClick={() => {
              setEditingIntegration(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {integrations?.map((integration) => (
            <div
              key={integration.id}
              className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200"
            >
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">{integration.type}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleIntegration.mutate({
                        id: integration.id,
                        is_active: !integration.is_active
                      })}
                      className={`inline-flex items-center p-2 rounded-full ${
                        integration.is_active
                          ? 'text-green-600 bg-green-100 hover:bg-green-200'
                          : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={integration.is_active ? "Turn off" : "Turn on"}
                    >
                      {integration.is_active ? (
                        <Power className="h-5 w-5" />
                      ) : (
                        <PowerOff className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(integration)}
                      className="inline-flex items-center p-2 rounded-full text-red-600 bg-red-100 hover:bg-red-200"
                      title="Delete integration"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setEditingIntegration(integration);
                      setIsModalOpen(true);
                    }}
                    className="text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    Configure
                  </button>
                </div>
              </div>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <span className={`h-2.5 w-2.5 rounded-full mr-2 ${
                      integration.is_active ? 'bg-green-400' : 'bg-gray-400'
                    }`} />
                    <span className="text-gray-500">
                      {integration.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="text-gray-500">
                    Last updated: {new Date(integration.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Configuration Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {editingIntegration ? `Configure ${editingIntegration.name}` : 'Add Integration'}
                  </Dialog.Title>
                  
                  <IntegrationForm
                    integration={editingIntegration}
                    onClose={() => setIsModalOpen(false)}
                  />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirmation Modal */}
      <Transition appear show={isDeleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsDeleteModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Delete Integration
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete the integration "{integrationToDelete?.name}"? 
                      This action cannot be undone and will also remove all related notifications.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      onClick={confirmDelete}
                      disabled={deleteIntegration.isLoading}
                    >
                      {deleteIntegration.isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Integration Status Sections */}
      <div className="mt-12 border-t border-gray-200 pt-8 space-y-12">
        {/* Discord Notification Status */}
        <DiscordNotificationStatus />
        
        {/* Telegram Chat Status */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <TelegramChatStatus />
        </div>
      </div>
    </div>
  );
};


// Integration configuration form component
const IntegrationForm = ({
  integration,
  onClose
}: {
  integration: Integration | null;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Integration>>(
    integration || {
      name: '',
      type: 'discord',
      config: {
        webhook_url: '',
        notify_on_new_deal: true,
        notify_on_status_change: true,
        include_agent_name: true,
        include_premium: true,
        include_carrier: true,
        include_product: true,
        avatar_url: 'https://i.imgur.com/4M34hi2.png',
        username: 'MyAgentView Bot'
      },
      is_active: false
    }
  );
  
  // State for testing integrations
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [telegramChatId, setTelegramChatId] = useState('-4751491670'); // Default to ACC Internal chat
  
  // Function to test Discord webhook
  const handleTestWebhook = async () => {
    if (!formData.config?.webhook_url) {
      toast.error('Please enter a webhook URL first');
      return;
    }
    
    setIsTestingWebhook(true);
    setTestResult(null);
    
    try {
      const result = await testDiscordWebhook(formData.config.webhook_url);
      setTestResult(result);
      
      if (result.success) {
        toast.success('Test notification sent successfully!');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      });
      toast.error('Failed to test webhook');
    } finally {
      setIsTestingWebhook(false);
    }
  };
  
  // Function to test Telegram bot
  const handleTestTelegram = async () => {
    if (!formData.config?.bot_token) {
      toast.error('Please enter a bot token first');
      return;
    }
    
    if (!telegramChatId) {
      toast.error('Please enter a chat ID');
      return;
    }
    
    setIsTestingTelegram(true);
    setTestResult(null);
    
    try {
      const result = await testTelegramBot(telegramChatId);
      setTestResult(result);
      
      if (result.success) {
        toast.success('Test notification sent successfully!');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      });
      toast.error('Failed to test Telegram bot');
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const saveIntegration = useMutation(
    async (data: Partial<Integration>) => {
      if (integration?.id) {
        // Update existing integration
        const { data: updatedData, error } = await supabase
          .from('integrations')
          .update({
            name: data.name,
            type: data.type,
            config: data.config,
            updated_at: new Date().toISOString()
          })
          .eq('id', integration.id)
          .select();
        if (error) throw error;
        return updatedData;
      } else {
        // Create new integration
        const { data: newData, error } = await supabase
          .from('integrations')
          .insert({
            name: data.name,
            type: data.type,
            config: data.config,
            is_active: false
          })
          .select();
        if (error) throw error;
        return newData;
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('integrations');
        toast.success(integration ? 'Integration updated' : 'Integration added');
        onClose();
      },
      onError: (error: any) => {
        toast.error(integration ? 'Failed to update integration' : 'Failed to add integration');
        console.error('Error saving integration:', error);
      }
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveIntegration.mutate(formData);
  };

  const handleConfigChange = (key: string, value: any) => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [key]: value
      }
    });
  };

  // Render different form fields based on integration type
  const renderConfigFields = () => {
    if (formData.type === 'telegram') {
      return (
        <>
          <div className="mt-4">
            <label htmlFor="bot_token" className="block text-sm font-medium text-gray-700">
              Bot Token
            </label>
            <input
              type="text"
              id="bot_token"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              value={formData.config?.bot_token || '8180040341:AAHwTw3qGuWsywdvuvtZzGQgcSXCcyHS9ok'}
              onChange={(e) => handleConfigChange('bot_token', e.target.value)}
              placeholder="Enter your Telegram bot token"
            />
            <p className="mt-1 text-xs text-gray-500">
              The token for your Telegram bot (e.g., 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ)
            </p>
            
            {/* Test Telegram bot */}
            <div className="mt-4">
              <label htmlFor="telegram_chat_id" className="block text-sm font-medium text-gray-700">
                Test with Chat ID
              </label>
              <div className="mt-1 flex items-center space-x-2">
                <input
                  type="text"
                  id="telegram_chat_id"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="Enter chat ID to test"
                />
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={isTestingTelegram || !formData.config?.bot_token || !telegramChatId}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingTelegram ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1.5" />
                      Test Bot
                    </>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Default is the "ACC Internal" group chat ID: -4751491670
              </p>
              
              {testResult && (
                <div className={`mt-2 flex items-center text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mr-1.5" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700">Notification Settings</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="notify_on_new_deal"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.notify_on_new_deal !== false}
                  onChange={(e) => handleConfigChange('notify_on_new_deal', e.target.checked)}
                />
                <label htmlFor="notify_on_new_deal" className="ml-2 block text-sm text-gray-700">
                  Notify on new deal
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="notify_on_status_change"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.notify_on_status_change !== false}
                  onChange={(e) => handleConfigChange('notify_on_status_change', e.target.checked)}
                />
                <label htmlFor="notify_on_status_change" className="ml-2 block text-sm text-gray-700">
                  Notify on status change
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700">Include in Notifications</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="include_agent_name"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.include_agent_name !== false}
                  onChange={(e) => handleConfigChange('include_agent_name', e.target.checked)}
                />
                <label htmlFor="include_agent_name" className="ml-2 block text-sm text-gray-700">
                  Agent name
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="include_premium"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.include_premium !== false}
                  onChange={(e) => handleConfigChange('include_premium', e.target.checked)}
                />
                <label htmlFor="include_premium" className="ml-2 block text-sm text-gray-700">
                  Premium amount
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="include_carrier"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.include_carrier !== false}
                  onChange={(e) => handleConfigChange('include_carrier', e.target.checked)}
                />
                <label htmlFor="include_carrier" className="ml-2 block text-sm text-gray-700">
                  Carrier name
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="include_product"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.include_product !== false}
                  onChange={(e) => handleConfigChange('include_product', e.target.checked)}
                />
                <label htmlFor="include_product" className="ml-2 block text-sm text-gray-700">
                  Product name
                </label>
              </div>
            </div>
          </div>
        </>
      );
    } else if (formData.type === 'discord') {
      return (
        <>
          <div className="mt-4">
            <label htmlFor="webhook_url" className="block text-sm font-medium text-gray-700">
              Webhook URL
            </label>
            <input
              type="text"
              id="webhook_url"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              value={formData.config?.webhook_url || ''}
              onChange={(e) => handleConfigChange('webhook_url', e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the Discord webhook URL from your server settings
            </p>
            
            {/* Test webhook button */}
            <div className="mt-2 flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={isTestingWebhook || !formData.config?.webhook_url}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingWebhook ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1.5" />
                    Test Webhook
                  </>
                )}
              </button>
              
              {testResult && (
                <div className={`flex items-center text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mr-1.5" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Bot Username
            </label>
            <input
              type="text"
              id="username"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              value={formData.config?.username || 'MyAgentView Bot'}
              onChange={(e) => handleConfigChange('username', e.target.value)}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-700">
              Bot Avatar URL
            </label>
            <input
              type="text"
              id="avatar_url"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              value={formData.config?.avatar_url || 'https://i.imgur.com/4M34hi2.png'}
              onChange={(e) => handleConfigChange('avatar_url', e.target.value)}
            />
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700">Notification Settings</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="notify_on_new_deal"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.notify_on_new_deal !== false}
                  onChange={(e) => handleConfigChange('notify_on_new_deal', e.target.checked)}
                />
                <label htmlFor="notify_on_new_deal" className="ml-2 block text-sm text-gray-700">
                  Notify on new deal
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="notify_on_status_change"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.notify_on_status_change !== false}
                  onChange={(e) => handleConfigChange('notify_on_status_change', e.target.checked)}
                />
                <label htmlFor="notify_on_status_change" className="ml-2 block text-sm text-gray-700">
                  Notify on status change
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700">Include in Notifications</h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  id="include_agent_name"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.include_agent_name !== false}
                  onChange={(e) => handleConfigChange('include_agent_name', e.target.checked)}
                />
                <label htmlFor="include_agent_name" className="ml-2 block text-sm text-gray-700">
                  Agent name
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="include_premium"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.include_premium !== false}
                  onChange={(e) => handleConfigChange('include_premium', e.target.checked)}
                />
                <label htmlFor="include_premium" className="ml-2 block text-sm text-gray-700">
                  Premium amount
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="include_carrier"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.include_carrier !== false}
                  onChange={(e) => handleConfigChange('include_carrier', e.target.checked)}
                />
                <label htmlFor="include_carrier" className="ml-2 block text-sm text-gray-700">
                  Carrier name
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="include_product"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.config?.include_product !== false}
                  onChange={(e) => handleConfigChange('include_product', e.target.checked)}
                />
                <label htmlFor="include_product" className="ml-2 block text-sm text-gray-700">
                  Product name
                </label>
              </div>
            </div>
          </div>
        </>
      );
    }
    
    return null;
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mt-4">
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Integration Name
        </label>
        <input
          type="text"
          id="name"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="mt-4">
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
          Integration Type
        </label>
        <select
          id="type"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          value={formData.type || 'discord'}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          required
        >
          <option value="discord">Discord</option>
          <option value="telegram">Telegram</option>
          {/* Add other integration types here in the future */}
        </select>
      </div>

      {renderConfigFields()}

      <div className="mt-6 flex justify-end space-x-3">
        <button
          type="button"
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          disabled={saveIntegration.isLoading}
        >
          {saveIntegration.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </form>
  );
};

export default Integrations;