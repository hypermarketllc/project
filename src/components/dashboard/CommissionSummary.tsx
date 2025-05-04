import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

type CommissionSummaryProps = {
  userId: string;
  startDate?: Date;
  endDate?: Date;
};

type MoneyInProduction = {
  total_advance: number;
  total_monthly: number;
  total_chargebacks: number;
  net_production: number;
};

type TotalCommission = {
  agent_name: string;
  position?: string; // May be quoted in the database
  paid_commission: number;
  pending_commission: number;
  chargebacks: number;
  net_commission: number;
};

type FutureCommission = {
  agent_name: string;
  position?: string; // May be quoted in the database
  future_commission: number;
};

type TabType = 'money_in_production' | 'total_commission' | 'future_commission';

const CommissionSummary: React.FC<CommissionSummaryProps> = ({ userId, startDate, endDate }) => {
  const [loading, setLoading] = useState(true);
  const [moneyInProduction, setMoneyInProduction] = useState<MoneyInProduction | null>(null);
  const [totalCommission, setTotalCommission] = useState<TotalCommission | null>(null);
  const [futureCommission, setFutureCommission] = useState<FutureCommission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('money_in_production');
  
  useEffect(() => {
    const fetchCommissionData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Prepare date parameters if provided
        const params: Record<string, any> = {
          user_id_param: userId
        };
        
        if (startDate && endDate) {
          params.start_date = format(startDate, 'yyyy-MM-dd');
          params.end_date = format(endDate, 'yyyy-MM-dd');
        }
        
        // Simplify the query to directly use the view
        const { data: mipData, error: mipError } = await supabase
          .from('money_in_production')
          .select('*')
          .eq('user_id', userId);
        
        if (mipError) {
          console.error("Error fetching money in production:", mipError);
          
          // Try without user_id filter as fallback
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('money_in_production')
            .select('*');
            
          if (fallbackError) {
            console.error("Fallback error:", fallbackError);
            // Set default values if all queries fail
            setMoneyInProduction({
              total_advance: 0,
              total_monthly: 0,
              total_chargebacks: 0,
              net_production: 0
            });
          } else if (fallbackData && fallbackData.length > 0) {
            // Use the first record if multiple found
            setMoneyInProduction(fallbackData[0]);
          } else {
            // Set default values if no data found
            setMoneyInProduction({
              total_advance: 0,
              total_monthly: 0,
              total_chargebacks: 0,
              net_production: 0
            });
          }
        } else if (mipData && mipData.length > 0) {
          // Use the first record if multiple found
          setMoneyInProduction(mipData[0]);
        } else {
          // Set default values if no data found
          setMoneyInProduction({
            total_advance: 0,
            total_monthly: 0,
            total_chargebacks: 0,
            net_production: 0
          });
        }
        
        // Simplify the query to directly use the view
        const { data: tcData, error: tcError } = await supabase
          .from('total_commission')
          .select('*')
          .eq('user_id', userId);
        
        if (tcError) {
          console.error("Error fetching total commission:", tcError);
          // Set default values if query fails
          setTotalCommission({
            agent_name: '',
            position: '',
            paid_commission: 0,
            pending_commission: 0,
            chargebacks: 0,
            net_commission: 0
          });
        } else if (tcData && tcData.length > 0) {
          setTotalCommission(tcData[0]);
        } else {
          // Set default values if no data found
          setTotalCommission({
            agent_name: '',
            position: '',
            paid_commission: 0,
            pending_commission: 0,
            chargebacks: 0,
            net_commission: 0
          });
        }
        
        // Simplify the query to directly use the view
        const { data: fcData, error: fcError } = await supabase
          .from('future_commission')
          .select('*')
          .eq('user_id', userId);
        
        if (fcError) {
          console.error("Error fetching future commission:", fcError);
          // Set default values if query fails
          setFutureCommission({
            agent_name: '',
            position: '',
            future_commission: 0
          });
        } else if (fcData && fcData.length > 0) {
          setFutureCommission(fcData[0]);
        } else {
          // Set default values if no data found
          setFutureCommission({
            agent_name: '',
            position: '',
            future_commission: 0
          });
        }
        
      } catch (err) {
        console.error('Error fetching commission data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCommissionData();
  }, [userId, startDate, endDate]);
  
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">Commission Summary</h3>
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">Commission Summary</h3>
        <div className="flex flex-col justify-center items-center h-40 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>Error loading commission data</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h3 className="text-lg font-medium mb-4">Commission Summary</h3>
      
      {/* Tab Navigation */}
      <div className="flex border-b mb-4">
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'money_in_production' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('money_in_production')}
        >
          Money in Production
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'total_commission' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('total_commission')}
        >
          Total Commission
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'future_commission' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('future_commission')}
        >
          Future Commission
        </button>
      </div>
      
      {/* Money in Production Tab */}
      {activeTab === 'money_in_production' && (
        <div className="bg-gray-100 rounded-lg p-6">
          <div className="text-lg text-gray-700 mb-2">Money in Production</div>
          <div className="text-3xl font-bold flex items-center">
            <span className="mr-1">$</span>
            {moneyInProduction?.net_production?.toFixed(2) || '0.00'}
          </div>
          <div className="text-sm text-gray-500 mt-3">
            Total money received in advance for all policies (advance payments + monthly payments - chargebacks)
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="text-sm text-gray-500">Advance</div>
              <div className="text-xl font-semibold">${moneyInProduction?.total_advance?.toFixed(2) || '0.00'}</div>
            </div>
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="text-sm text-gray-500">Monthly</div>
              <div className="text-xl font-semibold">${moneyInProduction?.total_monthly?.toFixed(2) || '0.00'}</div>
            </div>
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="text-sm text-gray-500">Chargebacks</div>
              <div className="text-xl font-semibold text-red-500">-${Math.abs(moneyInProduction?.total_chargebacks || 0).toFixed(2) || '0.00'}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Total Commission Tab */}
      {activeTab === 'total_commission' && (
        <div className="bg-gray-100 rounded-lg p-6">
          <div className="text-lg text-gray-700 mb-2">Total Commission</div>
          <div className="text-3xl font-bold flex items-center">
            <span className="mr-1">$</span>
            {totalCommission?.net_commission?.toFixed(2) || '0.00'}
          </div>
          <div className="text-sm text-gray-500 mt-3">
            Total commissions earned to date
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="text-sm text-gray-500">Paid Commission</div>
              <div className="text-xl font-semibold">${totalCommission?.paid_commission?.toFixed(2) || '0.00'}</div>
            </div>
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="text-sm text-gray-500">Chargebacks</div>
              <div className="text-xl font-semibold text-red-500">-${Math.abs(totalCommission?.chargebacks || 0).toFixed(2) || '0.00'}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Future Commission Tab */}
      {activeTab === 'future_commission' && (
        <div className="bg-gray-100 rounded-lg p-6">
          <div className="text-lg text-gray-700 mb-2">Future Commission</div>
          <div className="text-3xl font-bold flex items-center">
            <span className="mr-1">$</span>
            {futureCommission?.future_commission?.toFixed(2) || '0.00'}
          </div>
          <div className="text-sm text-gray-500 mt-3">
            Commissions eligible after advance period (typically 9 months) or pending monthly payments
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionSummary;