
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
    limit,
    writeBatch,
    deleteField,
    arrayUnion,
    arrayRemove,
    onSnapshot,
    addDoc,
    getCountFromServer
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shift, Company, User, Location, ValidationResult, UserRole, ScheduleShift, TimeOffRequest, Conversation, ChatMessage } from '../types';

// Collection References
const USERS_REF = 'users';
const COMPANIES_REF = 'companies';
const LOCATIONS_REF = 'locations';
const SHIFTS_REF = 'shifts';
const SCHEDULE_REF = 'schedule_shifts';
const TIMEOFF_REF = 'time_off_requests';
const CONVERSATIONS_REF = 'conversations';

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

export const sendHeartbeat = async (userId: string): Promise<void> => {
    // Lightweight update for online status
    const docRef = doc(db, USERS_REF, userId);
    await updateDoc(docRef, { lastActive: Date.now() });
};

export const deleteUser = async (userId: string): Promise<void> => {
    await deleteDoc(doc(db, USERS_REF, userId));
};

export const removeUserFromCompany = async (userId: string): Promise<void> => {
    const docRef = doc(db, USERS_REF, userId);
    await updateDoc(docRef, {
        currentCompanyId: deleteField(),
        activeShiftId: null,
        customHourlyRate: deleteField(),
        position: deleteField(),
        isApproved: deleteField(),
        role: UserRole.STAFF // Reset to staff
    });
};

export const getCompanyStaff = async (companyId: string): Promise<User[]> => {
    const q = query(
        collection(db, USERS_REF), 
        where("currentCompanyId", "==", companyId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as User);
};

// --- JOINING LOGIC WITH AUTO-JOIN CHATS ---
export const switchUserCompany = async (userId: string, inviteCode: string): Promise<{ success: boolean, message: string }> => {
    const company = await getCompanyByCode(inviteCode);
    if (!company) {
        return { success: false, message: 'Invalid Invite Code' };
    }

    const isApproved = !company.settings.requireApproval;

    // 1. Update Profile
    await updateUserProfile(userId, { 
        currentCompanyId: company.id,
        activeShiftId: null,
        position: undefined,
        customHourlyRate: undefined,
        role: UserRole.STAFF, 
        isApproved: isApproved
    });

    // 2. Auto-Join Channels
    // Find all channels for this company where autoJoin is true
    try {
        const q = query(
            collection(db, CONVERSATIONS_REF),
            where("companyId", "==", company.id),
            where("settings.autoJoin", "==", true)
        );
        const autoJoinSnapshot = await getDocs(q);
        
        if (!autoJoinSnapshot.empty) {
            const batch = writeBatch(db);
            const userProfile = await getUserProfile(userId);
            const userName = userProfile?.name || "New Staff";

            autoJoinSnapshot.docs.forEach(docSnap => {
                const ref = doc(db, CONVERSATIONS_REF, docSnap.id);
                batch.update(ref, {
                    participants: arrayUnion(userId),
                    [`participantNames.${userId}`]: userName
                });
            });
            await batch.commit();
        }
    } catch (e) {
        console.error("Failed to auto-join channels", e);
        // Don't fail the whole join process for this
    }

    const msg = isApproved ? `Joined ${company.name}` : `Joined ${company.name}. Approval Pending.`;
    return { success: true, message: msg };
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

export const updateCompany = async (companyId: string, updates: Partial<Company>): Promise<void> => {
    const docRef = doc(db, COMPANIES_REF, companyId);
    await updateDoc(docRef, updates);
}

export const updateCompanySettings = async (companyId: string, settings: Partial<Company['settings']>): Promise<void> => {
    const company = await getCompany(companyId);
    const newSettings = { ...company.settings, ...settings };
    const docRef = doc(db, COMPANIES_REF, companyId);
    await updateDoc(docRef, { settings: newSettings });
};

export const deleteCompanyFull = async (companyId: string): Promise<void> => {
    const batch = writeBatch(db);
    const compRef = doc(db, COMPANIES_REF, companyId);
    batch.delete(compRef);
    const locQ = query(collection(db, LOCATIONS_REF), where("companyId", "==", companyId));
    const locSnaps = await getDocs(locQ);
    locSnaps.forEach(d => batch.delete(d.ref));
    await batch.commit();
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

// --- ROTA / SCHEDULE SYSTEM ---

export const createScheduleShift = async (shift: ScheduleShift): Promise<void> => {
    await setDoc(doc(db, SCHEDULE_REF, shift.id), shift);
};

export const createBatchScheduleShifts = async (shifts: ScheduleShift[]): Promise<void> => {
    const batch = writeBatch(db);
    // Firestore batch limit is 500
    const chunks = [];
    for (let i = 0; i < shifts.length; i += 400) {
        chunks.push(shifts.slice(i, i + 400));
    }

    for (const chunk of chunks) {
        const chunkBatch = writeBatch(db);
        chunk.forEach(shift => {
            const ref = doc(db, SCHEDULE_REF, shift.id);
            chunkBatch.set(ref, shift);
        });
        await chunkBatch.commit();
    }
};

export const updateScheduleShift = async (shiftId: string, updates: Partial<ScheduleShift>): Promise<void> => {
    await updateDoc(doc(db, SCHEDULE_REF, shiftId), updates);
};

export const updateBatchScheduleShifts = async (updates: { id: string, data: Partial<ScheduleShift> }[]): Promise<void> => {
    const batch = writeBatch(db);
    updates.forEach(u => {
        const ref = doc(db, SCHEDULE_REF, u.id);
        batch.update(ref, u.data);
    });
    await batch.commit();
};

export const deleteScheduleShift = async (shiftId: string): Promise<void> => {
    await deleteDoc(doc(db, SCHEDULE_REF, shiftId));
};

export const getSchedule = async (companyId: string, startTime: number, endTime: number): Promise<ScheduleShift[]> => {
    const q = query(
        collection(db, SCHEDULE_REF), 
        where("companyId", "==", companyId),
        where("startTime", ">=", startTime),
        where("startTime", "<=", endTime)
    );
    
    try {
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ScheduleShift);
    } catch (e: any) {
        if (e.code === 'failed-precondition') {
             console.warn("Index missing. Falling back to fetch.");
             const fallbackQ = query(
                 collection(db, SCHEDULE_REF), 
                 where("companyId", "==", companyId),
                 limit(1000) 
             );
             const snap = await getDocs(fallbackQ);
             return snap.docs
                 .map(d => d.data() as ScheduleShift)
                 .filter(s => s.startTime >= startTime && s.startTime <= endTime);
        }
        throw e;
    }
};

export const getGlobalDraftCount = async (companyId: string): Promise<number> => {
    const q = query(
        collection(db, SCHEDULE_REF), 
        where("companyId", "==", companyId),
        where("status", "==", "draft")
    );
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
};

export const copyScheduleWeek = async (companyId: string, sourceWeekStart: number, targetWeekStart: number): Promise<void> => {
    const sourceEnd = sourceWeekStart + (7 * 24 * 60 * 60 * 1000) + (12 * 60 * 60 * 1000); 
    const sourceShifts = await getSchedule(companyId, sourceWeekStart, sourceEnd);
    
    if (sourceShifts.length === 0) return;

    const timeDiff = targetWeekStart - sourceWeekStart;
    const newShifts: ScheduleShift[] = sourceShifts.map(s => {
        const newStart = s.startTime + timeDiff;
        const newEnd = s.endTime + timeDiff;
        return {
            ...s,
            id: `sch_${Date.now()}_cp_${Math.random().toString(36).substr(2,5)}_${Math.floor(Math.random()*1000)}`,
            startTime: newStart,
            endTime: newEnd,
            status: 'draft', 
            bids: [], 
            isOffered: false 
        };
    });

    await createBatchScheduleShifts(newShifts);
};

export const bidOnShift = async (shiftId: string, userId: string): Promise<void> => {
    const ref = doc(db, SCHEDULE_REF, shiftId);
    await updateDoc(ref, {
        bids: arrayUnion(userId)
    });
};

export const cancelBid = async (shiftId: string, userId: string): Promise<void> => {
    const ref = doc(db, SCHEDULE_REF, shiftId);
    await updateDoc(ref, {
        bids: arrayRemove(userId)
    });
};

export const setShiftOfferStatus = async (shiftId: string, isOffered: boolean): Promise<void> => {
    const ref = doc(db, SCHEDULE_REF, shiftId);
    await updateDoc(ref, { isOffered });
};

export const assignShiftToUser = async (shiftId: string, userId: string, userName: string): Promise<void> => {
    const ref = doc(db, SCHEDULE_REF, shiftId);
    await updateDoc(ref, {
        userId: userId,
        userName: userName,
        bids: [],
        isOffered: false 
    });
};

export const publishDrafts = async (companyId: string, startTime?: number, endTime?: number): Promise<void> => {
    const q = query(
        collection(db, SCHEDULE_REF), 
        where("companyId", "==", companyId),
        where("status", "==", "draft")
    );
    
    const snap = await getDocs(q);
    const docsToUpdate = [];

    snap.docs.forEach(d => {
        const data = d.data() as ScheduleShift;
        let shouldPublish = true;

        // Apply date filter in memory if provided
        if (startTime !== undefined && endTime !== undefined) {
            if (data.startTime < startTime || data.startTime > endTime) {
                shouldPublish = false;
            }
        }

        if (shouldPublish) {
            docsToUpdate.push(d.ref);
        }
    });

    // Batch update (chunk by 400 for safety)
    const chunks = [];
    for (let i = 0; i < docsToUpdate.length; i += 400) {
        chunks.push(docsToUpdate.slice(i, i + 400));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(ref => {
            batch.update(ref, { status: 'published' });
        });
        await batch.commit();
    }
};

// --- TIME OFF ---

export const createTimeOffRequest = async (request: TimeOffRequest): Promise<void> => {
    await setDoc(doc(db, TIMEOFF_REF, request.id), request);
};

export const updateTimeOffStatus = async (requestId: string, status: 'approved' | 'rejected'): Promise<void> => {
    await updateDoc(doc(db, TIMEOFF_REF, requestId), { status });
};

export const deleteTimeOffRequest = async (requestId: string): Promise<void> => {
    await deleteDoc(doc(db, TIMEOFF_REF, requestId));
};

export const getTimeOffRequests = async (companyId: string): Promise<TimeOffRequest[]> => {
    const q = query(
        collection(db, TIMEOFF_REF), 
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as TimeOffRequest);
};

export const getMyTimeOff = async (userId: string): Promise<TimeOffRequest[]> => {
    const q = query(
        collection(db, TIMEOFF_REF), 
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as TimeOffRequest);
};

// --- ACTUAL SHIFTS (Time Tracking) ---

export const getShifts = async (companyId: string): Promise<Shift[]> => {
    try {
        const q = query(
            collection(db, SHIFTS_REF), 
            where("companyId", "==", companyId), 
            orderBy("startTime", "desc"), 
            limit(500) 
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as Shift);
    } catch (error: any) {
        // Fallback if index missing
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
        const q = query(collection(db, SHIFTS_REF), where("userId", "==", userId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as Shift).sort((a, b) => b.startTime - a.startTime);
    }
};

export const updateShift = async (shiftId: string, updates: Partial<Shift>): Promise<void> => {
    const docRef = doc(db, SHIFTS_REF, shiftId);
    await updateDoc(docRef, updates);
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    await deleteDoc(doc(db, SHIFTS_REF, shiftId));
};

export const createManualShift = async (
    companyId: string, 
    userId: string, 
    userName: string, 
    startTime: number, 
    endTime: number,
    hourlyRate: number,
    creatorName?: string,
    creatorId?: string
): Promise<void> => {
    const shiftId = `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newShift: Shift = {
        id: shiftId,
        userId,
        userName,
        companyId,
        startTime,
        endTime,
        startMethod: 'manual_entry',
        hourlyRate,
        createdByName: creatorName,
        createdById: creatorId
    };
    await setDoc(doc(db, SHIFTS_REF, shiftId), newShift);
};

// Core Clock-In Logic
export const verifyToken = async (
  token: string, 
  userId: string,
  type: 'kiosk' | 'static',
  locationData?: { lat: number; lng: number; locationId: string }
): Promise<ValidationResult> => {
    
    const user = await getUserProfile(userId);
    if (!user || !user.currentCompanyId) return { success: false, message: 'User not associated with company' };
    
    if (user.isApproved === false) {
        return { success: false, message: 'Account pending admin approval.' };
    }

    const company = await getCompany(user.currentCompanyId);

    if (type === 'kiosk') {
        const timestamp = parseInt(token);
        const now = Date.now();
        if (isNaN(timestamp) || now - timestamp > 60000 || now - timestamp < -60000) {
            return { success: false, message: 'QR Code Expired. Please scan again.' };
        }
        return await performClockInOut(user, company, 'dynamic_qr');
    }

    if (type === 'static') {
        if (!locationData) return { success: false, message: 'Location data missing.' };
        const locations = await getLocations(company.id);
        const targetLoc = locations.find(l => l.id === locationData.locationId);
        if (!targetLoc) return { success: false, message: 'Invalid Location ID.' };
        
        const R = 6371e3;
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

const performClockInOut = async (user: User, company: Company, method: 'dynamic_qr' | 'static_gps' | 'manual'): Promise<ValidationResult> => {
    const q = query(
        collection(db, SHIFTS_REF), 
        where("userId", "==", user.id), 
        where("endTime", "==", null)
    );
    const snap = await getDocs(q);
        
    const activeShiftDoc = !snap.empty ? snap.docs[0] : null;

    if (activeShiftDoc) {
        const shiftData = activeShiftDoc.data() as Shift;
        const docRef = doc(db, SHIFTS_REF, activeShiftDoc.id);
        await updateDoc(docRef, { endTime: Date.now() });
        await updateUserProfile(user.id, { activeShiftId: null });
        return { success: true, message: 'Clocked Out Successfully.', shift: { ...shiftData, endTime: Date.now() } };
    } else {
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000;
        let rotaData: Partial<Shift> = {};

        if (company.settings.rotaEnabled) {
            try {
                const schedQ = query(
                    collection(db, SCHEDULE_REF), 
                    where("companyId", "==", company.id),
                    where("userId", "==", user.id),
                    where("startTime", ">=", now - twoHours) 
                );
                const schedSnap = await getDocs(schedQ);
                
                const matchingShift = schedSnap.docs
                    .map(d => ({ data: d.data() as ScheduleShift, id: d.id }))
                    .find(s => Math.abs(s.data.startTime - now) < twoHours); 

                if (matchingShift) {
                    if (matchingShift.id) rotaData.scheduleShiftId = matchingShift.id;
                    if (matchingShift.data.startTime !== undefined) rotaData.scheduledStartTime = matchingShift.data.startTime;
                    if (matchingShift.data.endTime !== undefined) rotaData.scheduledEndTime = matchingShift.data.endTime;
                }
            } catch (e) {
                console.error("Rota integration check failed.", e);
            }
        }

        const shiftId = `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newShift: Shift = {
            id: shiftId,
            userId: user.id,
            userName: user.name,
            companyId: company.id,
            startTime: Date.now(),
            endTime: null,
            startMethod: method,
            hourlyRate: user.customHourlyRate || company.settings.defaultHourlyRate || 15,
            ...rotaData 
        };

        Object.keys(newShift).forEach(key => {
            if ((newShift as any)[key] === undefined) {
                delete (newShift as any)[key];
            }
        });

        await setDoc(doc(db, SHIFTS_REF, shiftId), newShift);
        await updateUserProfile(user.id, { activeShiftId: shiftId });
        return { success: true, message: 'Clocked In Successfully.', shift: newShift };
    }
};
