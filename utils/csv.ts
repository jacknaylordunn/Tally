
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

      // 2. Data Grouping
      const staffMap: Record<string, { name: string, shifts: Shift[] }> = {};
      shifts.forEach(s => {
          if(!staffMap[s.userId]) staffMap[s.userId] = { name: s.userName, shifts: [] };
          staffMap[s.userId].shifts.push(s);
      });

      // 3. Construct HTML Table
      let tableRows = '';

      // Header Row 1: Title
      tableRows += `
        <tr>
            <td colspan="${daysCount + (includeDeductions ? 8 : 4)}" style="background-color:${brandColor}; color:white; font-size:18px; font-weight:bold; padding:10px; border:1px solid #000;">
                ${companyName.toUpperCase()} - PAYROLL MATRIX
            </td>
        </tr>
        <tr>
            <td colspan="${daysCount + (includeDeductions ? 8 : 4)}" style="font-style:italic; padding:5px; border:1px solid #ccc; background-color:#f9f9f9;">
                Period: ${dateRangeLabel} | Generated: ${new Date().toLocaleString()}
            </td>
        </tr>
        <tr></tr>
      `;

      // Header Row 2: Categories
      tableRows += `
        <tr style="font-weight:bold; background-color:#f3f4f6;">
            <td style="border:1px solid #000; width:150px; background-color:#e5e7eb;">STAFF MEMBER</td>
            <td colspan="${daysCount}" style="border:1px solid #000; text-align:center; background-color:#d1d5db;">HOURS WORKED</td>
            <td colspan="3" style="border:1px solid #000; text-align:center; background-color:#9ca3af; color:white;">SUMMARY</td>
            ${includeDeductions ? `<td colspan="4" style="border:1px solid #000; text-align:center; background-color:#fca5a5;">OFFICE USE (DEDUCTIONS)</td>` : ''}
        </tr>
      `;

      // Header Row 3: Columns
      tableRows += `<tr style="font-weight:bold; font-size:11px;">`;
      tableRows += `<td style="border:1px solid #ccc; background-color:#f3f4f6;">Name</td>`;
      dates.forEach(d => {
          const dayStr = d.toLocaleDateString(undefined, {weekday:'short', day:'numeric'}).toUpperCase();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          tableRows += `<td style="border:1px solid #ccc; width:60px; text-align:center; ${isWeekend ? 'background-color:#fee2e2;' : 'background-color:#ffffff;'}">${dayStr}</td>`;
      });
      
      // Summary Headers
      tableRows += `<td style="border:1px solid #ccc; background-color:#e5e7eb; font-weight:bold;">TOTAL HRS</td>`;
      tableRows += `<td style="border:1px solid #ccc; background-color:#e5e7eb; font-weight:bold;">RATE</td>`;
      tableRows += `<td style="border:1px solid #ccc; background-color:#e5e7eb; font-weight:bold;">GROSS</td>`;

      if (includeDeductions) {
          tableRows += `<td style="border:1px solid #ccc; background-color:#fff1f2;">TAX</td>`;
          tableRows += `<td style="border:1px solid #ccc; background-color:#fff1f2;">NI / SS</td>`;
          tableRows += `<td style="border:1px solid #ccc; background-color:#fff1f2;">OTHER</td>`;
          tableRows += `<td style="border:1px solid #ccc; font-weight:bold; background-color:#ecfdf5;">NET PAY</td>`;
      }
      tableRows += `</tr>`;

      // 4. Data Rows
      Object.values(staffMap).forEach((staff, index) => {
          let totalHours = 0;
          let totalPay = 0;
          let rate = 0;
          let dayCells = '';
          const rowBg = index % 2 === 0 ? '#ffffff' : '#fafafa';

          dates.forEach(date => {
              const daysShifts = staff.shifts.filter(s => {
                  const sDate = new Date(s.startTime);
                  return sDate.getDate() === date.getDate() && sDate.getMonth() === date.getMonth();
              });

              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const cellBg = isWeekend ? '#fff1f2' : rowBg;

              if (daysShifts.length > 0) {
                  let cellContent = '';
                  let dayHours = 0;
                  // Use rate from last shift found
                  rate = daysShifts[0].hourlyRate || rate || 0;

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
                  const val = showTimesInMatrix ? cellContent : dayHours.toFixed(2);
                  dayCells += `<td style="border:1px solid #ddd; text-align:center; white-space:pre-wrap; background-color:${cellBg};">${val}</td>`;
              } else {
                  dayCells += `<td style="border:1px solid #ddd; background-color:${cellBg};"></td>`;
              }
          });

          if (holidayPayEnabled) {
              totalPay += (totalPay * (holidayPayRate / 100));
          }

          tableRows += `
            <tr style="background-color:${rowBg};">
                <td style="border:1px solid #ddd; font-weight:bold;">${staff.name}</td>
                ${dayCells}
                <td style="border:1px solid #ddd; background-color:#f3f4f6; font-weight:bold;">${totalHours.toFixed(2)}</td>
                <td style="border:1px solid #ddd; background-color:#f3f4f6;">${currency}${rate.toFixed(2)}</td>
                <td style="border:1px solid #ddd; background-color:#f3f4f6;">${currency}${totalPay.toFixed(2)}</td>
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
    csvRows.push(['Range', dateRangeLabel]);
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
    csvRows.push(['REPORT SUMMARY']);
    csvRows.push(['Company', companyName]);
    csvRows.push(['Range', dateRangeLabel]);
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
