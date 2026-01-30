
import { Shift, User } from '../types';

interface ExportOptions {
  filename: string;
  currency?: string;
  dateRangeLabel?: string;
  groupByStaff?: boolean;
  matrixView?: boolean;
  showTimesInMatrix?: boolean;
  includeDeductions?: boolean;
  holidayPayEnabled?: boolean;
  holidayPayRate?: number;
  companyName?: string;
  brandColor?: string;
  timeFormat?: '12h' | '24h_dot';
  includeInactiveStaff?: boolean; // New
  includeEmployeeId?: boolean; // New
}

const escapeCSV = (str: any) => {
    const cellStr = String(str ?? '');
    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
};

// Sort helper: Last Name A-Z
const sortByLastName = (aName: string, bName: string) => {
    const lastA = aName.trim().split(' ').pop()?.toLowerCase() || '';
    const lastB = bName.trim().split(' ').pop()?.toLowerCase() || '';
    if (lastA < lastB) return -1;
    if (lastA > lastB) return 1;
    return 0;
};

// Helper to format date as DD.MM.YY for compact rate history
const formatDateShort = (d: Date) => {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.');
};

const formatTime = (date: Date, format: '12h' | '24h_dot' = '12h') => {
    if (format === '24h_dot') {
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        return `${h}.${m}`;
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
};

// Logic to generate strings like "12.00 (until 12.01.26) -> 12.65 (from 12.01.26)"
const formatRateHistory = (shifts: Shift[]): string => {
    if (shifts.length === 0) return "0.00";
    
    const sorted = [...shifts].sort((a, b) => a.startTime - b.startTime);
    
    const segments: { rate: number, startDate: Date, endDate: Date }[] = [];
    let currentSegment = { 
        rate: sorted[0].hourlyRate || 0, 
        startDate: new Date(sorted[0].startTime),
        endDate: new Date(sorted[0].startTime)
    };
    
    for (let i = 1; i < sorted.length; i++) {
        const s = sorted[i];
        const rate = s.hourlyRate || 0;
        // Check if rate changed significantly
        if (Math.abs(rate - currentSegment.rate) < 0.01) {
            currentSegment.endDate = new Date(s.startTime);
        } else {
            segments.push(currentSegment);
            currentSegment = {
                rate: rate,
                startDate: new Date(s.startTime),
                endDate: new Date(s.startTime)
            };
        }
    }
    segments.push(currentSegment);
    
    if (segments.length === 1) {
        return segments[0].rate.toFixed(2);
    }
    
    return segments.map((seg, index) => {
        const rateStr = seg.rate.toFixed(2);
        if (index === 0) {
            return `${rateStr} (until ${formatDateShort(seg.endDate)})`;
        } else {
            return `${rateStr} (from ${formatDateShort(seg.startDate)})`;
        }
    }).join(' -> ');
};

export const downloadPayrollReport = (
  shifts: Shift[], 
  allStaff: User[], // Passed in to handle 'include inactive'
  options: ExportOptions
) => {
  // We allow 0 shifts IF includeInactiveStaff is true, otherwise guard
  if (!shifts.length && !options.includeInactiveStaff) return;

  const { 
    filename, 
    currency = '£', 
    dateRangeLabel = 'All Time', 
    groupByStaff = false,
    matrixView = false,
    showTimesInMatrix = false,
    includeDeductions = false,
    holidayPayEnabled = false,
    holidayPayRate = 0,
    companyName = 'Tallyd Report',
    brandColor = '#0ea5e9',
    timeFormat = '12h',
    includeInactiveStaff = false,
    includeEmployeeId = false
  } = options;

  // --- DATA PREPARATION: MERGE SHIFTS WITH STAFF ---
  const staffMap: Record<string, { name: string, employeeId?: string, shifts: Shift[] }> = {};
  
  // 1. Initialize with all staff if option enabled
  if (includeInactiveStaff) {
      allStaff.forEach(u => {
          staffMap[u.id] = { 
              name: u.name, 
              employeeId: u.employeeNumber, 
              shifts: [] 
          };
      });
  }

  // 2. Populate shifts (add staff if missing/deleted but has shift history)
  shifts.forEach(s => {
      if(!staffMap[s.userId]) {
          // Try find user in allStaff to get Employee ID, even if not pre-initialized
          const u = allStaff.find(u => u.id === s.userId);
          staffMap[s.userId] = { 
              name: s.userName, 
              employeeId: u?.employeeNumber, 
              shifts: [] 
          };
      }
      staffMap[s.userId].shifts.push(s);
  });

  // 3. Sort
  const sortedStaff = Object.values(staffMap).sort((a, b) => sortByLastName(a.name, b.name));

  // --- HTML/EXCEL MATRIX VIEW (Rich Formatting) ---
  if (matrixView) {
      
      // Determine Date Range from actual shifts OR current date context (approximation)
      const timestamps = shifts.map(s => s.startTime);
      const minDate = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date();
      const maxDate = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date();
      
      // Safety: If range is huge or empty, clamp/default
      if (timestamps.length === 0) {
          minDate.setHours(0,0,0,0);
          maxDate.setHours(0,0,0,0); // Just today column
      } else {
          minDate.setHours(0,0,0,0);
          maxDate.setHours(0,0,0,0);
      }
      
      const dates: Date[] = [];
      const cursor = new Date(minDate);
      while(cursor <= maxDate) {
          dates.push(new Date(cursor));
          cursor.setDate(cursor.getDate() + 1);
      }

      const daysCount = dates.length;
      const colsPerDay = showTimesInMatrix ? 3 : 1;
      
      // 3. Construct HTML Table
      let tableRows = '';

      // Define Summary Column Count
      const summaryColCount = holidayPayEnabled ? 5 : 3;

      // --- HEADER ROW 1: Title ---
      const empIdColWidth = includeEmployeeId ? 1 : 0;
      const totalDayCols = daysCount * colsPerDay;
      const totalWidth = 1 + empIdColWidth + totalDayCols + summaryColCount + (includeDeductions ? 4 : 0);
      
      tableRows += `
        <tr>
            <td colspan="${totalWidth}" style="background-color:${brandColor}; color:white; font-size:18px; font-weight:bold; padding:10px; border:1px solid #000; text-align:center;">
                ${companyName.toUpperCase()} - PAYROLL MATRIX
            </td>
        </tr>
        <tr>
            <td colspan="${totalWidth}" style="font-style:italic; padding:5px; border:1px solid #ccc; background-color:#f9f9f9; text-align:center;">
                Period: ${dateRangeLabel} | Generated: ${new Date().toLocaleString()}
            </td>
        </tr>
        <tr></tr>
      `;

      // --- HEADER ROW 2: High Level Grouping ---
      tableRows += `
        <tr style="font-weight:bold; background-color:#e5e7eb;">
            <td rowspan="2" style="border:1px solid #000; width:150px; background-color:#d1d5db; vertical-align:middle; text-align:center;">STAFF NAME</td>
            ${includeEmployeeId ? `<td rowspan="2" style="border:1px solid #000; width:80px; background-color:#d1d5db; vertical-align:middle; text-align:center;">ID</td>` : ''}
            ${dates.map(d => {
                const dayName = d.toLocaleDateString(undefined, {weekday:'short', day:'numeric'}).toUpperCase();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const bg = isWeekend ? '#fee2e2' : '#f3f4f6';
                return `<td colspan="${colsPerDay}" style="border:1px solid #000; text-align:center; background-color:${bg};">${dayName}</td>`;
            }).join('')}
            <td colspan="${summaryColCount}" style="border:1px solid #000; text-align:center; background-color:#9ca3af; color:white;">SUMMARY</td>
            ${includeDeductions ? `<td colspan="4" style="border:1px solid #000; text-align:center; background-color:#fca5a5;">OFFICE USE</td>` : ''}
        </tr>
      `;

      // --- HEADER ROW 3: Sub-columns ---
      tableRows += `<tr style="font-weight:bold; font-size:10px; text-align:center;">`;
      dates.forEach(d => {
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const bg = isWeekend ? '#fff1f2' : '#ffffff';
          if (showTimesInMatrix) {
              tableRows += `<td style="border:1px solid #ccc; width:60px; background-color:${bg};">IN</td>`;
              tableRows += `<td style="border:1px solid #ccc; width:60px; background-color:${bg};">OUT</td>`;
              tableRows += `<td style="border:1px solid #ccc; width:50px; background-color:${bg}; font-weight:bold;">HRS</td>`;
          } else {
              tableRows += `<td style="border:1px solid #ccc; background-color:${bg};">HRS</td>`;
          }
      });

      // Summary Headers
      tableRows += `<td style="border:1px solid #000; background-color:#e5e7eb;">TOTAL HRS</td>`;
      tableRows += `<td style="border:1px solid #000; background-color:#e5e7eb;">RATE (${currency})</td>`;
      
      if (holidayPayEnabled) {
          tableRows += `<td style="border:1px solid #000; background-color:#e5e7eb;">BASE (${currency})</td>`;
          tableRows += `<td style="border:1px solid #000; background-color:#e0e7ff;">HOLIDAY (${holidayPayRate}%)</td>`;
          tableRows += `<td style="border:1px solid #000; background-color:#e5e7eb;">TOTAL (${currency})</td>`;
      } else {
          tableRows += `<td style="border:1px solid #000; background-color:#e5e7eb;">GROSS (${currency})</td>`;
      }
      
      if (includeDeductions) {
          tableRows += `<td style="border:1px solid #000; background-color:#fff1f2;">TAX</td>`;
          tableRows += `<td style="border:1px solid #000; background-color:#fff1f2;">NI</td>`;
          tableRows += `<td style="border:1px solid #000; background-color:#fff1f2;">OTHER</td>`;
          tableRows += `<td style="border:1px solid #000; background-color:#ecfdf5;">NET</td>`;
      }
      tableRows += `</tr>`;

      // 4. Data Rows & Totals Calculation
      let grandTotalHours = 0;
      let grandTotalBase = 0;
      let grandTotalHoliday = 0;
      let grandTotalPay = 0;

      sortedStaff.forEach((staff, index) => {
          let totalHours = 0;
          let totalBasePay = 0;
          let dayCells = '';
          const rowBg = index % 2 === 0 ? '#ffffff' : '#fafafa';

          dates.forEach(date => {
              const daysShifts = staff.shifts.filter(s => {
                  const sDate = new Date(s.startTime);
                  return sDate.getDate() === date.getDate() && sDate.getMonth() === date.getMonth();
              }).sort((a,b) => a.startTime - b.startTime);

              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const cellBg = isWeekend ? '#fff1f2' : rowBg;

              if (daysShifts.length > 0) {
                  let dayHours = 0;
                  let ins: string[] = [];
                  let outs: string[] = [];

                  daysShifts.forEach(s => {
                      if (s.endTime) {
                          const h = (s.endTime - s.startTime) / 3600000;
                          dayHours += h;
                          totalHours += h;
                          totalBasePay += (h * (s.hourlyRate || 0));
                          
                          if (showTimesInMatrix) {
                              ins.push(formatTime(new Date(s.startTime), timeFormat));
                              outs.push(formatTime(new Date(s.endTime), timeFormat));
                          }
                      }
                  });

                  if (showTimesInMatrix) {
                      const inStr = ins.join('\n');
                      const outStr = outs.join('\n');
                      dayCells += `<td style="border:1px solid #ddd; text-align:center; white-space:pre-wrap; font-size:11px; background-color:${cellBg}; vertical-align:middle;">${inStr}</td>`;
                      dayCells += `<td style="border:1px solid #ddd; text-align:center; white-space:pre-wrap; font-size:11px; background-color:${cellBg}; vertical-align:middle;">${outStr}</td>`;
                      dayCells += `<td style="border:1px solid #ddd; text-align:center; font-weight:bold; font-size:11px; background-color:${cellBg}; vertical-align:middle;">${dayHours > 0 ? dayHours.toFixed(2) : ''}</td>`;
                  } else {
                      dayCells += `<td style="border:1px solid #ddd; text-align:center; background-color:${cellBg}; font-weight:bold; vertical-align:middle;">${dayHours.toFixed(2)}</td>`;
                  }

              } else {
                  // Empty Day
                  if (showTimesInMatrix) {
                      dayCells += `<td style="border:1px solid #ddd; background-color:${cellBg};"></td>`;
                      dayCells += `<td style="border:1px solid #ddd; background-color:${cellBg};"></td>`;
                      dayCells += `<td style="border:1px solid #ddd; background-color:${cellBg};"></td>`;
                  } else {
                      dayCells += `<td style="border:1px solid #ddd; background-color:${cellBg};"></td>`;
                  }
              }
          });

          const rateDisplay = formatRateHistory(staff.shifts);

          let finalHolidayPay = 0;
          let finalTotalPay = totalBasePay;

          if (holidayPayEnabled) {
              finalHolidayPay = totalBasePay * (holidayPayRate / 100);
              finalTotalPay = totalBasePay + finalHolidayPay;
          }

          // Accumulate Grand Totals
          grandTotalHours += totalHours;
          grandTotalBase += totalBasePay;
          grandTotalHoliday += finalHolidayPay;
          grandTotalPay += finalTotalPay;

          tableRows += `
            <tr style="background-color:${rowBg};">
                <td style="border:1px solid #ddd; font-weight:bold; padding:5px; vertical-align:middle;">${staff.name}</td>
                ${includeEmployeeId ? `<td style="border:1px solid #ddd; text-align:center; font-family:monospace; font-size:11px; vertical-align:middle;">${staff.employeeId || ''}</td>` : ''}
                ${dayCells}
                <td style="border:1px solid #ddd; background-color:#f3f4f6; font-weight:bold; text-align:center; vertical-align:middle;">${totalHours.toFixed(2)}</td>
                <td style="border:1px solid #ddd; background-color:#f3f4f6; text-align:center; vertical-align:middle; white-space:pre-wrap; font-size:11px;">${rateDisplay}</td>
                
                ${holidayPayEnabled ? `
                    <td style="border:1px solid #ddd; background-color:#f3f4f6; text-align:right; padding-right:5px; vertical-align:middle;">${totalBasePay.toFixed(2)}</td>
                    <td style="border:1px solid #ddd; background-color:#e0e7ff; text-align:right; padding-right:5px; vertical-align:middle; font-weight:bold;">${finalHolidayPay.toFixed(2)}</td>
                    <td style="border:1px solid #ddd; background-color:#f3f4f6; text-align:right; padding-right:5px; vertical-align:middle; font-weight:bold;">${finalTotalPay.toFixed(2)}</td>
                ` : `
                    <td style="border:1px solid #ddd; background-color:#f3f4f6; font-weight:bold; text-align:right; padding-right:5px; vertical-align:middle;">${totalBasePay.toFixed(2)}</td>
                `}

                ${includeDeductions ? `
                    <td style="border:1px solid #ddd;"></td>
                    <td style="border:1px solid #ddd;"></td>
                    <td style="border:1px solid #ddd;"></td>
                    <td style="border:1px solid #ddd; font-weight:bold; background-color:#ecfdf5;"></td>
                ` : ''}
            </tr>
          `;
      });

      // --- FOOTER ROW: GRAND TOTALS ---
      const idOffset = includeEmployeeId ? 1 : 0;
      tableRows += `
        <tr style="background-color:#1e293b; color:white; font-weight:bold;">
            <td style="border:1px solid #000; padding:8px;" colspan="${1 + idOffset}">TOTALS / BUDGET</td>
            ${/* Empty cells for days */ ''}
            <td colspan="${totalDayCols}" style="border:1px solid #000; background-color:#334155;"></td>
            
            <td style="border:1px solid #000; text-align:center;">${grandTotalHours.toFixed(2)}</td>
            <td style="border:1px solid #000; text-align:center;">-</td>
            
            ${holidayPayEnabled ? `
                <td style="border:1px solid #000; text-align:right; padding-right:5px;">${grandTotalBase.toFixed(2)}</td>
                <td style="border:1px solid #000; text-align:right; padding-right:5px;">${grandTotalHoliday.toFixed(2)}</td>
                <td style="border:1px solid #000; text-align:right; padding-right:5px; background-color:#0f172a;">${currency}${grandTotalPay.toFixed(2)}</td>
            ` : `
                <td style="border:1px solid #000; text-align:right; padding-right:5px; background-color:#0f172a;">${currency}${grandTotalPay.toFixed(2)}</td>
            `}

            ${includeDeductions ? `<td colspan="4" style="border:1px solid #000; background-color:#334155;"></td>` : ''}
        </tr>
      `;

      // Assemble full HTML
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Payroll Matrix</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        </head>
        <body style="font-family: Arial, sans-serif;">
            <table border="1" cellspacing="0" cellpadding="5">
                ${tableRows}
            </table>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_matrix.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return;
  } 
  
  // --- CSV FALLBACKS (Standard Views) ---
  
  let csvRows = [];

  if (groupByStaff) {
    // --- GROUPED SUMMARY VIEW ---
    csvRows.push(['REPORT SUMMARY']);
    csvRows.push(['Company', companyName]);
    csvRows.push(['Period', dateRangeLabel]);
    csvRows.push(['Generated', new Date().toLocaleString()]);
    csvRows.push([]);

    const headers = [
      includeEmployeeId ? 'Employee ID' : null,
      'Staff Member',
      'Total Shifts',
      'Total Hours',
      `Hourly Rate (${currency})`,
      `Base Pay (${currency})`,
      holidayPayEnabled ? `Holiday Pay (${holidayPayRate}%)` : null,
      `Grand Total (${currency})`
    ].filter(Boolean);

    csvRows.push(headers);

    sortedStaff.forEach(staff => {
        let totalHours = 0;
        let totalBasePay = 0;
        let totalHolidayPay = 0;
        let shiftCount = 0;

        staff.shifts.forEach(shift => {
            if (shift.endTime) {
                const hours = (shift.endTime - shift.startTime) / 3600000;
                const rate = shift.hourlyRate || 0;
                const pay = hours * rate;
                
                totalHours += hours;
                totalBasePay += pay;
                shiftCount++;
            }
        });

        if (holidayPayEnabled) {
            totalHolidayPay = totalBasePay * (holidayPayRate / 100);
        }
        const grandTotal = totalBasePay + totalHolidayPay;

        // Skip rows with 0 shifts ONLY if includeInactiveStaff is false
        if (!includeInactiveStaff && shiftCount === 0) return;

        const rateString = formatRateHistory(staff.shifts);

        const row = [
            includeEmployeeId ? (staff.employeeId || '') : null,
            staff.name,
            shiftCount,
            totalHours.toFixed(2),
            rateString,
            totalBasePay.toFixed(2),
            holidayPayEnabled ? totalHolidayPay.toFixed(2) : null,
            grandTotal.toFixed(2)
        ].filter(item => item !== null);
        
        csvRows.push(row);
    });

  } else {
    // --- DETAILED VIEW ---
    csvRows.push(['REPORT SUMMARY']);
    csvRows.push(['Company', companyName]);
    csvRows.push(['Period', dateRangeLabel]);
    csvRows.push(['Generated', new Date().toLocaleString()]);
    csvRows.push([]);

    const headers = [
      includeEmployeeId ? 'Employee ID' : null,
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

    // Sort Shifts by Last Name then Start Time
    const sortedShifts = [...shifts].sort((a, b) => {
        const nameCompare = sortByLastName(a.userName, b.userName);
        if (nameCompare !== 0) return nameCompare;
        return b.startTime - a.startTime;
    });

    sortedShifts.forEach(shift => {
      if (!shift.endTime) return; 

      const startTime = new Date(shift.startTime);
      const endTime = new Date(shift.endTime);
      
      const hours = (shift.endTime - shift.startTime) / 3600000;
      const rate = shift.hourlyRate || 0;
      const basePay = hours * rate;
      const holidayPay = holidayPayEnabled ? (basePay * (holidayPayRate / 100)) : 0;
      const totalPay = basePay + holidayPay;

      // Find employee ID for this specific shift user
      let empId = '';
      if (includeEmployeeId) {
          const u = allStaff.find(u => u.id === shift.userId);
          empId = u?.employeeNumber || '';
      }

      const row = [
        includeEmployeeId ? empId : null,
        shift.userName,
        startTime.toLocaleDateString(),
        formatTime(startTime, timeFormat),
        formatTime(endTime, timeFormat),
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
