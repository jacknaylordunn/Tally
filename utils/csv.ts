
import { Shift, Company } from '../types';

interface ExportOptions {
  filename: string;
  currency?: string;
  dateRangeLabel?: string;
  groupByStaff?: boolean;
  holidayPayEnabled?: boolean;
  holidayPayRate?: number;
}

export const downloadShiftsCSV = (
  shifts: Shift[], 
  options: ExportOptions
) => {
  if (!shifts.length) return;

  const { 
    filename, 
    currency = '£', 
    dateRangeLabel = 'All Time', 
    groupByStaff = false,
    holidayPayEnabled = false,
    holidayPayRate = 0
  } = options;

  let csvRows = [];

  // 1. Report Header Summary
  const generatedDate = new Date().toLocaleString();
  csvRows.push(['REPORT SUMMARY']);
  csvRows.push(['Generated On', generatedDate]);
  csvRows.push(['Report Range', dateRangeLabel]);
  csvRows.push(['Total Records', shifts.length.toString()]);
  csvRows.push([]); // Empty row for spacing

  // 2. Data Processing
  if (groupByStaff) {
    // --- GROUPED VIEW ---
    
    // First, organize shifts by user to calculate stats and analyze rate history
    const shiftsByUser: Record<string, Shift[]> = {};
    const statsByUser: Record<string, any> = {};

    shifts.forEach(shift => {
        if (!shiftsByUser[shift.userId]) {
            shiftsByUser[shift.userId] = [];
            statsByUser[shift.userId] = {
                name: shift.userName,
                totalHours: 0,
                totalBasePay: 0,
                totalHolidayPay: 0,
                grandTotal: 0,
                shiftCount: 0
            };
        }
        shiftsByUser[shift.userId].push(shift);

        if (shift.endTime) {
            const hours = (shift.endTime - shift.startTime) / 3600000;
            const rate = shift.hourlyRate || 0;
            const pay = hours * rate;
            const holiday = holidayPayEnabled ? (pay * (holidayPayRate / 100)) : 0;

            statsByUser[shift.userId].totalHours += hours;
            statsByUser[shift.userId].totalBasePay += pay;
            statsByUser[shift.userId].totalHolidayPay += holiday;
            statsByUser[shift.userId].grandTotal += (pay + holiday);
            statsByUser[shift.userId].shiftCount += 1;
        }
    });

    // Headers
    const headers = [
      'Staff Member',
      'Total Shifts',
      'Total Hours',
      `Hourly Rate (${currency})`, // Shows rate history
      `Base Pay (${currency})`,
      holidayPayEnabled ? `Holiday Pay (${holidayPayRate}%)` : null,
      `Grand Total (${currency})`
    ].filter(Boolean);

    csvRows.push(headers);

    // Generate Rows
    Object.keys(statsByUser).forEach(userId => {
      const stats = statsByUser[userId];
      const userShifts = shiftsByUser[userId];

      // Logic to generate the "Rate History" string
      let rateString = "0.00";
      
      if (userShifts.length > 0) {
          // Sort chronologically
          const sorted = [...userShifts].sort((a, b) => a.startTime - b.startTime);
          
          // Identify segments where rate stays the same
          // Each segment stores the rate, start date of first shift, and start date of last shift in sequence
          const segments: { rate: number, start: number, end: number }[] = [];
          
          let current = { 
              rate: sorted[0].hourlyRate, 
              start: sorted[0].startTime, 
              end: sorted[0].startTime 
          };

          for (let i = 1; i < sorted.length; i++) {
              const s = sorted[i];
              // Check if rate changed (tolerance for float comparisons)
              if (Math.abs(s.hourlyRate - current.rate) < 0.01) {
                  current.end = s.startTime; // Extend end date
              } else {
                  segments.push(current);
                  current = { rate: s.hourlyRate, start: s.startTime, end: s.startTime };
              }
          }
          segments.push(current);

          // Format the string based on segments
          if (segments.length === 1) {
              rateString = segments[0].rate.toFixed(2);
          } else {
              rateString = segments.map((seg, idx) => {
                  const r = seg.rate.toFixed(2);
                  const dStart = new Date(seg.start).toLocaleDateString();
                  const dEnd = new Date(seg.end).toLocaleDateString();
                  
                  if (idx === 0) return `${r} (until ${dEnd})`;
                  if (idx === segments.length - 1) return ` -> ${r} (from ${dStart})`;
                  return ` -> ${r} (from ${dStart} to ${dEnd})`;
              }).join('');
          }
      }

      const row = [
        stats.name,
        stats.shiftCount,
        stats.totalHours.toFixed(2),
        rateString, // The new formatted rate string
        stats.totalBasePay.toFixed(2),
        holidayPayEnabled ? stats.totalHolidayPay.toFixed(2) : null,
        stats.grandTotal.toFixed(2)
      ].filter(item => item !== null);
      
      csvRows.push(row);
    });

  } else {
    // --- DETAILED VIEW ---
    const headers = [
      'Staff Name',
      'Date',
      'Start Time',
      'End Time',
      'Hours Worked',
      `Hourly Rate (${currency})`, // Explicit Rate Column
      `Base Pay (${currency})`,
      holidayPayEnabled ? `Holiday Pay (${holidayPayRate}%)` : null,
      `Total Pay (${currency})`,
      'Method'
    ].filter(Boolean);

    csvRows.push(headers);

    shifts.forEach(shift => {
      if (!shift.endTime) return; // Skip active shifts for safety in exports

      const startTime = new Date(shift.startTime);
      const endTime = new Date(shift.endTime);
      
      const hours = (shift.endTime - shift.startTime) / 3600000;
      const rate = shift.hourlyRate || 0;
      const basePay = hours * rate;
      const holidayPay = holidayPayEnabled ? (basePay * (holidayPayRate / 100)) : 0;
      const totalPay = basePay + holidayPay;

      const row = [
        shift.userName,
        startTime.toLocaleDateString(),
        startTime.toLocaleTimeString(),
        endTime.toLocaleTimeString(),
        hours.toFixed(2),
        rate.toFixed(2), // Include Rate
        basePay.toFixed(2),
        holidayPayEnabled ? holidayPay.toFixed(2) : null,
        totalPay.toFixed(2),
        shift.startMethod.replace('_', ' ').toUpperCase()
      ].filter(item => item !== null);

      csvRows.push(row);
    });
  }

  // 3. Convert to CSV String
  const csvContent = csvRows
    .map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if necessary
      const cellStr = String(cell ?? '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
    .join('\n');

  // 4. Download Trigger
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
