
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import { StaffDashboard } from './pages/StaffDashboard';
import { StaffActivity } from './pages/StaffActivity';
import { StaffProfile } from './pages/StaffProfile';
import { KioskMode } from './pages/KioskMode';
import { UserRole } from './types';

const ProtectedRoute = ({ children, role }: { children?: React.ReactNode, role?: UserRole }) => {
  const { user, isAuthenticated } = useAuth();

  // Note: Loading is handled in AppRoutes now, so we assume auth is resolved here
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && user?.role !== role) {
    // Redirect to their appropriate dashboard if wrong role
    return <Navigate to={user?.role === UserRole.ADMIN ? '/admin' : '/staff'} replace />;
  }

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  const { isAuthenticated, user, loading } = useAuth();

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
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to={user?.role === UserRole.ADMIN ? '/admin' : '/staff'} /> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/action" element={<ActionHandler />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute role={UserRole.ADMIN}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
       <Route path="/admin/timesheets" element={
        <ProtectedRoute role={UserRole.ADMIN}>
          <AdminTimesheets />
        </ProtectedRoute>
      } />
      <Route path="/admin/staff" element={
        <ProtectedRoute role={UserRole.ADMIN}>
          <AdminStaff />
        </ProtectedRoute>
      } />
      <Route path="/admin/locations" element={
        <ProtectedRoute role={UserRole.ADMIN}>
          <AdminLocations />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute role={UserRole.ADMIN}>
          <AdminSettings />
        </ProtectedRoute>
      } />
      <Route path="/admin/kiosk" element={
        <ProtectedRoute role={UserRole.ADMIN}>
            <KioskMode />
        </ProtectedRoute>
      } />

      {/* Staff Routes */}
      <Route path="/staff" element={
        <ProtectedRoute role={UserRole.STAFF}>
          <StaffDashboard />
        </ProtectedRoute>
      } />
      <Route path="/staff/activity" element={
        <ProtectedRoute role={UserRole.STAFF}>
          <StaffActivity /> 
        </ProtectedRoute>
      } />
       <Route path="/staff/profile" element={
        <ProtectedRoute role={UserRole.STAFF}>
          <StaffProfile />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
