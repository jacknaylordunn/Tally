
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shift, Company, User, Location, ValidationResult, UserRole } from '../types';

// Collection References
const USERS_REF = 'users';
const COMPANIES_REF = 'companies';
const LOCATIONS_REF = 'locations';
const SHIFTS_REF = 'shifts';

// --- USER ---

export const getUserProfile = async (userId: string): Promise<User | null> => {
    try {
        const docRef = doc(db, USERS_REF, userId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as User) : null;
    } catch (e) {
        console.error("Error fetching user:", e);
        return null;
    }
};

export const createUserProfile = async (user: User): Promise<void> => {
    await setDoc(doc(db, USERS_REF, user.id), user);
};

export const updateUserProfile = async (userId: string, updates: Partial<User>): Promise<void> => {
    const docRef = doc(db, USERS_REF, userId);
    await updateDoc(docRef, updates);
};

export const deleteUser = async (userId: string): Promise<void> => {
    await deleteDoc(doc(db, USERS_REF, userId));
};

export const getCompanyStaff = async (companyId: string): Promise<User[]> => {
    const q = query(
        collection(db, USERS_REF), 
        where("currentCompanyId", "==", companyId), 
        where("role", "==", UserRole.STAFF)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as User);
};

// --- COMPANY ---

export const getCompanyByCode = async (code: string): Promise<Company | null> => {
    const q = query(collection(db, COMPANIES_REF), where("code", "==", code));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as Company;
    }
    return null;
};

export const createCompany = async (company: Company): Promise<void> => {
    await setDoc(doc(db, COMPANIES_REF, company.id), company);
};

export const getCompany = async (companyId: string): Promise<Company> => {
    const docRef = doc(db, COMPANIES_REF, companyId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Company not found");
    return docSnap.data() as Company;
};

export const updateCompanySettings = async (companyId: string, settings: Partial<Company['settings']>): Promise<void> => {
    const company = await getCompany(companyId);
    const newSettings = { ...company.settings, ...settings };
    const docRef = doc(db, COMPANIES_REF, companyId);
    await updateDoc(docRef, { settings: newSettings });
};

// --- LOCATIONS ---

export const getLocations = async (companyId: string): Promise<Location[]> => {
    const q = query(collection(db, LOCATIONS_REF), where("companyId", "==", companyId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Location);
};

export const createLocation = async (location: Location): Promise<void> => {
    await setDoc(doc(db, LOCATIONS_REF, location.id), location);
};

export const deleteLocation = async (locationId: string): Promise<void> => {
    await deleteDoc(doc(db, LOCATIONS_REF, locationId));
};

// --- SHIFTS & VALIDATION ---

export const getShifts = async (companyId: string): Promise<Shift[]> => {
    try {
        const q = query(
            collection(db, SHIFTS_REF), 
            where("companyId", "==", companyId), 
            orderBy("startTime", "desc"), 
            limit(100)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as Shift);
    } catch (error: any) {
        // Fallback to client-side sorting if index is missing
        if (error.code === 'failed-precondition') {
             console.info("Info: Firestore index not yet built. Falling back to client-side sort.", error.message);
        } else {
             console.error("Error fetching shifts:", error);
        }
        
        const q = query(collection(db, SHIFTS_REF), where("companyId", "==", companyId));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => doc.data() as Shift);
        return data.sort((a, b) => b.startTime - a.startTime);
    }
};

export const getStaffActivity = async (userId: string): Promise<Shift[]> => {
    try {
        const q = query(
            collection(db, SHIFTS_REF), 
            where("userId", "==", userId), 
            orderBy("startTime", "desc"), 
            limit(50)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as Shift);
    } catch (error: any) {
         if (error.code === 'failed-precondition') {
             console.info("Info: Firestore index not yet built. Falling back to client-side sort.", error.message);
        } else {
             console.error("Error fetching staff activity:", error);
        }

        const q = query(collection(db, SHIFTS_REF), where("userId", "==", userId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as Shift).sort((a, b) => b.startTime - a.startTime);
    }
};

export const updateShift = async (shiftId: string, updates: Partial<Shift>): Promise<void> => {
    const docRef = doc(db, SHIFTS_REF, shiftId);
    await updateDoc(docRef, updates);
};

export const toggleManualShift = async (userId: string, companyId: string): Promise<Shift | null> => {
    const user = await getUserProfile(userId);
    const company = await getCompany(companyId);
    if (!user || !company) throw new Error("Invalid Context");
    
    await performClockInOut(user, company, 'manual');
    
    // Return latest shift state (active)
    const q = query(
        collection(db, SHIFTS_REF), 
        where("userId", "==", userId), 
        where("endTime", "==", null)
    );
    const snap = await getDocs(q);
        
    if (!snap.empty) {
        return snap.docs[0].data() as Shift;
    }
    return null;
};

// Core Clock-In Logic
export const verifyToken = async (
  token: string, 
  userId: string,
  type: 'kiosk' | 'static',
  locationData?: { lat: number; lng: number; locationId: string }
): Promise<ValidationResult> => {
    
    // 1. Fetch User & Company
    const user = await getUserProfile(userId);
    if (!user || !user.currentCompanyId) return { success: false, message: 'User not associated with company' };
    
    const company = await getCompany(user.currentCompanyId);

    // 2. Validate Token Type
    if (type === 'kiosk') {
        const timestamp = parseInt(token);
        const now = Date.now();
        // 60s validity window to allow for clock drift between devices
        if (isNaN(timestamp) || now - timestamp > 60000 || now - timestamp < -60000) {
            return { success: false, message: 'QR Code Expired. Please scan again.' };
        }
        return await performClockInOut(user, company, 'dynamic_qr');
    }

    if (type === 'static') {
        if (!locationData) return { success: false, message: 'Location data missing.' };
        
        // Fetch locations list
        const locations = await getLocations(company.id);
        const targetLoc = locations.find(l => l.id === locationData.locationId);
        
        if (!targetLoc) return { success: false, message: 'Invalid Location ID.' };
        
        // Haversine Distance Calculation
        const R = 6371e3; // Earth radius in meters
        const φ1 = locationData.lat * Math.PI/180;
        const φ2 = targetLoc.lat * Math.PI/180;
        const Δφ = (targetLoc.lat - locationData.lat) * Math.PI/180;
        const Δλ = (targetLoc.lng - locationData.lng) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        const allowedRadius = targetLoc.radius || company.settings.geofenceRadius || 200;
        
        if (distance > allowedRadius) {
            return { success: false, message: `You are too far away (${Math.round(distance)}m). Please move closer.` };
        }
        
        return await performClockInOut(user, company, 'static_gps');
    }

    return { success: false, message: 'Invalid scan type' };
};

// Helper: Handles the actual DB writes for clocking in/out
const performClockInOut = async (user: User, company: Company, method: 'dynamic_qr' | 'static_gps' | 'manual'): Promise<ValidationResult> => {
    // Check for active shift
    const q = query(
        collection(db, SHIFTS_REF), 
        where("userId", "==", user.id), 
        where("endTime", "==", null)
    );
    const snap = await getDocs(q);
        
    const activeShiftDoc = !snap.empty ? snap.docs[0] : null;

    if (activeShiftDoc) {
        // --- CLOCK OUT ---
        const shiftData = activeShiftDoc.data() as Shift;
        const docRef = doc(db, SHIFTS_REF, activeShiftDoc.id);
        await updateDoc(docRef, { endTime: Date.now() });
        
        // Update user state
        await updateUserProfile(user.id, { activeShiftId: null });
        
        return { success: true, message: 'Clocked Out Successfully.', shift: { ...shiftData, endTime: Date.now() } };
    } else {
        // --- CLOCK IN ---
        const shiftId = `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newShift: Shift = {
            id: shiftId,
            userId: user.id,
            userName: user.name,
            companyId: company.id,
            startTime: Date.now(),
            endTime: null,
            startMethod: method,
            hourlyRate: user.customHourlyRate || company.settings.defaultHourlyRate || 15
        };
        
        await setDoc(doc(db, SHIFTS_REF, shiftId), newShift);
        
        // Update user state
        await updateUserProfile(user.id, { activeShiftId: shiftId });
        
        return { success: true, message: 'Clocked In Successfully.', shift: newShift };
    }
};
