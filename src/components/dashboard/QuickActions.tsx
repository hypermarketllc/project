import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import { DollarSign, BookOpen, BarChart2 } from 'lucide-react';

const QuickActions = () => {
  const navigate = useNavigate();
  const { canAccess } = usePermissions();

  // Only include actions that should be available based on permissions
  const quickActions = [
    { name: 'Post a Deal', icon: DollarSign, path: '/post-deal', section: 'post-deal' },
    { name: 'Book', icon: BookOpen, path: '/book', section: 'book' },
    { name: 'Analytics', icon: BarChart2, path: '/analytics', section: 'analytics' }
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {quickActions.map((action) => (
        canAccess(action.section) && (
          <button
            key={action.name}
            onClick={() => navigate(action.path)}
            className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:border-primary-100 transition-colors duration-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`bg-primary-100 text-primary-600 p-3 rounded-lg`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">{action.name}</p>
                </div>
              </div>
            </div>
          </button>
        )
      ))}
    </div>
  );
};

export default QuickActions;