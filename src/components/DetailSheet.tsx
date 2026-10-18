// src/components/DetailSheet.tsx
// Shared building blocks for the phone list views:
//   <Fact>        - an icon + short value used inside list rows instead of a text label
//   <DetailSheet> - the pop-up (bottom sheet on phones) that shows the full record when a row is tapped
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useBackClose } from '../hooks/backNavigation';

export type FactTone = 'default' | 'good' | 'bad' | 'warn' | 'info';

const toneClass: Record<FactTone, string> = {
  default: 'text-slate-700',
  good: 'text-emerald-700',
  bad: 'text-rose-600',
  warn: 'text-amber-600',
  info: 'text-blue-700',
};

interface FactProps {
  icon: React.ElementType;
  /** What the icon means (shown as tooltip / read by screen readers) */
  label: string;
  children: React.ReactNode;
  tone?: FactTone;
  className?: string;
}

/** Icon + value, e.g. [phone icon] 98765 43210. Replaces "Phone: 98765 43210". */
export const Fact: React.FC<FactProps> = ({ icon: Icon, label, children, tone = 'default', className = '' }) => (
  <span
    className={`inline-flex min-w-0 items-center gap-1 text-[12px] font-semibold tabular-nums ${toneClass[tone]} ${className}`}
    title={label}
    aria-label={label}
  >
    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
    <span className="truncate">{children}</span>
  </span>
);

export interface DetailField {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: FactTone;
  /** Span both columns (long text such as remarks / address) */
  wide?: boolean;
}

export interface DetailAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger';
}

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional pill(s) shown under the title (status, category...) */
  badges?: React.ReactNode;
  /** Optional headline figure on the right of the header (amount, stock...) */
  headline?: React.ReactNode;
  /** Optional leading visual (avatar / logo) */
  leading?: React.ReactNode;
  fields: DetailField[];
  actions?: DetailAction[];
  children?: React.ReactNode;
}

const actionClass: Record<NonNullable<DetailAction['tone']>, string> = {
  default: 'bg-white border border-slate-200 text-slate-700 active:bg-slate-100',
  primary: 'bg-blue-600 text-white active:bg-blue-700',
  danger: 'bg-rose-50 border border-rose-100 text-rose-700 active:bg-rose-100',
};

export const DetailSheet: React.FC<DetailSheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  badges,
  headline,
  leading,
  fields,
  actions = [],
  children,
}) => {
  // Escape closes it; Back (Android button / gesture) closes it instead of leaving the screen
  useBackClose(open, onClose);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div data-back-managed className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-4 pb-3 pt-4">
          {leading}
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-lg font-bold leading-snug text-slate-900">{title}</h3>
            {subtitle && <div className="mt-0.5 break-words text-xs text-slate-500">{subtitle}</div>}
            {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
          </div>
          {headline && <div className="shrink-0 text-right text-xl font-bold tabular-nums text-slate-900">{headline}</div>}
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {fields.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className={`min-w-0 ${f.wide ? 'col-span-2' : ''}`}>
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {f.label}
                  </dt>
                  <dd className={`mt-0.5 break-words text-sm font-semibold ${toneClass[f.tone || 'default']}`}>{f.value}</dd>
                </div>
              );
            })}
          </dl>
          {children}
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
            {actions.map((a, i) => {
              const Icon = a.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${actionClass[a.tone || 'default']}`}
                >
                  <Icon className="h-4 w-4" />
                  {a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
