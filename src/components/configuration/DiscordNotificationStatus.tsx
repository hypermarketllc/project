import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { processDiscordQueue } from '../../lib/processDiscordQueue';
import toast from 'react-hot-toast';
import { usePermissions } from '../../contexts/PermissionContext';

interface DiscordNotification {
  id: string;
  deal_id: string;
  message: any;
  webhook_url: string;
  sent: boolean;
  error: string | null;
  retry_count: number;
  created_at: string;
  sent_at: string | null;
  deal: {
    id: string;
    client_name: string;
    annual_premium: number;
    agent: {
      full_name: string;
    };
    carrier: {
      name: string;
    };
  };
}

const DiscordNotificationStatus = () => {
  const [pendingNotifications, setPendingNotifications] = useState<DiscordNotification[]>([]);
  const [sentNotifications, setSentNotifications] = useState<DiscordNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { canAccess } = usePermissions();

  // Check if user has access to this component
  const hasAccess = canAccess('configuration', 'view');

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // Fetch pending notifications
      const { data: pendingData, error: pendingError } = await supabase
        .from('discord_notifications')
        .select(`
          *,
          deal:deal_id (
            id,
            client_name,
            annual_premium,
            agent:agent_id (full_name),
            carrier:carrier_id (name)
          )
        `)
        .eq('sent', false)
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;
      setPendingNotifications(pendingData || []);

      // Fetch sent notifications (limit to last 50)
      const { data: sentData, error: sentError } = await supabase
        .from('discord_notifications')
        .select(`
          *,
          deal:deal_id (
            id,
            client_name,
            annual_premium,
            agent:agent_id (full_name),
            carrier:carrier_id (name)
          )
        `)
        .eq('sent', true)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (sentError) throw sentError;
      setSentNotifications(sentData || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchNotifications();
      
      // Set up a refresh interval (every 30 seconds)
      const intervalId = setInterval(fetchNotifications, 30000);
      
      return () => clearInterval(intervalId);
    }
  }, [hasAccess]);

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const result = await processDiscordQueue();
      toast.success(`Processed ${result.processed} notifications: ${result.success} succeeded, ${result.failed} failed`);
      fetchNotifications();
    } catch (error) {
      console.error('Error processing queue:', error);
      toast.error('Failed to process notification queue');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('discord_notifications')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Notification deleted');
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  // If user doesn't have access, don't render anything
  if (!hasAccess) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Discord Notification Status</h2>
        <div className="flex space-x-2">
          <button
            onClick={fetchNotifications}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleProcessQueue}
            disabled={isProcessing || pendingNotifications.length === 0}
            className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Process Queue Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pending Notifications */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Notifications ({pendingNotifications.length})</h3>
        {pendingNotifications.length === 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center text-gray-500">
            No pending notifications
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deal
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Premium
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingNotifications.map((notification) => (
                  <tr key={notification.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {notification.deal?.client_name || 'Unknown Client'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {notification.deal?.agent?.full_name || 'Unknown Agent'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${notification.deal?.annual_premium?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(notification.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                      {notification.retry_count > 0 && (
                        <span className="ml-2 text-xs text-gray-500">
                          (Retries: {notification.retry_count})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sent Notifications */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sent Notifications (Last 50)</h3>
        {sentNotifications.length === 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center text-gray-500">
            No sent notifications
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deal
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Premium
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sentNotifications.map((notification) => (
                  <tr key={notification.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {notification.deal?.client_name || 'Unknown Client'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {notification.deal?.agent?.full_name || 'Unknown Agent'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${notification.deal?.annual_premium?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(notification.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {notification.sent_at ? new Date(notification.sent_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Sent
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscordNotificationStatus;