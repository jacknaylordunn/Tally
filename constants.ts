
import { Box, User, Clock, MapPin, QrCode, LogOut, LayoutDashboard, History, Settings, Users, CalendarDays, Calendar, HelpCircle, FileCheck } from 'lucide-react';
import { VettingItem, VettingLevel, VettingSection } from './types';

export const APP_NAME = "Tallyd";
export const LOGO_URL = "https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/Tally%20Logo.png";

export const NAVIGATION_ITEMS = {
  ADMIN: [
    { name: 'Live Board', icon: LayoutDashboard, path: '/admin' },
    { name: 'Rota', icon: CalendarDays, path: '/admin/rota' },
    { name: 'Vetting', icon: FileCheck, path: '/admin/vetting' },
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

const createItem = (
    id: string, 
    label: string, 
    section: VettingSection, 
    type: 'file' | 'check' | 'declaration' | 'address_history' | 'employment_history' = 'file', 
    description?: string,
    instruction?: string,
    adminOnly: boolean = false,
    formFields?: { key: string; label: string; type: 'text' | 'date'; required?: boolean; }[]
): VettingItem => ({
    id, label, section, type, description, instruction, required: true, status: 'pending', adminOnly, formFields
});

export const VETTING_TEMPLATES: Record<VettingLevel, VettingItem[]> = {
    'NONE': [],
    'CUSTOM': [
        createItem('id_check', 'Proof of ID', 'identity', 'file', 'Passport or Driving Licence', 'Upload a clear, color copy of your passport (photo page) or driving license (front and back). Ensure all text is legible and no corners are cut off.'),
        createItem('address_check', 'Proof of Address', 'identity', 'file', 'Utility bill or bank statement', 'Must be dated within the last 3 months. Mobile phone bills are not accepted.')
    ],
    'BS7858': [
        // SECTION 1: IDENTITY & RESIDENCE
        createItem('id_check', 'ID Confirmation', 'identity', 'file', 'Passport or Driving Licence', 'Upload a high-quality color scan or photo. Ensure no glare covers the text or photo. If using a passport, show the entire photo page.'),
        createItem('address_history', '5 Year Address History', 'identity', 'address_history', 'Full 5-year history required.', 'List every address you have lived at for the past 5 years. There must be no gaps in dates.'),
        createItem('right_to_work', 'Right to Work Check', 'identity', 'file', 'Share code or RTW Document', 'For non-UK nationals, provide a Home Office Share Code. For UK/Irish nationals, a Passport scan is sufficient if not already uploaded.'),
        
        // SECTION 2: EMPLOYMENT
        createItem('employment_5yr', '5 Year Employment History', 'history', 'employment_history', 'History covering last 5 years', 'Provide details of all employment, self-employment, and unemployment periods for the last 5 years. Contact details for references are mandatory.'),
        createItem('gap_reference', 'Gap Referencing', 'history', 'check', 'Admin verification of gaps', 'Internal check: Any gap over 31 days has been verified via personal reference or evidence.', true),
        
        // SECTION 3: FINANCIAL
        createItem('financial_bankruptcy', 'Bankruptcy/IVA Check', 'financial', 'check', 'Insolvency Register Check', 'Internal check: Verify applicant is not currently bankrupt or under an IVA.', true),
        createItem('financial_credit', 'Consumer Credit Check', 'financial', 'check', 'Credit Report', 'Internal check: Soft credit search completed. No CCJs > £10,000.', true),
        
        // SECTION 4: SECURITY & QUALIFICATIONS
        createItem('sia_license', 'SIA Licence Check', 'security', 'check', 'SIA Card Validation', 'Enter your 16-digit SIA licence number. We will verify this against the public register.', false, [
            { key: 'sia_number', label: 'SIA License Number', type: 'text', required: true },
            { key: 'sia_expiry', label: 'Expiry Date', type: 'date', required: true }
        ]),
        createItem('criminal_basic', 'Basic Disclosure Check', 'security', 'file', 'DBS Certificate', 'Upload your Basic DBS certificate (must be less than 12 months old) or provide consent for us to perform a check.', false, [
            { key: 'dbs_number', label: 'DBS Certificate Number', type: 'text' },
            { key: 'dbs_issue_date', label: 'Issue Date', type: 'date' }
        ])
    ],
    'BPSS': [
        createItem('identity', 'Identity Verification', 'identity', 'file', 'Passport/Birth Certificate', 'Proof of identity.'),
        createItem('right_to_work', 'Right to Work', 'identity', 'file', 'Proof of legal right to work in UK', 'Share code or valid visa document.'),
        createItem('employment_3yr', '3 Year Employment History', 'history', 'employment_history', 'References for past 3 years', 'List all employers for the last 3 years.'),
        createItem('criminal_decl', 'Criminal Record Declaration', 'security', 'declaration', 'Declaration of unspent convictions', 'I declare that I have no unspent convictions as per the Rehabilitation of Offenders Act 1974.')
    ],
    'PCI_DSS': [
        createItem('identity', 'ID Confirmation', 'identity', 'file', 'Photo ID', 'Valid Passport or Driving Licence.'),
        createItem('financial_insolvency', 'Bankruptcy/Insolvency Check', 'financial', 'check', 'Admin Only', 'Internal Check.', true),
        createItem('financial_credit', 'Credit Score', 'financial', 'check', 'Admin Only', 'Internal Check.', true),
        createItem('employment_verify', 'Previous Employers Verification', 'history', 'employment_history', 'Proof of last 2 employers', 'Contact details for last 2 employers.'),
        createItem('criminal_basic', 'Basic Disclosure', 'security', 'file', 'DBS Certificate', 'Upload a valid Basic DBS certificate.')
    ],
    'AIRSIDE': [
        createItem('identity', 'ID Verification', 'identity', 'file', 'Passport', 'Valid Passport required.'),
        createItem('address_verify', 'Address Verification', 'identity', 'address_history', '5 Year History', '5 years of address history with no gaps.'),
        createItem('financial_check', 'Financial Credit Check', 'financial', 'check', 'Admin Only', 'Internal Check.', true),
        createItem('employment_5yr', '5 Year Employment History', 'history', 'employment_history', '5 Year History', '5 years of employment history with no gaps > 28 days.'),
        createItem('gap_reference', 'Gap Referencing', 'history', 'check', 'Admin verification', 'Internal Check.', true),
        createItem('criminal_basic', 'Basic Disclosure', 'security', 'file', 'DBS Certificate', 'Basic DBS Certificate.')
    ],
    'CQC': [
        createItem('identity', 'ID Verification', 'identity', 'file', 'Photo ID', 'Passport or Driving License.'),
        createItem('address_verify', 'Address Verification', 'identity', 'address_history', 'Current Address', 'Proof of current address.'),
        createItem('right_to_work', 'Right to Work (IDVT)', 'identity', 'file', 'RTW Document', 'Proof of Right to Work in UK.'),
        createItem('education', 'Education/Licence Verification', 'qualifications', 'file', 'Certificates', 'Upload relevant care qualifications or nursing PIN.'),
        createItem('employment_5yr', '5 Year Employment History', 'history', 'employment_history', 'Full history', 'Full employment history including explanation of gaps.'),
        createItem('criminal_enhanced', 'Enhanced Disclosure (DBS)', 'security', 'file', 'Enhanced DBS', 'Enhanced DBS Certificate including Barred List check.')
    ]
};
