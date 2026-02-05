
import { Box, User, Clock, MapPin, QrCode, LogOut, LayoutDashboard, History, Settings, Users, CalendarDays, Calendar, HelpCircle } from 'lucide-react';
import { VettingItem, VettingLevel } from './types';

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
    { name: 'Help Center', icon: HelpCircle, path: '/help' },
  ],
  STAFF: [
    { name: 'Status', icon: Clock, path: '/staff' },
    { name: 'My Rota', icon: Calendar, path: '/staff/rota' },
    { name: 'Activity', icon: History, path: '/staff/activity' },
    { name: 'Profile', icon: User, path: '/staff/profile' },
    { name: 'Help', icon: HelpCircle, path: '/help' },
  ]
};

export const COLORS = {
  brand: '#0ea5e9',
  success: '#10b981',
  danger: '#f43f5e',
  warning: '#f59e0b',
};

// --- VETTING TEMPLATES ---

const createItem = (id: string, label: string, type: 'file' | 'check' | 'declaration' = 'file', description?: string): VettingItem => ({
    id, label, type, description, required: true, status: 'pending'
});

export const VETTING_TEMPLATES: Record<VettingLevel, VettingItem[]> = {
    'NONE': [],
    'CUSTOM': [
        createItem('id_check', 'Proof of ID', 'file', 'Passport or Driving Licence'),
        createItem('address_check', 'Proof of Address', 'file', 'Utility bill or bank statement (under 3 months old)')
    ],
    'BS7858': [
        createItem('id_check', 'ID Confirmation', 'file', 'Passport or Driving Licence'),
        createItem('address_history', '5 Year Address History', 'file', 'Proof of address or electoral roll data'),
        createItem('right_to_work', 'Right to Work Check', 'file', 'Share code or document'),
        createItem('sia_license', 'SIA Licence Check', 'check', 'Admin to verify if applicable'),
        createItem('financial_bankruptcy', 'Financial: Bankruptcy/IVA Check', 'check', 'Admin verification required'),
        createItem('financial_credit', 'Financial: Credit Score', 'check', 'Admin verification required'),
        createItem('employment_5yr', '5 Year Employment History', 'file', 'CV and references covering 5 years'),
        createItem('gap_reference', 'Gap Referencing', 'check', 'Check gaps over 31 days'),
        createItem('criminal_basic', 'Basic Disclosure Check', 'file', 'DBS Certificate')
    ],
    'BPSS': [
        createItem('identity', 'Identity Verification', 'file', 'Passport/Birth Certificate'),
        createItem('right_to_work', 'Right to Work', 'file', 'Proof of legal right to work in UK'),
        createItem('employment_3yr', '3 Year Employment History', 'file', 'References for past 3 years'),
        createItem('criminal_decl', 'Criminal Record Declaration', 'declaration', 'I declare unspent convictions...')
    ],
    'PCI_DSS': [
        createItem('identity', 'ID Confirmation', 'file'),
        createItem('financial_insolvency', 'Bankruptcy/Insolvency Check', 'check'),
        createItem('financial_ccj', 'CCJ Check', 'check'),
        createItem('financial_credit', 'Credit Score', 'check'),
        createItem('employment_verify', 'Previous Employers Verification', 'file', 'Proof of last 2 employers'),
        createItem('criminal_basic', 'Basic Disclosure', 'file')
    ],
    'AIRSIDE': [
        createItem('identity', 'ID Verification', 'file'),
        createItem('address_verify', 'Address Verification', 'file'),
        createItem('financial_check', 'Financial Credit Check', 'check', 'Bankruptcy, CCJ, Credit Score'),
        createItem('employment_5yr', '5 Year Employment History', 'file'),
        createItem('gap_reference', 'Gap Referencing', 'check'),
        createItem('criminal_basic', 'Basic Disclosure', 'file')
    ],
    'CQC': [
        createItem('identity', 'ID Verification', 'file'),
        createItem('address_verify', 'Address Verification', 'file'),
        createItem('right_to_work', 'Right to Work (IDVT)', 'file'),
        createItem('education', 'Education/Licence Verification', 'file', 'Certificates'),
        createItem('employment_5yr', '5 Year Employment History', 'file'),
        createItem('gap_reference', 'Gap Referencing', 'check'),
        createItem('criminal_enhanced', 'Enhanced Disclosure (DBS)', 'file')
    ]
};
