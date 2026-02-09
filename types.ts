
export enum UserRole {
  STAFF = 'staff',
  ADMIN = 'admin',
}

// Vetting Standards
export type VettingLevel = 'NONE' | 'BS7858' | 'BPSS' | 'PCI_DSS' | 'AIRSIDE' | 'CQC' | 'CUSTOM';

export type VettingStatus = 'not_started' | 'in_progress' | 'submitted' | 'verified' | 'rejected' | 'changes_requested';

export type VettingSection = 'identity' | 'history' | 'financial' | 'security' | 'qualifications';

export interface VettingFile {
  url: string;
  name: string;
  type: string;
  uploadedAt: number;
  storagePath?: string; // Added for easier deletion
}

export interface AddressData {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  dateFrom: string; // YYYY-MM
  dateTo?: string; // YYYY-MM or empty if current
  current: boolean;
}

export interface EmploymentData {
  id: string;
  employerName: string;
  role: string;
  dateFrom: string; // YYYY-MM
  dateTo?: string; // YYYY-MM
  current: boolean;
  contactEmail?: string;
  contactPhone?: string;
}

export interface VettingItem {
  id: string;
  label: string;
  description?: string;
  instruction?: string; // New: Detailed user-facing instruction
  section: VettingSection; 
  type: 'file' | 'declaration' | 'check' | 'address_history' | 'employment_history'; 
  required: boolean;
  adminOnly?: boolean; 
  
  // Specific Form Fields
  formFields?: {
      key: string;
      label: string;
      type: 'text' | 'date';
      required?: boolean;
  }[];

  // User Data
  status: 'pending' | 'uploaded' | 'accepted' | 'rejected';
  
  // Modern Data Structure
  files?: VettingFile[];
  data?: {
    addresses?: AddressData[];
    employment?: EmploymentData[];
    declarationText?: string;
    formValues?: Record<string, string>;
    [key: string]: any;
  };

  // Legacy/Simple support
  fileUrl?: string;
  fileName?: string;
  submittedAt?: number;
  
  // Admin Data
  verifiedAt?: number;
  verifiedBy?: string;
  expiryDate?: number; 
  adminNotes?: string;
}

export interface User {
  id: string;
  email: string;
  name: string; 
  firstName?: string; 
  lastName?: string; 
  employeeNumber?: string; 
  currentCompanyId?: string;
  activeShiftId?: string | null;
  role: UserRole;
  customHourlyRate?: number; 
  position?: string; 
  roles?: string[]; 
  isApproved?: boolean; 
  tutorialSeen?: boolean; 
  
  // Vetting
  vettingStatus?: VettingStatus;
  vettingData?: VettingItem[]; 
  vettingProgress?: number; // 0-100
  vettingLastUpdated?: number;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  code: string; 
  settings: {
    geofenceRadius: number;
    adminSecret: string;
    allowManualClockIn: boolean; 
    requireApproval: boolean;
    // Branding
    logoUrl?: string;
    primaryColor?: string;
    // Payroll
    defaultHourlyRate?: number;
    currency?: string;
    showStaffEarnings?: boolean; 
    // Payroll Export Settings
    exportShowShiftTimesWeekly?: boolean;
    exportShowShiftTimesMonthly?: boolean;
    exportIncludeDeductions?: boolean; 
    // Holiday Pay
    holidayPayEnabled?: boolean;
    holidayPayRate?: number; 
    // Rounding & Compliance
    payrollSnapToSchedule?: boolean; // If clock in early, pay from schedule start
    payrollRoundToMinutes?: number; // 0, 5, 15, 30
    breakType?: 'paid' | 'unpaid';
    
    // Rota Settings
    rotaEnabled?: boolean;
    rotaShowFinishTimes?: boolean; 
    allowShiftBidding?: boolean;
    requireTimeOffApproval?: boolean;
    // Audit Settings
    auditLateInThreshold?: number; 
    auditEarlyInThreshold?: number; 
    auditEarlyOutThreshold?: number; 
    auditLateOutThreshold?: number; 
    auditShortShiftThreshold?: number; 
    auditLongShiftThreshold?: number; 
    blockEarlyClockIn?: boolean; 
    // Vetting Settings
    vettingEnabled?: boolean;
    vettingLevel?: VettingLevel;
  };
}

export interface Break {
    id: string;
    startTime: number;
    endTime?: number;
    duration?: number; // Calculated on close (ms)
}

export interface Shift {
  id: string;
  userId: string;
  userName: string; 
  companyId: string;
  startTime: number; 
  endTime: number | null; 
  startMethod: 'dynamic_qr' | 'static_gps' | 'manual' | 'manual_entry'; 
  hourlyRate: number;
  scheduleShiftId?: string; 
  scheduledStartTime?: number; 
  scheduledEndTime?: number;   
  
  // New: Breaks
  breaks?: Break[];
  
  // Audit Trail
  createdByName?: string;
  createdById?: string;
  editedByName?: string;
  editedById?: string;
  editedAt?: number;
  
  // Review Status
  warningsDismissed?: boolean; 
}

// --- ROTA SYSTEM TYPES ---

export interface ScheduleShift {
  id: string;
  companyId: string;
  locationId: string; 
  locationName?: string; 
  userId: string | null; 
  userName?: string;
  role: string; 
  startTime: number;
  endTime: number;
  notes?: string;
  status: 'draft' | 'published';
  bids?: string[]; 
  isOffered?: boolean; 
}

export interface TimeOffRequest {
  id: string;
  userId: string;
  userName: string;
  companyId: string;
  startDate: number; 
  endDate: number;   
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
  targetId: string; 
  title: string;
  content: string;
  requiredRoute?: string; 
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'next'; 
  transparentBackdrop?: boolean; 
}

export interface InteractiveGuide {
  id: string;
  title: string;
  steps: {
    targetId?: string; 
    content: string;
    route: string; 
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
