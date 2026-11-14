const MONTHS_VI = [
  'Th01', 'Th02', 'Th03', 'Th04', 'Th05', 'Th06',
  'Th07', 'Th08', 'Th09', 'Th10', 'Th11', 'Th12',
];

const MONTHS_FULL_VI = [
  'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
  'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12',
];

const DAY_NAMES_SHORT = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];

/** Chuyển Date -> "YYYY-MM-DD" dùng giờ địa phương (KHÔNG dùng toISOString) */
export const toApiDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Chuyển "YYYY-MM-DD" -> "dd/MM/yyyy" */
export const toDisplayDate = (apiDate: string): string => {
  const [y, m, d] = apiDate.split('-');
  return `${d}/${m}/${y}`;
};

/** Chuyển "YYYY-MM-DD" -> "Th 7, 10 thg 10" */
export const toShortDisplay = (apiDate: string): string => {
  const [y, m, d] = apiDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = DAY_NAMES_SHORT[date.getDay()];
  return `${dayName}, ${d} thg ${m}`;
};

/** Số đêm giữa 2 chuỗi "YYYY-MM-DD" */
export const countNights = (checkIn: string, checkOut: string): number => {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
};

export const formatDate = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

export const formatDateShort = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = MONTHS_VI[date.getMonth()];
  return `${d} ${m}`;
};

export const formatDateRange = (checkIn: Date, checkOut: Date): string => {
  return `${formatDateShort(checkIn)} → ${formatDate(checkOut)}`;
};

export const calculateNights = (checkIn: Date, checkOut: Date): number => {
  const diff = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const isDateInRange = (date: Date, start: Date, end: Date): boolean => {
  return date >= start && date <= end;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const isPastDate = (date: Date): boolean => {
  const today = getTodayStart();
  return date < today;
};

export const getTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const toDateString = (date: Date): string => {
  // Returns YYYY-MM-DD for calendar component
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const fromDateString = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Định dạng ngày giờ "dd/MM/yyyy HH:mm"
 * Nhận được cả chuỗi ISO lẫn mảng [năm, tháng, ngày, giờ, phút, giây, nano] từ Spring Boot
 */
export const formatDateTime = (
  value: string | number[] | Date | null | undefined
): string => {
  if (!value) return 'Chưa cập nhật';

  // Trường hợp mảng số từ Spring Boot: [year, month, day, hour, minute, second, nano]
  if (Array.isArray(value)) {
    if (value.length < 3) return 'Chưa cập nhật';
    const y = value[0];
    const m = String(value[1]).padStart(2, '0');
    const d = String(value[2]).padStart(2, '0');
    const h = String(value[3] ?? 0).padStart(2, '0');
    const min = String(value[4] ?? 0).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  }

  // Trường hợp đối tượng Date
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return 'Chưa cập nhật';
    const d = String(value.getDate()).padStart(2, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    const h = String(value.getHours()).padStart(2, '0');
    const min = String(value.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  }

  // Trường hợp chuỗi
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 'Chưa cập nhật';

    // Thử regex để giữ nguyên ngày giờ nếu là định dạng YYYY-MM-DDTHH:mm
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
    }

    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      const h = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${d}/${m}/${y} ${h}:${min}`;
    }
  }

  return 'Chưa cập nhật';
};

