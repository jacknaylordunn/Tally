
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
    const grouped = shifts.reduce((acc, shift) => {
      if (!acc[shift.userId]) {
        acc[shift.userId] = {
          name: shift.userName,
          totalHours: 0,
          totalBasePay: 0,
          totalHolidayPay: 0,
          grandTotal: 0,
          shiftCount: 0
        };
      }

      if (shift.endTime) {
        const hours = (shift.endTime - shift.startTime) / 3600000;
        const pay = hours * shift.hourlyRate;
        const holiday = holidayPayEnabled ? (pay * (holidayPayRate / 100)) : 0;

        acc[shift.userId].totalHours += hours;
        acc[shift.userId].totalBasePay += pay;
        acc[shift.userId].totalHolidayPay += holiday;
        acc[shift.userId].grandTotal += (pay + holiday);
        acc[shift.userId].shiftCount += 1;
      }
      return acc;
    }, {} as Record<string, any>);

    // Headers
    const headers = [
      'Staff Member',
      'Total Shifts',
      'Total Hours',
      `Base Pay (${currency})`,
      holidayPayEnabled ? `Holiday Pay (${holidayPayRate}%)` : null,
      `Grand Total (${currency})`
    ].filter(Boolean);

    csvRows.push(headers);

    // Rows
    Object.values(grouped).forEach(staff => {
      const row = [
        staff.name,
        staff.shiftCount,
        staff.totalHours.toFixed(2),
        staff.totalBasePay.toFixed(2),
        holidayPayEnabled ? staff.totalHolidayPay.toFixed(2) : null,
        staff.grandTotal.toFixed(2)
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
      'Hourly Rate',
      `Base Pay (${currency})`,
      holidayPayEnabled ? `Holiday Pay (${holidayPayRate}%)` : null,
      `Total Pay (${currency})`
    ].filter(Boolean);

    csvRows.push(headers);

    shifts.forEach(shift => {
      if (!shift.endTime) return; // Skip active shifts for safety in exports

      const startTime = new Date(shift.startTime);
      const endTime = new Date(shift.endTime);
      
      const hours = (shift.endTime - shift.startTime) / 3600000;
      const basePay = hours * shift.hourlyRate;
      const holidayPay = holidayPayEnabled ? (basePay * (holidayPayRate / 100)) : 0;
      const totalPay = basePay + holidayPay;

      const row = [
        shift.userName,
        startTime.toLocaleDateString(),
        startTime.toLocaleTimeString(),
        endTime.toLocaleTimeString(),
        hours.toFixed(2),
        shift.hourlyRate.toFixed(2),
        basePay.toFixed(2),
        holidayPayEnabled ? holidayPay.toFixed(2) : null,
        totalPay.toFixed(2)
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
