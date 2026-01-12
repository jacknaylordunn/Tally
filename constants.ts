
import { Box, User, Clock, MapPin, QrCode, LogOut, LayoutDashboard, History, Settings, Users, CalendarDays, Calendar } from 'lucide-react';

export const APP_NAME = "Tallyd";
export const LOGO_URL = "https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/Tally%20Logo.png";

export const NAVIGATION_ITEMS = {
  ADMIN: [
    { name: 'Live Board', icon: LayoutDashboard, path: '/admin' },
    { name: 'Rota', icon: CalendarDays, path: '/admin/rota' },
    { name: 'Staff', icon: Users, path: '/admin/staff' },
    { name: 'Timesheets', icon: History, path: '/admin/timesheets' },
    { name: 'Kiosk', icon: QrCode, path: '/admin/kiosk' },
    { name: 'Locations', icon: MapPin, path: '/admin/locations' },
    { name: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  STAFF: [
    { name: 'Status', icon: Clock, path: '/staff' },
    { name: 'My Rota', icon: Calendar, path: '/staff/rota' },
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
