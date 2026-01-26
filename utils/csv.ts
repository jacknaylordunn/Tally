
import { Shift, Company } from '../types';

interface ExportOptions {
  filename: string;
  currency?: string;
  dateRangeLabel?: string;
  groupByStaff?: boolean;
  matrixView?: boolean;
  showTimesInMatrix?: boolean;
  holidayPayEnabled?: boolean;
  holidayPayRate?: number;
}

const escapeCSV = (str: any) => {
    const cellStr = String(str ?? '');
    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
};

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
    matrixView = false,
    showTimesInMatrix = false,
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
  csvRows.push([]); // Empty row

  // 2. Data Processing
  
  if (matrixView) {
      // --- TIMESHEET MATRIX VIEW ---
      
      // Determine Date Range from shifts if not explicit
      // We iterate to find min/max
      const timestamps = shifts.map(s => s.startTime);
      const minDate = new Date(Math.min(...timestamps));
      const maxDate = new Date(Math.max(...timestamps));
      // Normalize
      minDate.setHours(0,0,0,0);
      maxDate.setHours(0,0,0,0);
      
      // Generate Dates Array
      const dates: Date[] = [];
      const cursor = new Date(minDate);
      while(cursor <= maxDate) {
          dates.push(new Date(cursor));
          cursor.setDate(cursor.getDate() + 1);
      }

      // Group by Staff
      const staffMap: Record<string, { name: string, shifts: Shift[] }> = {};
      shifts.forEach(s => {
          if(!staffMap[s.userId]) staffMap[s.userId] = { name: s.userName, shifts: [] };
          staffMap[s.userId].shifts.push(s);
      });

      // Headers
      const dateHeaders = dates.map(d => d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }));
      const headers = ['Staff Name', ...dateHeaders, 'Total Hours', `Hourly Rate (${currency})`, `Gross Pay (${currency})`];
      csvRows.push(headers);

      // Rows
      Object.values(staffMap).forEach(staff => {
          const rowData = [staff.name];
          let totalHours = 0;
          let totalPay = 0;
          let rate = 0;

          // Cells for each date
          dates.forEach(date => {
              // Find shifts on this date
              const daysShifts = staff.shifts.filter(s => {
                  const sDate = new Date(s.startTime);
                  return sDate.getDate() === date.getDate() && sDate.getMonth() === date.getMonth();
              });

              if (daysShifts.length > 0) {
                  let cellContent = '';
                  let dayHours = 0;
                  
                  // Use rate from last shift found (assuming consistent)
                  rate = daysShifts[0].hourlyRate || 0;

                  daysShifts.forEach(s => {
                      if (s.endTime) {
                          const h = (s.endTime - s.startTime) / 3600000;
                          dayHours += h;
                          totalHours += h;
                          totalPay += (h * (s.hourlyRate || 0));
                          
                          if (showTimesInMatrix) {
                              const timeStr = `${new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}-${new Date(s.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
                              cellContent += (cellContent ? '\n' : '') + timeStr;
                          }
                      }
                  });

                  if (showTimesInMatrix) {
                      rowData.push(cellContent);
                  } else {
                      rowData.push(dayHours.toFixed(2));
                  }
              } else {
                  rowData.push('');
              }
          });

          // Summary Columns
          rowData.push(totalHours.toFixed(2));
          rowData.push(rate.toFixed(2));
          
          if (holidayPayEnabled) {
              totalPay += (totalPay * (holidayPayRate / 100));
          }
          rowData.push(totalPay.toFixed(2));

          csvRows.push(rowData);
      });

  } else if (groupByStaff) {
    // --- GROUPED SUMMARY VIEW ---
    
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

    const headers = [
      'Staff Member',
      'Total Shifts',
      'Total Hours',
      `Hourly Rate (${currency})`,
      `Base Pay (${currency})`,
      holidayPayEnabled ? `Holiday Pay (${holidayPayRate}%)` : null,
      `Grand Total (${currency})`
    ].filter(Boolean);

    csvRows.push(headers);

    Object.keys(statsByUser).forEach(userId => {
      const stats = statsByUser[userId];
      const userShifts = shiftsByUser[userId];

      // Rate History Logic
      let rateString = "0.00";
      if (userShifts.length > 0) {
          const sorted = [...userShifts].sort((a, b) => a.startTime - b.startTime);
          const segments: { rate: number, start: number, end: number }[] = [];
          let current = { rate: sorted[0].hourlyRate, start: sorted[0].startTime, end: sorted[0].startTime };

          for (let i = 1; i < sorted.length; i++) {
              const s = sorted[i];
              if (Math.abs(s.hourlyRate - current.rate) < 0.01) {
                  current.end = s.startTime;
              } else {
                  segments.push(current);
                  current = { rate: s.hourlyRate, start: s.startTime, end: s.startTime };
              }
          }
          segments.push(current);

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
        rateString,
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
      `Hourly Rate (${currency})`,
      `Base Pay (${currency})`,
      holidayPayEnabled ? `Holiday Pay (${holidayPayRate}%)` : null,
      `Total Pay (${currency})`,
      'Method'
    ].filter(Boolean);

    csvRows.push(headers);

    shifts.forEach(shift => {
      if (!shift.endTime) return; 

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
        rate.toFixed(2),
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
    .map(row => row.map(escapeCSV).join(','))
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
