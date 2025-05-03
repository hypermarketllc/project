import React from 'react';
import { Search } from 'lucide-react';
import { format } from 'date-fns';

interface BookFiltersProps {
  filters: {
    timeFrame: string;
    agent: string;
    carrier: string;
    status: string;
    clientName: string;
    policyNumber: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onTimeFrameChange: (value: string) => void;
  timeFrameOptions: Array<{ label: string; value: string; }>;
}

const BookFilters: React.FC<BookFiltersProps> = ({
  filters,
  onFilterChange,
  onTimeFrameChange,
  timeFrameOptions
}) => {
  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200">
      <div className="p-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Time Frame Filter */}
        <div>
          <label htmlFor="timeFrame" className="block text-sm font-medium text-gray-700">
            Time Frame
          </label>
          <select
            id="timeFrame"
            value={filters.timeFrame}
            onChange={(e) => onTimeFrameChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            {timeFrameOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700">
            Search
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
              placeholder="Search deals..."
              value={filters.clientName}
              onChange={(e) => onFilterChange('clientName', e.target.value)}
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {/* Policy Number Filter */}
        <div>
          <label htmlFor="policyNumber" className="block text-sm font-medium text-gray-700">
            Policy Number
          </label>
          <input
            type="text"
            id="policyNumber"
            value={filters.policyNumber}
            onChange={(e) => onFilterChange('policyNumber', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            placeholder="Enter policy number"
          />
        </div>
      </div>
    </div>
  );
};

export default BookFilters;