import React from 'react';
import { Target, Award, TrendingUp, Activity } from 'lucide-react';

interface StatsGridProps {
  totalPremium: number;
  goalProgress: number;
  totalDeals: number;
  referralDeals: number;
  averagePremium: number;
  referralRate: number;
}

const StatsGrid: React.FC<StatsGridProps> = ({
  totalPremium,
  totalDeals,
  referralDeals,
  averagePremium,
  referralRate
}) => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
        <div className="p-5">
          <div className="flex items-center">
            <div className="bg-primary-100 p-3 rounded-lg">
              <Target className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Premium</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                ${totalPremium.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
        <div className="p-5">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <Award className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Deals</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {totalDeals}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm">
              <span className="text-gray-600">
                {referralDeals} from referrals
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
        <div className="p-5">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Average Premium</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                ${averagePremium.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
        <div className="p-5">
          <div className="flex items-center">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {referralRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsGrid;