// Local-time date helpers (YYYY-MM-DD strings). Avoids toISOString(), which uses UTC
// and returns the wrong day for users east of Greenwich (e.g. Vietnam, UTC+7).
const pad = (n) => String(n).padStart(2, "0");

export const toISODate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseISODate = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISODate(new Date());

export const addDaysISO = (value, days) => {
  const date = parseISODate(value) || new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

export const formatDisplayDate = (value) => {
  const date = parseISODate(value);
  return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : "";
};
