
import { Shift, User } from '../types';
import * as XLSX_M from 'xlsx-js-style';

// Handle esm.sh default export behavior for CommonJS modules
const XLSX = (XLSX_M as any).default || XLSX_M;

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
  includeInactiveStaff?: boolean; 
  includeEmployeeId?: boolean;
  fileType?: 'xlsx' | 'csv' | 'sheets';
}

// --- HELPERS ---

const cleanHex = (hex?: string) => {
    if(!hex) return "4F46E5"; // Default Brand Color (Indigo)
    return hex.replace('#', '').toUpperCase();
};

const formatTime = (date: Date, format: '12h' | '24h_dot' = '12h') => {
    if (format === '24h_dot') {
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        return `${h}.${m}`;
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
};

const getLastName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase();
};

const getFirstName = (fullName: string) => {
    return fullName.trim().split(/\s+/)[0].toLowerCase();
};

// --- STYLING DEFINITIONS ---

const getStyles = (brandColorHex: string) => ({
    title: {
        fill: { fgColor: { rgb: brandColorHex } },
        font: { name: "Arial", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" }
    },
    metadata: {
        fill: { fgColor: { rgb: "FFFFFF" } },
        font: { name: "Arial", sz: 9, italic: true, color: { rgb: "666666" } },
        alignment: { horizontal: "center", vertical: "center" }
    },
    headerOuter: { // The "MON 2" header
        fill: { fgColor: { rgb: "F3F4F6" } }, 
        font: { name: "Arial", sz: 9, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "000000" } }, 
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } }, 
            right: { style: "thin", color: { rgb: "000000" } }
        }
    },
    headerInner: { // The "IN OUT HRS" header
        fill: { fgColor: { rgb: "E5E7EB" } }, 
        font: { name: "Arial", sz: 8, bold: true, color: { rgb: "374151" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "9CA3AF" } }, 
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "9CA3AF" } }, 
            right: { style: "thin", color: { rgb: "9CA3AF" } }
        }
    },
    summaryHeader: {
        fill: { fgColor: { rgb: "D1D5DB" } }, 
        font: { name: "Arial", sz: 9, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "000000" } }, 
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } }, 
            right: { style: "thin", color: { rgb: "000000" } }
        }
    },
    cellName: {
        font: { name: "Arial", sz: 9, bold: true },
        alignment: { horizontal: "left", vertical: "top", wrapText: true }, // Align top for stacked rows
        border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } }, 
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "000000" } }, 
            right: { style: "thin", color: { rgb: "E5E7EB" } }
        }
    },
    cellTime: {
        font: { name: "Arial", sz: 8 },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } }, 
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } }, 
            right: { style: "thin", color: { rgb: "E5E7EB" } }
        }
    },
    cellNumber: {
        font: { name: "Arial", sz: 9, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } }, 
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } }, 
            right: { style: "thin", color: { rgb: "E5E7EB" } }
        }
    },
    cellMoney: {
        font: { name: "Arial", sz: 9 },
        alignment: { horizontal: "right", vertical: "center" },
        numFmt: "#,##0.00",
        border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } }, 
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } }, 
            right: { style: "thin", color: { rgb: "000000" } } 
        }
    }
});

// --- MAIN FUNCTION ---

export const downloadPayrollReport = (
  shifts: Shift[], 
  allStaff: User[], 
  options: ExportOptions
) => {
  if (!shifts.length && !options.includeInactiveStaff) {
      alert("No data to export for this period.");
      return;
  }

  const { 
    filename, 
    matrixView = false,
    showTimesInMatrix = false,
    includeDeductions = false,
    holidayPayEnabled = false,
    holidayPayRate = 0,
    timeFormat = '12h',
    includeInactiveStaff = false,
    includeEmployeeId = false,
    companyName = 'PAYROLL MATRIX',
    dateRangeLabel = '',
    brandColor = '#4F46E5',
    fileType = 'xlsx'
  } = options;

  const BRAND_HEX = cleanHex(brandColor);
  const STYLES = getStyles(BRAND_HEX);

  // 1. Prepare Staff Data
  const staffMap: Record<string, { name: string, employeeId?: string, shifts: Shift[] }> = {};
  
  if (includeInactiveStaff) {
      allStaff.forEach(u => {
          staffMap[u.id] = { 
              name: u.name, 
              employeeId: u.employeeNumber, 
              shifts: [] 
          };
      });
  }

  shifts.forEach(s => {
      if(!staffMap[s.userId]) {
          const u = allStaff.find(u => u.id === s.userId);
          staffMap[s.userId] = { 
              name: s.userName, 
              employeeId: u?.employeeNumber, 
              shifts: [] 
          };
      }
      staffMap[s.userId].shifts.push(s);
  });

  // SORTING: Alphabetical by Last Name, then First Name
  const sortedStaff = Object.values(staffMap).sort((a, b) => {
      const aLast = getLastName(a.name);
      const bLast = getLastName(b.name);
      if (aLast !== bLast) return aLast.localeCompare(bLast);
      return getFirstName(a.name).localeCompare(getFirstName(b.name));
  });

  // Initialize Workbook
  const wb = XLSX.utils.book_new();
  let ws: any;

  if (matrixView && fileType === 'xlsx') {
      // --- MATRIX VIEW (Stacked Rows) ---
      
      const timestamps = shifts.map(s => s.startTime);
      const minDate = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date();
      const maxDate = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date();
      minDate.setHours(0,0,0,0);
      maxDate.setHours(0,0,0,0);
      
      const dates: Date[] = [];
      const cursor = new Date(minDate);
      while(cursor <= maxDate) {
          dates.push(new Date(cursor));
          cursor.setDate(cursor.getDate() + 1);
      }

      const matrix: any[][] = [];
      const merges: any[] = [];
      const cols: any[] = [];

      // ROW 0: TITLE
      const totalDateCols = dates.length * (showTimesInMatrix ? 3 : 1);
      const startCols = includeEmployeeId ? 2 : 1;
      const summaryCols = 2 + (holidayPayEnabled ? 2 : 0) + (includeDeductions ? 3 : 0);
      const totalWidth = startCols + totalDateCols + summaryCols;

      matrix.push([`${companyName.toUpperCase()} - PAYROLL MATRIX`, ...Array(totalWidth - 1).fill('')]);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalWidth - 1 } });

      // ROW 1: METADATA
      matrix.push([`Period: ${dateRangeLabel}  |  Generated: ${new Date().toLocaleString()}`, ...Array(totalWidth - 1).fill('')]);
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalWidth - 1 } });

      // ROW 2: HEADER (Dates)
      const headerRow = [];
      headerRow.push('STAFF NAME');
      cols.push({ wch: 25 }); 
      if (includeEmployeeId) {
          headerRow.push('ID');
          cols.push({ wch: 10 });
      }

      dates.forEach(d => {
          const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
          headerRow.push(dateStr);
          if (showTimesInMatrix) {
              headerRow.push('', '');
              cols.push({ wch: 9 }, { wch: 9 }, { wch: 6 });
          } else {
              cols.push({ wch: 8 });
          }
      });

      headerRow.push('TOTAL HRS', 'RATE');
      cols.push({ wch: 10 }, { wch: 8 });
      if (holidayPayEnabled) {
          headerRow.push('BASE', 'HOLIDAY');
          cols.push({ wch: 10 }, { wch: 10 });
      }
      headerRow.push('TOTAL PAY');
      cols.push({ wch: 12 });
      if (includeDeductions) {
          headerRow.push('TAX', 'NI', 'NET');
          cols.push({ wch: 10 }, { wch: 10 }, { wch: 10 });
      }
      matrix.push(headerRow);

      // ROW 3: SUB-HEADER
      const subHeaderRow = [];
      subHeaderRow.push('', ...(includeEmployeeId ? [''] : [])); 
      dates.forEach(() => {
          if (showTimesInMatrix) {
              subHeaderRow.push('IN', 'OUT', 'HRS');
          } else {
              subHeaderRow.push('HRS');
          }
      });
      // Summary placeholders
      subHeaderRow.push('', '');
      if (holidayPayEnabled) subHeaderRow.push('', '');
      subHeaderRow.push('');
      if (includeDeductions) subHeaderRow.push('', '', '');
      matrix.push(subHeaderRow);

      // HEADER MERGES
      // Staff Name Vertically
      merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });
      if (includeEmployeeId) merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } });

      // Dates Horizontally
      let cIdx = startCols;
      dates.forEach(() => {
          const span = showTimesInMatrix ? 3 : 1;
          if (span > 1) merges.push({ s: { r: 2, c: cIdx }, e: { r: 2, c: cIdx + span - 1 } });
          cIdx += span;
      });

      // Summary Vertical Merges
      for (let i = cIdx; i < totalWidth; i++) {
          merges.push({ s: { r: 2, c: i }, e: { r: 3, c: i } });
      }

      // --- DATA ROWS (STACKED) ---
      let currentRowIdx = 4;

      sortedStaff.forEach(staff => {
          // 1. Analyze shifts to determine how many rows this staff needs
          let maxDailyShifts = 1;
          const shiftsByDate: Record<string, Shift[]> = {};

          dates.forEach(d => {
              const key = d.toDateString();
              const dayShifts = staff.shifts.filter(s => {
                  const sDate = new Date(s.startTime);
                  return sDate.toDateString() === key;
              }).sort((a,b) => a.startTime - b.startTime);
              
              shiftsByDate[key] = dayShifts;
              if (dayShifts.length > maxDailyShifts) maxDailyShifts = dayShifts.length;
          });

          // 2. Aggregate Totals
          let totalHours = 0;
          let totalPay = 0;
          staff.shifts.forEach(s => {
              if (s.endTime) {
                  const h = (s.endTime - s.startTime) / 3600000;
                  totalHours += h;
                  totalPay += (h * (s.hourlyRate || 0));
              }
          });
          const avgRate = totalHours > 0 ? totalPay / totalHours : 0;
          const holiday = holidayPayEnabled ? totalPay * (holidayPayRate / 100) : 0;
          const gross = totalPay + holiday;

          // 3. Create Rows
          for (let r = 0; r < maxDailyShifts; r++) {
              const rowData: any[] = [];
              
              // Staff Name & ID (Fill only first row, merge later)
              if (r === 0) {
                  rowData.push(staff.name);
                  if (includeEmployeeId) rowData.push(staff.employeeId || '');
              } else {
                  rowData.push('');
                  if (includeEmployeeId) rowData.push('');
              }

              // Date Columns
              dates.forEach(d => {
                  const key = d.toDateString();
                  const shift = shiftsByDate[key]?.[r];

                  if (shift && shift.endTime) {
                      const h = (shift.endTime - shift.startTime) / 3600000;
                      if (showTimesInMatrix) {
                          rowData.push(formatTime(new Date(shift.startTime), timeFormat));
                          rowData.push(formatTime(new Date(shift.endTime), timeFormat));
                          rowData.push({ t: 'n', v: Number(h.toFixed(2)) });
                      } else {
                          rowData.push({ t: 'n', v: Number(h.toFixed(2)) });
                      }
                  } else {
                      if (showTimesInMatrix) rowData.push('', '', '');
                      else rowData.push('');
                  }
              });

              // Summary Columns (Only fill first row, merge later)
              if (r === 0) {
                  rowData.push({ t: 'n', v: Number(totalHours.toFixed(2)) });
                  rowData.push({ t: 'n', v: Number(avgRate.toFixed(2)) });
                  if (holidayPayEnabled) {
                      rowData.push({ t: 'n', v: Number(totalPay.toFixed(2)) });
                      rowData.push({ t: 'n', v: Number(holiday.toFixed(2)) });
                  }
                  rowData.push({ t: 'n', v: Number(gross.toFixed(2)) });
                  if (includeDeductions) rowData.push('', '', '');
              } else {
                  // Fill blanks for summary
                  rowData.push('', '');
                  if (holidayPayEnabled) rowData.push('', '');
                  rowData.push('');
                  if (includeDeductions) rowData.push('', '', '');
              }

              matrix.push(rowData);
          }

          // 4. Merge Staff & Summary Cells Vertical
          if (maxDailyShifts > 1) {
              // Name
              merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx + maxDailyShifts - 1, c: 0 } });
              // ID
              if (includeEmployeeId) {
                  merges.push({ s: { r: currentRowIdx, c: 1 }, e: { r: currentRowIdx + maxDailyShifts - 1, c: 1 } });
              }
              // Summaries
              for (let i = totalWidth - summaryCols; i < totalWidth; i++) {
                  merges.push({ s: { r: currentRowIdx, c: i }, e: { r: currentRowIdx + maxDailyShifts - 1, c: i } });
              }
          }

          currentRowIdx += maxDailyShifts;
      });

      // --- CREATE SHEET & APPLY STYLES ---
      ws = XLSX.utils.aoa_to_sheet(matrix);
      ws['!merges'] = merges;
      ws['!cols'] = cols;
      
      // AutoFilter on Header Row (Row index 2)
      // Range: A3 to LastColumn3
      const endColChar = XLSX.utils.encode_col(totalWidth - 1);
      ws['!autofilter'] = { ref: `A3:${endColChar}${currentRowIdx}` };

      // Apply Styles
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
      
      for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
              if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
              const cell = ws[cellRef];

              // Title
              if (R === 0) cell.s = STYLES.title;
              // Metadata
              else if (R === 1) cell.s = STYLES.metadata;
              // Header
              else if (R === 2) cell.s = (C >= totalWidth - summaryCols) ? STYLES.summaryHeader : STYLES.headerOuter;
              // SubHeader
              else if (R === 3) cell.s = (C >= totalWidth - summaryCols) ? STYLES.summaryHeader : STYLES.headerInner;
              // Data
              else {
                  if (C === 0) cell.s = STYLES.cellName; // Name
                  else if (C >= totalWidth - summaryCols) cell.s = STYLES.cellMoney; // Summary
                  else {
                      // Time Columns
                      if (showTimesInMatrix && ((C - startCols) % 3 === 2)) cell.s = STYLES.cellNumber; // Bold Hours
                      else if (!showTimesInMatrix) cell.s = STYLES.cellNumber;
                      else cell.s = STYLES.cellTime;
                  }
              }
          }
      }

  } else {
      // Basic CSV
      const headers = ['Name', 'Date', 'Start', 'End', 'Hours', 'Rate', 'Total'];
      const rows = shifts.map(s => [
          s.userName,
          new Date(s.startTime).toLocaleDateString(),
          new Date(s.startTime).toLocaleTimeString(),
          s.endTime ? new Date(s.endTime).toLocaleTimeString() : '',
          s.endTime ? ((s.endTime - s.startTime)/3600000).toFixed(2) : '',
          s.hourlyRate,
          s.endTime ? ((s.endTime - s.startTime)/3600000 * s.hourlyRate).toFixed(2) : ''
      ]);
      ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  }

  XLSX.utils.book_append_sheet(wb, ws, "Payroll");
  
  if (fileType === 'csv') {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
  } else {
      XLSX.writeFile(wb, `${filename}.xlsx`, { bookType: 'xlsx' });
  }
};
