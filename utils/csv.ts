
import { Shift } from '../types';

export const downloadShiftsCSV = (shifts: Shift[], filename: string, currency: string = '$') => {
  if (!shifts.length) return;

  // Transform data for CSV
  const data = shifts.map(shift => {
    const startTime = new Date(shift.startTime);
    const endTime = shift.endTime ? new Date(shift.endTime) : null;
    const durationHours = shift.endTime 
      ? ((shift.endTime - shift.startTime) / 3600000).toFixed(2) 
      : 'Active';
    
    const pay = shift.endTime 
      ? ((shift.endTime - shift.startTime) / 3600000 * shift.hourlyRate).toFixed(2)
      : '0.00';

    return {
      'Shift ID': shift.id,
      'Staff Name': shift.userName,
      'Date': startTime.toLocaleDateString(),
      'Start Time': startTime.toLocaleTimeString(),
      'End Time': endTime ? endTime.toLocaleTimeString() : 'Active',
      'Hours': durationHours,
      'Rate': shift.hourlyRate,
      [`Est. Pay (${currency})`]: pay,
      'Method': shift.startMethod
    };
  });

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => JSON.stringify((row as any)[header])).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
