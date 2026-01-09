
import { Box, User, Clock, MapPin, QrCode, LogOut, LayoutDashboard, History, Settings, Users } from 'lucide-react';

export const APP_NAME = "Tally";

export const NAVIGATION_ITEMS = {
  ADMIN: [
    { name: 'Live Board', icon: LayoutDashboard, path: '/admin' },
    { name: 'Staff', icon: Users, path: '/admin/staff' },
    { name: 'Timesheets', icon: History, path: '/admin/timesheets' },
    { name: 'Kiosk', icon: QrCode, path: '/admin/kiosk' },
    { name: 'Locations', icon: MapPin, path: '/admin/locations' },
    { name: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  STAFF: [
    { name: 'Status', icon: Clock, path: '/staff' },
    { name: 'Activity', icon: History, path: '/staff/activity' },
    { name: 'Profile', icon: User, path: '/staff/profile' },
  ]
};

export const COLORS = {
  brand: '#0ea5e9',
  success: '#10b981',
  danger: '#f43f5e',
  warning: '#f59e0b',
};
