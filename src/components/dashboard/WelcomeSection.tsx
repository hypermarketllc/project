import React from 'react';
import { Agent } from '../../types/database';

interface WelcomeSectionProps {
  currentUser: Agent | undefined;
  totalPremium: number;
  goalProgress: number;
}

const WelcomeSection: React.FC<WelcomeSectionProps> = ({ currentUser, totalPremium, goalProgress }) => {
  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'text-green-800';
    if (progress >= 75) return 'text-blue-800';
    if (progress >= 50) return 'text-yellow-800';
    if (progress >= 30) return 'text-yellow-800';
    return 'text-red-800';
  };

  const getProgressBarColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {currentUser?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's what's happening with your deals today.
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end mb-2">
            <span className="text-sm font-medium text-gray-600">
              ${totalPremium.toLocaleString()} / ${(currentUser?.annual_goal || 0).toLocaleString()}
            </span>
            <span className={`ml-2 text-sm font-medium ${getProgressColor(goalProgress)}`}>
              {goalProgress.toFixed(1)}% of goal
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(goalProgress)}`}
                style={{ width: `${Math.min(goalProgress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeSection;