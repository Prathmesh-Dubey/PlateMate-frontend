// src/utils/format.ts - shared formatting helpers (currency, dates, images)
import { API_BASE_URL } from '../api';

/** Formats a number as Indian Rupees, e.g. ₹12,345.50 */
export const formatINR = (
  value: number | string | null | undefined,
  options: { decimals?: number; signed?: boolean } = {}
): string => {
  const { decimals = 2, signed = false } = options;
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '₹0';
  const abs = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  if (n < 0) return `-₹${abs}`;
  return `${signed && n > 0 ? '+' : ''}₹${abs}`;
};

/** Compact rupee notation for chart axes: ₹1.2L, ₹3.4Cr, ₹850 */
export const formatCompactINR = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '₹0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 10_00_00_000 ? 0 : 1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs >= 10_00_000 ? 0 : 1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
};

/** Formats a percentage value (already 0-100) */
export const formatPercent = (value: number | string | null | undefined, decimals = 1): string => {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '—';
  return `${n.toFixed(decimals)}%`;
};

/**
 * Turns an image reference returned by the backend into a URL the browser can load.
 * Uploaded files are stored as relative paths (/uploads/...) served by the API host.
 */
export const resolveImageUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(https?:)?\/\//i.test(trimmed) || /^(data|blob):/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${API_BASE_URL}${trimmed}`;
  return `${API_BASE_URL}/${trimmed}`;
};

/** Initials for avatar fallbacks: "Rahul Sharma" -> "RS" */
export const getInitials = (name?: string | null): string => {
  if (!name || !name.trim()) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/** Tolerant date parser: accepts ISO strings and the backend's "yyyy-MM-dd HH:mm:ss" format */
export const parseDate = (value?: string | number | Date | null): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return new Date(value);
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') : value;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (
  value?: string | number | Date | null,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string => {
  const d = parseDate(value);
  return d ? d.toLocaleDateString('en-IN', options) : '—';
};

export const formatDateTime = (value?: string | number | Date | null): string => {
  const d = parseDate(value);
  return d
    ? d.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const monthName = (month: number, style: 'long' | 'short' = 'long'): string => {
  const name = MONTH_NAMES[month - 1] || '';
  return style === 'short' ? name.slice(0, 3) : name;
};
