export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, decimals = 0) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function average(values, fallback) {
  const cleanValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!cleanValues.length) return fallback;
  return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
}

export function normalizeRange(value, start, end) {
  if (!Number.isFinite(value) || end === start) return 0;
  return clamp(((value - start) / (end - start)) * 100);
}

export function parseTimestampMs(value) {
  if (!value) return null;
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function median(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return 1000;
  return clean[Math.floor(clean.length / 2)];
}
