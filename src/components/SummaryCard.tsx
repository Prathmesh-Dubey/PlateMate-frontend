// src/components/SummaryCard.tsx - reusable KPI / dashboard summary box
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export type SummaryAccent = 'blue' | 'emerald' | 'rose' | 'amber' | 'indigo' | 'violet' | 'cyan' | 'slate' | 'orange';

const accentStyles: Record<SummaryAccent, { icon: string; iconBg: string; value: string }> = {
  blue: { icon: 'text-blue-600', iconBg: 'bg-blue-50', value: 'text-slate-900' },
  emerald: { icon: 'text-emerald-600', iconBg: 'bg-emerald-50', value: 'text-emerald-700' },
  rose: { icon: 'text-rose-600', iconBg: 'bg-rose-50', value: 'text-rose-700' },
  amber: { icon: 'text-amber-600', iconBg: 'bg-amber-50', value: 'text-amber-700' },
  indigo: { icon: 'text-indigo-600', iconBg: 'bg-indigo-50', value: 'text-slate-900' },
  violet: { icon: 'text-violet-600', iconBg: 'bg-violet-50', value: 'text-slate-900' },
  cyan: { icon: 'text-cyan-600', iconBg: 'bg-cyan-50', value: 'text-cyan-700' },
  slate: { icon: 'text-slate-600', iconBg: 'bg-slate-100', value: 'text-slate-900' },
  orange: { icon: 'text-orange-600', iconBg: 'bg-orange-50', value: 'text-orange-700' },
};

export interface SummaryCardProps {
  title: string;
  /** Already formatted value. null / undefined renders the empty state. */
  value?: string | number | null;
  icon: React.ElementType;
  accent?: SummaryAccent;
  /** Small line under the value (breakdown, hint) */
  subtitle?: React.ReactNode;
  /** Optional row separated by a border at the bottom of the card */
  footer?: React.ReactNode;
  /** Small pill rendered next to the title */
  badge?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyLabel?: string;
  /** Overrides the accent based value colour, e.g. for negative numbers */
  valueClassName?: string;
  className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  icon: Icon,
  accent = 'blue',
  subtitle,
  footer,
  badge,
  loading = false,
  error = null,
  onRetry,
  emptyLabel = 'No data',
  valueClassName,
  className = '',
}) => {
  const styles = accentStyles[accent];
  const isEmpty = value === null || value === undefined || value === '';

  return (
    <div
      className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md flex flex-col min-w-0 ${className}`}
      role="group"
      aria-label={title}
      aria-busy={loading}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-500 truncate">{title}</span>
          {badge && (
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
              {badge}
            </span>
          )}
        </div>
        <div className={`p-1.5 rounded-lg shrink-0 ${styles.iconBg}`}>
          <Icon className={`w-4 h-4 ${styles.icon}`} />
        </div>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2 animate-pulse" aria-hidden="true">
          <div className="h-7 w-2/3 bg-slate-200 rounded" />
          <div className="h-3 w-1/2 bg-slate-100 rounded" />
        </div>
      ) : error ? (
        <div className="mt-3">
          <div className="flex items-start gap-1.5 text-xs text-rose-600">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className={`text-2xl font-bold mt-2 truncate ${isEmpty ? 'text-slate-400 text-lg' : valueClassName || styles.value}`}
            title={isEmpty ? emptyLabel : String(value)}
          >
            {isEmpty ? emptyLabel : value}
          </div>
          {subtitle && <div className="mt-1 text-[11px] text-slate-500 leading-snug">{subtitle}</div>}
        </>
      )}

      {footer && !loading && !error && (
        <div className="mt-auto pt-2 mt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between gap-2 flex-wrap">
          {footer}
        </div>
      )}
    </div>
  );
};

export default SummaryCard;
