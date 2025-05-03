import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Deal } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

import BookTable from './book/BookTable';
import BookFilters from './book/BookFilters';
import EditDealModal from './book/EditDealModal';
import DateRangeModal from './book/DateRangeModal';

const Book = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [customDateRange, setCustomDateRange] = useState<{start: string; end: string} | null>(null);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    timeFrame: 'all',
    agent: '',
    carrier: '',
    product: '',
    status: '',
    premium: 'all',
    clientName: '',
    policyNumber: ''
  });

  // Time frame options
  const timeFrameOptions = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: '7days' },
    { label: 'Last 30 Days', value: '30days' },
    { label: 'Last 90 Days', value: '90days' },
    { label: 'Custom Range', value: 'custom' }
  ];

  // Fetch deals with filters
  const { data: deals, isLoading } = useQuery<Deal[]>(
    ['deals', filters, customDateRange, user?.id],
    async () => {
      if (!user?.id) return [];

      // Check if user is an owner
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, position_id')
        .eq('id', user.id)
        .single();
      
      if (userError) {
        console.error("Error fetching user data:", userError);
        throw userError;
      }
      
      // Get position details
      const { data: positionData, error: positionError } = await supabase
        .from('positions')
        .select('id, name, level')
        .eq('id', userData.position_id)
        .single();
      
      if (positionError) {
        console.error("Error fetching position data:", positionError);
        throw positionError;
      }
      
      // Determine if user is an owner
      const positionName = positionData?.name?.toLowerCase() || 'agent';
      const positionLevel = positionData?.level || 1;
      const isOwner = positionName === 'owner' || positionLevel === 5;
      
      console.log("Book - Fetching deals for user:", user.id, user.email, "isOwner:", isOwner);
      
      let query = supabase
        .from('deals')
        .select(`
          *,
          users!deals_agent_id_fkey (full_name),
          carriers (name),
          products (name)
        `);
      
      // If not an owner, only show their own deals
      if (!isOwner) {
        query = query.eq('agent_id', user.id);
      }

      // Apply time frame filter
      if (filters.timeFrame !== 'all' || customDateRange) {
        let startDate, endDate;
        
        if (customDateRange) {
          startDate = startOfDay(parseISO(customDateRange.start));
          endDate = endOfDay(parseISO(customDateRange.end));
        } else {
          const now = new Date();
          switch (filters.timeFrame) {
            case 'today':
              startDate = startOfDay(now);
              endDate = endOfDay(now);
              break;
            case 'yesterday':
              startDate = startOfDay(subDays(now, 1));
              endDate = endOfDay(subDays(now, 1));
              break;
            case '7days':
              startDate = startOfDay(subDays(now, 7));
              endDate = endOfDay(now);
              break;
            case '30days':
              startDate = startOfDay(subDays(now, 30));
              endDate = endOfDay(now);
              break;
            case '90days':
              startDate = startOfDay(subDays(now, 90));
              endDate = endOfDay(now);
              break;
          }
        }

        if (startDate && endDate) {
          // For filter_deals_by_hierarchy, we need to filter in memory
          // since we can't use .gte and .lte on the RPC result
          const { data, error } = await query;
          if (error) throw error;
          
          // Filter the data in memory based on the date range
          return data.filter(deal => {
            const dealDate = new Date(deal.submitted_at || deal.created_at);
            return dealDate >= startDate && dealDate <= endDate;
          });
        }
      }

      // Get all results from RPC function
      const { data, error } = await query;
      if (error) throw error;
      
      // Apply filters in memory
      let filteredData = data;
      
      // Apply other filters in memory
      if (filters.agent) {
        filteredData = filteredData.filter(deal =>
          (deal.users as any)?.full_name?.toLowerCase().includes(filters.agent.toLowerCase())
        );
      }
      if (filters.carrier) {
        filteredData = filteredData.filter(deal =>
          (deal.carriers as any)?.name?.toLowerCase().includes(filters.carrier.toLowerCase())
        );
      }
      if (filters.product) {
        filteredData = filteredData.filter(deal =>
          (deal.products as any)?.name?.toLowerCase().includes(filters.product.toLowerCase())
        );
      }
      if (filters.status) {
        filteredData = filteredData.filter(deal =>
          deal.status === filters.status
        );
      }
      if (filters.clientName) {
        filteredData = filteredData.filter(deal =>
          deal.client_name?.toLowerCase().includes(filters.clientName.toLowerCase())
        );
      }
      if (filters.policyNumber) {
        filteredData = filteredData.filter(deal =>
          deal.policy_number?.toLowerCase().includes(filters.policyNumber.toLowerCase())
        );
      }

      // Sort the filtered data in memory
      return filteredData.sort((a, b) => {
        const dateA = new Date(a.submitted_at || a.created_at);
        const dateB = new Date(b.submitted_at || b.created_at);
        return dateB.getTime() - dateA.getTime(); // descending order
      });
    },
    {
      enabled: !!user?.id
    }
  );

  // Update deal mutation
  const updateDeal = useMutation(
    async (deal: Partial<Deal>) => {
      const { data, error } = await supabase
        .from('deals')
        .update(deal)
        .eq('id', deal.id)
        .select();

      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('deals');
        setIsEditModalOpen(false);
        setEditingDeal(null);
        toast.success('Deal updated successfully');
      },
      onError: (error: any) => {
        toast.error(`Failed to update deal: ${error.message}`);
      }
    }
  );

  const handleEditDeal = (deal: Deal) => {
    setEditingDeal(deal);
    setIsEditModalOpen(true);
  };

  const handleUpdateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const data: Record<string, any> = {};
    
    formData.forEach((value, key) => {
      if (value === '') {
        data[key] = null;
      } else if (key === 'annual_premium') {
        data[key] = parseFloat(value as string);
      } else if (key === 'from_referral') {
        data[key] = value === 'on';
      } else {
        data[key] = value;
      }
    });

    updateDeal.mutate({ ...data, id: editingDeal.id });
  };

  const handleTimeFrameChange = (value: string) => {
    if (value === 'custom') {
      const today = new Date();
      const thirtyDaysAgo = subDays(today, 30);
      setCustomDateRange({
        start: format(thirtyDaysAgo, 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd')
      });
      setIsDateRangeModalOpen(true);
    } else {
      setCustomDateRange(null);
      setFilters({ ...filters, timeFrame: value });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Book of Business</h1>
            <p className="mt-2 text-sm text-gray-700">
              A comprehensive list of all insurance deals including client information and policy details.
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6">
          <BookFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onTimeFrameChange={handleTimeFrameChange}
            timeFrameOptions={timeFrameOptions}
          />
        </div>

        {/* Table */}
        <div className="mt-6 bg-white shadow-sm rounded-lg border border-gray-200">
          <BookTable
            deals={deals}
            onEditDeal={handleEditDeal}
          />
        </div>

        {/* Edit Deal Modal */}
        <EditDealModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          deal={editingDeal}
          onSubmit={handleUpdateDeal}
        />

        {/* Date Range Modal */}
        <DateRangeModal
          isOpen={isDateRangeModalOpen}
          onClose={() => setIsDateRangeModalOpen(false)}
          dateRange={customDateRange}
          onDateRangeChange={setCustomDateRange}
          onApply={() => {
            setIsDateRangeModalOpen(false);
            setFilters({ ...filters, timeFrame: 'custom' });
          }}
        />
      </div>
    </div>
  );
};

export default Book;