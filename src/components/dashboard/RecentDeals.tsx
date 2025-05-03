import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Deal } from '../../types/database';

interface RecentDealsProps {
  deals: Deal[] | undefined;
}

const RecentDeals: React.FC<RecentDealsProps> = ({ deals }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Recent Deals</h2>
        <button
          onClick={() => navigate('/book')}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          View all
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Client</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Product</th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Premium</th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Source</th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {deals?.slice(0, 5).map((deal) => (
              <tr key={deal.id}>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                  {deal.client_name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {(deal.products as any).name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-900">
                  ${Number(deal.annual_premium).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    deal.from_referral 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {deal.from_referral ? 'Referral' : 'Direct'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    deal.status === 'Approved' ? 'bg-green-100 text-green-800' :
                    deal.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                    deal.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {deal.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentDeals;