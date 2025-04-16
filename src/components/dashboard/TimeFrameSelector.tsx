import React from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar } from 'lucide-react';

interface TimeFrameSelectorProps {
  selectedTimeFrame: string;
  customDateRange: { start: string; end: string } | null;
  timeFrameOptions: Array<{ label: string; value: string }>;
  onTimeFrameChange: (value: string) => void;
  onCustomDateClick: () => void;
}

const TimeFrameSelector: React.FC<TimeFrameSelectorProps> = ({
  selectedTimeFrame,
  customDateRange,
  timeFrameOptions,
  onTimeFrameChange,
  onCustomDateClick
}) => {
  return (
    <div className="flex items-center space-x-4">
      <select
        value={selectedTimeFrame}
        onChange={(e) => onTimeFrameChange(e.target.value)}
        className="block w-full md:w-48 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
      >
        {timeFrameOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {selectedTimeFrame === 'custom' && customDateRange && (
        <button
          onClick={onCustomDateClick}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Calendar className="h-4 w-4 mr-2" />
          {format(parseISO(customDateRange.start), 'MMM d, yyyy')} - {format(parseISO(customDateRange.end), 'MMM d, yyyy')}
        </button>
      )}
    </div>
  );
};

export default TimeFrameSelector;