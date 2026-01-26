
import { Shift } from '../types';

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
}

const escapeCSV = (str: any) => {
    const cellStr = String(str ?? '');
    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
};

// Helper to format date as DD.MM.YY for compact rate history
const formatDateShort = (d: Date) => {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.');
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
    includeDeductions = false,
    holidayPayEnabled = false,
    holidayPayRate = 0,
    companyName = 'Tallyd Report',
    brandColor = '#0ea5e9'
  } = options;

  // --- HTML/EXCEL MATRIX VIEW (Rich Formatting) ---
  if (matrixView) {
      
      // 1. Determine Date Range
      const timestamps = shifts.map(s => s.startTime);
      const minDate = new Date(Math.min(...timestamps));
      const maxDate = new Date(Math.max(...timestamps));
      minDate.setHours(0,0,0,0);
      maxDate.setHours(0,0,0,0);
      
      const dates: Date[] = [];
      const cursor = new Date(minDate);
      while(cursor <= maxDate) {
          dates.push(new Date(cursor));
          cursor.setDate(cursor.getDate() + 1);
      }

      const daysCount = dates.length;
      
      // Determine columns per day
      // If showing times: IN, OUT, HRS (3 cols)
      // If not showing times: HRS (1 col)
      const colsPerDay = showTimesInMatrix ? 3 : 1;
      
      // 2. Data Grouping
      const staffMap: Record<string, { name: string, shifts: Shift[] }> = {};
      shifts.forEach(s => {
          if(!staffMap[s.userId]) staffMap[s.userId] = { name: s.userName, shifts: [] };
          staffMap[s.userId].shifts.push(s);
      });

      // 3. Construct HTML Table
      let tableRows = '';

      // Define Summary Column Count
      // Default: Total Hrs, Rate, Gross (3 cols)
      // Holiday Enabled: Total Hrs, Rate, Base, Holiday, Total (5 cols)
      const summaryColCount = holidayPayEnabled ? 5 : 3;

      // --- HEADER ROW 1: Title ---
      // Colspan = Name (1) + Days (totalDayCols) + Summary (summaryColCount) + Deductions (4 optional)
      const totalDayCols = daysCount * colsPerDay;
      const totalWidth = 1 + totalDayCols + summaryColCount + (includeDeductions ? 4 : 0);
      
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

      // --- HEADER ROW 3: Sub-columns (In/Out or Hours) ---
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

      // 4. Data Rows
      Object.values(staffMap).forEach((staff, index) => {
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
                              ins.push(new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
                              outs.push(new Date(s.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
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

          // Calculate Rate String using new logic
          const rateDisplay = formatRateHistory(staff.shifts);

          // Calculate Finals
          let finalHolidayPay = 0;
          let finalTotalPay = totalBasePay;

          if (holidayPayEnabled) {
              finalHolidayPay = totalBasePay * (holidayPayRate / 100);
              finalTotalPay = totalBasePay + finalHolidayPay;
          }

          tableRows += `
            <tr style="background-color:${rowBg};">
                <td style="border:1px solid #ddd; font-weight:bold; padding:5px; vertical-align:middle;">${staff.name}</td>
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

      const rateString = formatRateHistory(userShifts);

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
    csvRows.push(['REPORT SUMMARY']);
    csvRows.push(['Company', companyName]);
    csvRows.push(['Period', dateRangeLabel]);
    csvRows.push(['Generated', new Date().toLocaleString()]);
    csvRows.push([]);

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
