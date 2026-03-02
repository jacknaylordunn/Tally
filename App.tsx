
import React from 'react';
import { createHashRouter, RouterProvider, createRoutesFromElements, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { TutorialProvider } from './context/TutorialContext';
import { TutorialOverlay } from './components/TutorialOverlay';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Onboarding } from './pages/Onboarding';
import { ActionHandler } from './pages/ActionHandler';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminTimesheets } from './pages/AdminTimesheets';
import { AdminLocations } from './pages/AdminLocations';
import { AdminSettings } from './pages/AdminSettings';
import { AdminStaff } from './pages/AdminStaff';
import { AdminRota } from './pages/AdminRota';
import { AdminVetting } from './pages/AdminVetting';
import { StaffDashboard } from './pages/StaffDashboard';
import { StaffActivity } from './pages/StaffActivity';
import { StaffProfile } from './pages/StaffProfile';
import { StaffRota } from './pages/StaffRota';
import { KioskMode } from './pages/KioskMode';
import { Help } from './pages/Help';
import { UserRole } from './types';

// Wrapper to handle global auth loading state
const AuthWrapper = () => {
    const { loading } = useAuth();

    if (loading) {
       return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="flex flex-col items-center space-y-4">
                  <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 text-sm font-medium animate-pulse">Initializing Tally...</p>
              </div>
          </div>
       );
    }

    return (
        <TutorialProvider>
            <Outlet />
            <TutorialOverlay />
        </TutorialProvider>
    );
};

const ProtectedRoute = ({ children, role }: { children?: React.ReactNode, role?: UserRole }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && user?.role !== role) {
    // Redirect to their appropriate dashboard if wrong role
    return <Navigate to={user?.role === UserRole.ADMIN ? '/admin' : '/staff'} replace />;
  }

  return <Layout>{children}</Layout>;
};

const RootRedirect = () => {
    const { isAuthenticated, user } = useAuth();
    if (isAuthenticated) {
        return <Navigate to={user?.role === UserRole.ADMIN ? '/admin' : '/staff'} replace />;
    }
    return <Landing />;
};

const router = createHashRouter(createRoutesFromElements(
    <Route element={<AuthWrapper />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/action" element={<ActionHandler />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute role={UserRole.ADMIN}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/timesheets" element={<ProtectedRoute role={UserRole.ADMIN}><AdminTimesheets /></ProtectedRoute>} />
        <Route path="/admin/rota" element={<ProtectedRoute role={UserRole.ADMIN}><AdminRota /></ProtectedRoute>} />
        <Route path="/admin/vetting" element={<ProtectedRoute role={UserRole.ADMIN}><AdminVetting /></ProtectedRoute>} />
        <Route path="/admin/staff" element={<ProtectedRoute role={UserRole.ADMIN}><AdminStaff /></ProtectedRoute>} />
        <Route path="/admin/locations" element={<ProtectedRoute role={UserRole.ADMIN}><AdminLocations /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute role={UserRole.ADMIN}><AdminSettings /></ProtectedRoute>} />
        <Route path="/admin/kiosk" element={<ProtectedRoute role={UserRole.ADMIN}><KioskMode /></ProtectedRoute>} />

        {/* Staff Routes */}
        <Route path="/staff" element={<ProtectedRoute role={UserRole.STAFF}><StaffDashboard /></ProtectedRoute>} />
        <Route path="/staff/rota" element={<ProtectedRoute role={UserRole.STAFF}><StaffRota /></ProtectedRoute>} />
        <Route path="/staff/activity" element={<ProtectedRoute role={UserRole.STAFF}><StaffActivity /></ProtectedRoute>} />
        <Route path="/staff/profile" element={<ProtectedRoute role={UserRole.STAFF}><StaffProfile /></ProtectedRoute>} />

        {/* Shared Routes */}
        <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
));

const App = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
