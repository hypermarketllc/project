import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

type OperationStatus = {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  lastCheck: Date;
  details?: {
    error?: string;
    latency?: number;
  };
};

const SystemMonitoring = () => {
  const queryClient = useQueryClient();

  // Function to test database operations
  const testDatabaseOperations = async (): Promise<OperationStatus[]> => {
    const results: OperationStatus[] = [];
    const startTime = Date.now();

    // Test database connection and read operation
    try {
      const { data: queryData, error: queryError } = await supabase
        .from('system_health_checks')
        .select('count')
        .limit(1);

      results.push({
        name: 'Database Connection',
        status: queryError ? 'down' : 'operational',
        lastCheck: new Date(),
        details: queryError ? { error: queryError.message } : { latency: Date.now() - startTime }
      });
    } catch (error: any) {
      results.push({
        name: 'Database Connection',
        status: 'down',
        lastCheck: new Date(),
        details: { error: error.message }
      });
    }

    // Test insert operation
    try {
      const { data: insertData, error: insertError } = await supabase
        .from('system_health_checks')
        .insert({ test_value: 'test' })
        .select()
        .single();

      results.push({
        name: 'Write Operation',
        status: insertError ? 'down' : 'operational',
        lastCheck: new Date(),
        details: insertError ? { error: insertError.message } : { latency: Date.now() - startTime }
      });

      // If insert was successful, clean up the test data
      if (insertData) {
        await supabase
          .from('system_health_checks')
          .delete()
          .eq('id', insertData.id);
      }
    } catch (error: any) {
      results.push({
        name: 'Write Operation',
        status: 'down',
        lastCheck: new Date(),
        details: { error: error.message }
      });
    }

    // Test authentication
    try {
      const { data: session, error: authError } = await supabase.auth.getSession();
      results.push({
        name: 'Authentication Service',
        status: authError ? 'down' : 'operational',
        lastCheck: new Date(),
        details: authError ? { error: authError.message } : { latency: Date.now() - startTime }
      });
    } catch (error: any) {
      results.push({
        name: 'Authentication Service',
        status: 'down',
        lastCheck: new Date(),
        details: { error: error.message }
      });
    }

    return results;
  };

  // Query for system status
  const { data: systemStatus, isLoading } = useQuery(
    'system-status',
    testDatabaseOperations,
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      refetchIntervalInBackground: true,
    }
  );

  // Refresh data when component mounts
  useEffect(() => {
    queryClient.invalidateQueries('system-status');
  }, [queryClient]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
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
          <h1 className="text-2xl font-semibold text-gray-900">System Status</h1>
          <p className="text-sm text-gray-500">
            Last updated: {format(new Date(), 'MMM d, yyyy HH:mm:ss')}
          </p>
        </div>

        <div className="mt-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="divide-y divide-gray-200">
              {systemStatus?.map((status, index) => (
                <div key={index} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getStatusIcon(status.status)}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{status.name}</p>
                        <p className="text-sm text-gray-500">
                          Last checked: {format(status.lastCheck, 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          status.status === 'operational'
                            ? 'bg-green-100 text-green-800'
                            : status.status === 'degraded'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  {status.details && (
                    <div className="mt-2">
                      {status.details.error ? (
                        <p className="text-sm text-red-600">Error: {status.details.error}</p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Response time: {status.details.latency}ms
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemMonitoring;