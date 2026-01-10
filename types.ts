
export enum UserRole {
  STAFF = 'staff',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  email: string;
  name: string;
  currentCompanyId?: string;
  activeShiftId?: string | null;
  role: UserRole;
  customHourlyRate?: number; // Override company default
  position?: string; // e.g. "Senior Medic"
  isApproved?: boolean; // If true, can clock in. If undefined, assume true (migration).
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  code: string; // The invite code
  settings: {
    geofenceRadius: number;
    adminSecret: string;
    allowManualClockIn: boolean; // Kept for DB compatibility, but UI control removed
    requireApproval: boolean;
    // Branding
    logoUrl?: string;
    primaryColor?: string;
    // Payroll
    defaultHourlyRate?: number;
    currency?: string;
    // Holiday Pay
    holidayPayEnabled?: boolean;
    holidayPayRate?: number; // Percentage (e.g. 12.07)
  };
}

export interface Shift {
  id: string;
  userId: string;
  userName: string; // Denormalized for easier display
  companyId: string;
  startTime: number; // Timestamp
  endTime: number | null; // Timestamp
  startMethod: 'dynamic_qr' | 'static_gps' | 'manual' | 'manual_entry'; // Added manual_entry for admin creation
  hourlyRate: number;
}

export interface Location {
  id: string;
  companyId: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface ValidationResult {
  success: boolean;
  message: string;
  shift?: Shift;
}
