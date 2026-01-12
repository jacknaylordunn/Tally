
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
    // Rota Settings
    rotaEnabled?: boolean;
    allowShiftBidding?: boolean;
    requireTimeOffApproval?: boolean;
    // Audit Settings
    auditLateInThreshold?: number; // mins
    auditEarlyOutThreshold?: number; // mins
    auditLateOutThreshold?: number; // mins
    auditShortShiftThreshold?: number; // mins
    auditLongShiftThreshold?: number; // hours
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
  scheduleShiftId?: string; // Link to the planned shift on the rota
  scheduledStartTime?: number; // Snapshot of planned start time
  scheduledEndTime?: number;   // Snapshot of planned end time
}

// --- ROTA SYSTEM TYPES ---

export interface ScheduleShift {
  id: string;
  companyId: string;
  locationId: string; // Optional: bind shift to a location
  locationName?: string; // Denormalized
  userId: string | null; // Null means "Open Shift"
  userName?: string;
  role: string; // e.g. "Bar Staff", "Security"
  startTime: number;
  endTime: number;
  notes?: string;
  status: 'draft' | 'published';
  bids?: string[]; // Array of User IDs who want this shift
}

export interface TimeOffRequest {
  id: string;
  userId: string;
  userName: string;
  companyId: string;
  startDate: number; // Start of day timestamp
  endDate: number;   // End of day timestamp
  type: 'holiday' | 'sickness' | 'other';
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
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
