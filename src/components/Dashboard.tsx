import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Deal, Agent } from '../types/database';
import { useAuth } from '../contexts/AuthContext';

import WelcomeSection from './dashboard/WelcomeSection';
import TimeFrameSelector from './dashboard/TimeFrameSelector';
import QuickActions from './dashboard/QuickActions';
import StatsGrid from './dashboard/StatsGrid';
import DealCharts from './dashboard/DealCharts';
import RecentDeals from './dashboard/RecentDeals';
import DateRangeModal from './book/DateRangeModal';
import CommissionSummary from './dashboard/CommissionSummary';

const timeFrameOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'Last 90 Days', value: '90days' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom Range', value: 'custom' }
];

const Dashboard = () => {
  const { user } = useAuth();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('today');
  const [customDateRange, setCustomDateRange] = useState<{start: string; end: string} | null>(null);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{startDate: Date | null; endDate: Date | null}>({
    startDate: null,
    endDate: null
  });

  // Fetch current user details
  const { data: currentUser } = useQuery<Agent>(
    ['user', user?.id],
    async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      enabled: !!user?.id
    }
  );

  // Fetch deals with time frame filter
  const { data: dealsData } = useQuery<Deal[]>(
    ['deals', selectedTimeFrame, customDateRange, user?.id],
    async () => {
      if (!user?.id) return [];

      // Apply time frame filter
      const now = new Date();
      let startDate, endDate;

      if (customDateRange && selectedTimeFrame === 'custom') {
        startDate = startOfDay(parseISO(customDateRange.start));
        endDate = endOfDay(parseISO(customDateRange.end));
      } else {
        switch (selectedTimeFrame) {
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
      
      // Update date range state for other components
      setDateRange({
        startDate: startDate || null,
        endDate: endDate || null
      });

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
      
      console.log("Dashboard - Fetching deals for user:", user.id, user.email, "isOwner:", isOwner);
      
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

      // We already have startDate and endDate from above

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

      // If no date filtering, just get all results
      const { data, error } = await query;
      if (error) throw error;
      
      // Sort the data in memory
      return data.sort((a, b) => {
        const dateA = new Date(a.submitted_at || a.created_at);
        const dateB = new Date(b.submitted_at || b.created_at);
        return dateB.getTime() - dateA.getTime(); // descending order
      });
    }
  );

  // Calculate stats
  const totalDeals = dealsData?.length || 0;
  const totalPremium = dealsData?.reduce((sum, deal) => sum + Number(deal.annual_premium), 0) || 0;
  const averagePremium = totalDeals ? totalPremium / totalDeals : 0;
  const goalProgress = (totalPremium / (currentUser?.annual_goal || 1000000)) * 100;

  // Calculate referral stats
  const referralDeals = dealsData?.filter(deal => deal.from_referral) || [];
  const nonReferralDeals = dealsData?.filter(deal => !deal.from_referral) || [];
  const referralStats = [
    { name: 'Referral Deals', value: referralDeals.length },
    { name: 'Direct Deals', value: nonReferralDeals.length }
  ];

  // Prepare chart data
  const chartData = dealsData?.map(deal => ({
    date: format(new Date(deal.submitted_at || deal.created_at), 'MMM d'),
    amount: Number(deal.annual_premium),
    referral: deal.from_referral ? Number(deal.annual_premium) : 0,
    direct: deal.from_referral ? 0 : Number(deal.annual_premium)
  })) || [];

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
      setSelectedTimeFrame(value);
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <WelcomeSection
          currentUser={currentUser}
          totalPremium={totalPremium}
          goalProgress={goalProgress}
        />

        <div className="mt-6">
          <TimeFrameSelector
            selectedTimeFrame={selectedTimeFrame}
            customDateRange={customDateRange}
            timeFrameOptions={timeFrameOptions}
            onTimeFrameChange={handleTimeFrameChange}
            onCustomDateClick={() => setIsDateRangeModalOpen(true)}
          />
        </div>

        <div className="mt-6">
          <QuickActions />
        </div>

        <div className="mt-6">
          <StatsGrid
            totalPremium={totalPremium}
            goalProgress={goalProgress}
            totalDeals={totalDeals}
            referralDeals={referralDeals.length}
            averagePremium={averagePremium}
            referralRate={totalDeals > 0 ? (referralDeals.length / totalDeals) * 100 : 0}
          />
        </div>

        <div className="mt-6">
          <CommissionSummary
            userId={user?.id || ''}
            startDate={dateRange.startDate || undefined}
            endDate={dateRange.endDate || undefined}
          />
        </div>

        <div className="mt-6">
          <DealCharts
            chartData={chartData}
            referralStats={referralStats}
          />
        </div>

        <div className="mt-6">
          <RecentDeals deals={dealsData} />
        </div>

        <DateRangeModal
          isOpen={isDateRangeModalOpen}
          onClose={() => setIsDateRangeModalOpen(false)}
          dateRange={customDateRange}
          onDateRangeChange={setCustomDateRange}
          onApply={() => {
            setIsDateRangeModalOpen(false);
            setSelectedTimeFrame('custom');
          }}
        />
      </div>
    </div>
  );
};

export default Dashboard;