// Common Utility Helper Functions

const baselineDateStr = "2026-06-24";

export function getDaysRemaining(targetDateStr) {
  if (!targetDateStr) return 0;
  const target = new Date(targetDateStr + "T00:00:00");
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - base.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function formatDateString(dateStr) {
  if (!dateStr) return '';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr + "T12:00:00").toLocaleDateString('en-US', options);
  } catch {
    return dateStr;
  }
}

export function convertTimeTo24h(timeStr) {
  try {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier && modifier.toLowerCase() === 'pm') {
      hours = parseInt(hours, 10) + 12;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  } catch {
    return '09:00:00';
  }
}

export function getNearestDayDateString(dayName) {
  const daysOfWeek = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDayNum = daysOfWeek[dayName.toLowerCase()];
  
  if (targetDayNum === undefined) return baselineDateStr;
  
  const base = new Date(baselineDateStr + "T12:00:00");
  const baseDayNum = base.getDay();
  
  let daysDiff = targetDayNum - baseDayNum;
  if (daysDiff < 0) daysDiff += 7;
  
  const targetDate = new Date(base.getTime() + daysDiff * 24 * 60 * 60 * 1000);
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
