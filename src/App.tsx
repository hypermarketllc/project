import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  createRoutesFromElements,
  Route
} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PermissionProvider } from './contexts/PermissionContext';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './components/Dashboard';
import Configuration from './components/Configuration';
import SystemMonitoring from './components/SystemMonitoring';
import Book from './components/Book';
import Agents from './components/Agents';
import PostDeal from './components/PostDeal';
import UserSettings from './components/UserSettings';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Create router with the new v7 flags
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="post-deal" element={<PostDeal />} />
        <Route path="book" element={<Book />} />
        <Route path="agents" element={<Agents />} />
        <Route path="configuration" element={<Configuration />} />
        <Route path="monitoring" element={<SystemMonitoring />} />
        <Route path="settings" element={<UserSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  ),
  {
    future: {
      // v7_startTransition: true, // Removed due to TypeScript error
      v7_relativeSplatPath: true
    }
  }
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionProvider>
          <RouterProvider router={router} />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#333',
                color: '#fff',
              },
              success: {
                style: {
                  background: 'green',
                },
              },
              error: {
                style: {
                  background: 'red',
                },
              },
            }}
          />
        </PermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;