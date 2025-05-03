import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './contexts/PermissionContext';
import { useQuery } from 'react-query';
import { supabase } from './lib/supabase';
import {
  Home,
  Users,
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  UserCog
} from 'lucide-react';

interface SystemSettings {
  name: string;
  logo_url?: string;
}

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: settings } = useQuery<SystemSettings>('settings', async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'system_settings')
      .single();
    
    if (error) throw error;
    return data?.value as SystemSettings;
  });

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navigation = [
    { name: 'Dashboard', icon: Home, path: '/', section: 'dashboard' },
    { name: 'Post a Deal', icon: FileText, path: '/post-deal', section: 'post-deal' },
    { name: 'Book', icon: BookOpen, path: '/book', section: 'book' },
    { name: 'Agents', icon: Users, path: '/agents', section: 'agents' },
    { name: 'Configuration', icon: Settings, path: '/configuration', section: 'configuration' },
    { name: 'System Monitoring', icon: Activity, path: '/monitoring', section: 'monitoring' }
  ].filter(item => canAccess(item.section));

  const renderBranding = () => {
    if (settings?.logo_url) {
      return (
        <img 
          src={settings.logo_url} 
          alt={settings.name || 'Company Logo'} 
          className="h-8 w-auto"
        />
      );
    }
    return (
      <span className={`text-xl font-bold text-white transition-opacity duration-200 ${sidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
        {settings?.name || 'MyAgentView'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-30 transform transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } hidden md:block`}
      >
        <div className="h-full bg-primary-700 shadow-lg">
          {/* Branding */}
          <div className="flex h-16 items-center justify-between px-4">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
              {renderBranding()}
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4 px-2 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`w-full group flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-colors duration-150
                  text-white hover:bg-primary-600 hover:text-white
                  ${location.pathname === item.path ? 'bg-primary-600' : ''}
                  ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
              >
                <item.icon className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                  {item.name}
                </span>
              </Link>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-600">
            <Link
              to="/settings"
              className={`w-full group flex items-center px-2 py-2 text-sm font-medium rounded-lg
                text-white hover:bg-primary-600 transition-colors duration-150
                ${location.pathname === '/settings' ? 'bg-primary-600' : ''}
                ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <UserCog className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                Account Settings
              </span>
            </Link>

            <button
              onClick={handleLogout}
              className={`w-full group flex items-center px-2 py-2 text-sm font-medium rounded-lg
                text-white hover:bg-primary-600 transition-colors duration-150
                ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <LogOut className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                Logout
              </span>
            </button>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex justify-center items-center px-2 py-2 mt-2 text-sm font-medium rounded-lg
                text-white hover:bg-primary-600 transition-colors duration-150"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white shadow-sm">
        <div className="flex items-center justify-between h-16 px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 flex justify-center">
            {renderBranding()}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-gray-600 bg-opacity-75 transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar Panel */}
        <div
          className={`relative flex-1 flex flex-col max-w-xs w-full bg-primary-700 transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>

          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              {renderBranding()}
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`w-full group flex items-center px-2 py-2 text-base font-medium rounded-lg
                    text-white hover:bg-primary-600 transition-colors duration-150
                    ${location.pathname === item.path ? 'bg-primary-600' : ''}`}
                >
                  <item.icon className="mr-4 h-6 w-6" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex-shrink-0 p-4 border-t border-primary-600">
            <Link
              to="/settings"
              onClick={() => setSidebarOpen(false)}
              className={`w-full group flex items-center px-2 py-2 text-base font-medium rounded-lg
                text-white hover:bg-primary-600 transition-colors duration-150
                ${location.pathname === '/settings' ? 'bg-primary-600' : ''}`}
            >
              <UserCog className="mr-4 h-6 w-6" />
              Account Settings
            </Link>
            <button
              onClick={handleLogout}
              className="w-full group flex items-center px-2 py-2 text-base font-medium rounded-lg
                text-white hover:bg-primary-600 transition-colors duration-150"
            >
              <LogOut className="mr-4 h-6 w-6" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;