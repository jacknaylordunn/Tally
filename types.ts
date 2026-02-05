
export enum UserRole {
  STAFF = 'staff',
  ADMIN = 'admin',
}

// Vetting Standards
export type VettingLevel = 'NONE' | 'BS7858' | 'BPSS' | 'PCI_DSS' | 'AIRSIDE' | 'CQC' | 'CUSTOM';

export type VettingStatus = 'not_started' | 'in_progress' | 'submitted' | 'verified' | 'rejected' | 'changes_requested';

export interface VettingItem {
  id: string;
  label: string;
  description?: string;
  type: 'file' | 'declaration' | 'check'; // 'check' is for admin to tick off manually (e.g. credit check)
  required: boolean;
  
  // User Data
  status: 'pending' | 'uploaded' | 'accepted' | 'rejected';
  fileUrl?: string;
  fileName?: string;
  submittedAt?: number;
  
  // Admin Data
  verifiedAt?: number;
  verifiedBy?: string;
  expiryDate?: number; // For expiring docs like insurance/passport
  adminNotes?: string;
}

export interface User {
  id: string;
  email: string;
  name: string; // Display name (Composite of First + Last)
  firstName?: string; // New
  lastName?: string; // New
  employeeNumber?: string; // New: Company specific ID
  currentCompanyId?: string;
  activeShiftId?: string | null;
  role: UserRole;
  customHourlyRate?: number; // Override company default
  position?: string; // Primary/Legacy position
  roles?: string[]; // New: Multiple roles for Rota filtering
  isApproved?: boolean; // If true, can clock in. If undefined, assume true (migration).
  tutorialSeen?: boolean; // Tracks if the user has completed the welcome tour
  
  // Vetting
  vettingStatus?: VettingStatus;
  vettingData?: VettingItem[]; // The specific requirements and their state for this user
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
    showStaffEarnings?: boolean; // New: Toggle staff seeing their pay
    // Payroll Export Settings
    exportShowShiftTimesWeekly?: boolean;
    exportShowShiftTimesMonthly?: boolean;
    exportIncludeDeductions?: boolean; // New: Add tax/net columns to export
    // Holiday Pay
    holidayPayEnabled?: boolean;
    holidayPayRate?: number; // Percentage (e.g. 12.07)
    // Rota Settings
    rotaEnabled?: boolean;
    rotaShowFinishTimes?: boolean; // New: Toggle end times on/off
    allowShiftBidding?: boolean;
    requireTimeOffApproval?: boolean;
    // Audit Settings
    auditLateInThreshold?: number; // mins
    auditEarlyInThreshold?: number; // mins (New)
    auditEarlyOutThreshold?: number; // mins
    auditLateOutThreshold?: number; // mins
    auditShortShiftThreshold?: number; // mins
    auditLongShiftThreshold?: number; // hours
    blockEarlyClockIn?: boolean; // New: Prevent clocking in too early
    // Vetting Settings
    vettingEnabled?: boolean;
    vettingLevel?: VettingLevel;
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
  
  // Audit Trail
  createdByName?: string;
  createdById?: string;
  editedByName?: string;
  editedById?: string;
  editedAt?: number;
  
  // Review Status
  warningsDismissed?: boolean; // If true, alerts for this shift are ignored in the dashboard
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
  isOffered?: boolean; // If true, the current assignee is offering this shift for swap/cover
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

// --- TUTORIAL & GUIDE SYSTEM ---

export interface TutorialStep {
  targetId: string; // ID of the DOM element to highlight
  title: string;
  content: string;
  requiredRoute?: string; // If set, tutorial waits until user navigates here
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'next'; // 'click' means user must click target to advance
  transparentBackdrop?: boolean; // If true, the dark overlay is removed
}

export interface InteractiveGuide {
  id: string;
  title: string;
  steps: {
    targetId?: string; // Optional: if null, just shows text
    content: string;
    route: string; // Route to navigate to for this step
  }[];
}

// --- CHAT SYSTEM TYPES ---

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
  type: 'text' | 'image' | 'system';
  readBy?: string[];
}

export interface Conversation {
  id: string;
  companyId: string;
  type: 'direct' | 'group' | 'channel';
  name?: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: number;
    type: 'text' | 'image' | 'system';
    readBy: string[];
  };
  settings?: {
    autoJoin?: boolean;
  };
  createdAt?: number;
}
