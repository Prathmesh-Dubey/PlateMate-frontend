// src/pages/BillingPage.tsx - Financial billing dashboard (live data only)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  IndianRupee,
  Info,
  Layers,
  PartyPopper,
  Printer,
  Receipt,
  RefreshCw,
  UserCog,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import { Fact, DetailSheet } from '../components/DetailSheet';
import api from '../api';
import type { BillingScope, BillingSummary, MonthlyProfitLoss } from '../types';
import { SummaryCard } from '../components/SummaryCard';
import { MonthlyProfitLossChart } from '../components/MonthlyProfitLossChart';
import { formatDate, formatDateTime, formatINR, formatPercent, monthName } from '../utils/format';

interface BillingPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => THIS_YEAR - 5 + i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const SCOPE_OPTIONS: Array<{ id: BillingScope; label: string }> = [
  { id: 'MONTH', label: 'This Month' },
  { id: 'YEAR', label: 'Year' },
  { id: 'ALL', label: 'All Time' },
];

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const plural = (n: number, word: string, pluralWord?: string) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? word : pluralWord || `${word}s`}`;

export const BillingPage: React.FC<BillingPageProps> = ({ showToast }) => {
  const [scope, setScope] = useState<BillingScope>('MONTH');
  const [detailMonth, setDetailMonth] = useState<number | null>(null);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(THIS_YEAR);

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [pnl, setPnl] = useState<MonthlyProfitLoss | null>(null);
  const [pnlLoading, setPnlLoading] = useState<boolean>(true);
  const [pnlError, setPnlError] = useState<string | null>(null);

  // Keep the latest toast function without re-triggering data loads on every render
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const summaryRequestId = useRef(0);
  const pnlRequestId = useRef(0);

  const loadSummary = useCallback(async () => {
    const requestId = ++summaryRequestId.current;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await api.billing.getSummary(scope, month, year);
      if (requestId !== summaryRequestId.current) return;
      setSummary(data);
    } catch (err) {
      if (requestId !== summaryRequestId.current) return;
      const msg = errorMessage(err, 'Failed to load the billing summary');
      setSummary(null);
      setSummaryError(msg);
      toastRef.current('error', msg);
    } finally {
      if (requestId === summaryRequestId.current) setSummaryLoading(false);
    }
  }, [scope, month, year]);

  const loadPnl = useCallback(async () => {
    const requestId = ++pnlRequestId.current;
    setPnlLoading(true);
    setPnlError(null);
    try {
      const data = await api.billing.getProfitLossChart(year);
      if (requestId !== pnlRequestId.current) return;
      setPnl(data);
    } catch (err) {
      if (requestId !== pnlRequestId.current) return;
      const msg = errorMessage(err, 'Failed to load the monthly profit & loss data');
      setPnl(null);
      setPnlError(msg);
      toastRef.current('error', msg);
    } finally {
      if (requestId === pnlRequestId.current) setPnlLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadPnl();
  }, [loadPnl]);

  const refreshAll = () => {
    api.clearCache(); // manual refresh always bypasses the cache
    loadSummary();
    loadPnl();
  };

  const handlePrint = () => {
    window.print();
  };

  const s = summary;
  const cardError = summaryError ? 'Data unavailable' : null;
  const periodLabel = s?.periodLabel
    || (scope === 'MONTH' ? `${monthName(month)} ${year}` : scope === 'YEAR' ? `Year ${year}` : 'All time');

  const topCategories = s
    ? (Object.entries(s.expenses.categoryBreakdown || {}) as Array<[string, number]>)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 2)
    : [];

  const net = s?.profitLoss.netProfitLoss ?? 0;
  const pnlTotals = pnl?.totals;
  const selectedMonthForChart = scope === 'MONTH' ? month : undefined;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="bg-white p-3 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-4 print:hidden">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Financial Billing Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
            Showing <span className="font-semibold text-slate-700">{periodLabel}</span>
            {s?.generatedAt && <> · calculated {formatDateTime(s.generatedAt)}</>}
            {' '}· all figures come directly from the database
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full sm:w-auto sm:inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold" role="tablist" aria-label="Period">
            {SCOPE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={scope === opt.id}
                onClick={() => setScope(opt.id)}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-colors ${scope === opt.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {scope === 'MONTH' && (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="sr-only sm:not-sr-only">Month</span>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="px-3 py-2 sm:py-1.5 h-10 sm:h-auto sm:min-h-0 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {scope !== 'ALL' && (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="sr-only sm:not-sr-only">Year</span>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="px-3 py-2 sm:py-1.5 h-10 sm:h-auto sm:min-h-0 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={refreshAll}
            disabled={summaryLoading || pnlLoading}
            className="p-2.5 sm:p-2 min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Refresh financials"
          >
            <RefreshCw className={`w-4 h-4 ${summaryLoading || pnlLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2 sm:py-1.5 h-10 sm:h-auto min-h-[40px] sm:min-h-0 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg flex items-center space-x-1 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Export</span>
          </button>
        </div>
      </div>

      {summaryError && !summaryLoading && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">The billing summary could not be loaded.</div>
              <div className="text-rose-700 mt-0.5 break-words">{summaryError}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={loadSummary}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 bg-white border border-rose-200 rounded-lg font-semibold hover:bg-rose-100 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      )}

      {/* Summary boxes */}
      <section aria-label="Financial summary" className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-5">
        <SummaryCard
          title="Billable Amount"
          badge="College"
          icon={Building2}
          accent="blue"
          loading={summaryLoading}
          error={cardError}
          onRetry={loadSummary}
          value={s ? formatINR(s.collegeBilling.billableAmount) : null}
          subtitle={
            s && (
              <>
                Received <span className="font-semibold text-emerald-700">{formatINR(s.collegeBilling.amountReceived)}</span>
                {' '}· Outstanding <span className="font-semibold text-rose-700">{formatINR(s.collegeBilling.outstandingBalance)}</span>
              </>
            )
          }
          footer={
            s && (
              <>
                <span>{plural(s.collegeBilling.recordCount, 'monthly bill')}</span>
                <span className="font-semibold text-blue-600">Billed to colleges</span>
              </>
            )
          }
        />

        <SummaryCard
          title="Total Staff Salary"
          badge="Payroll"
          icon={UserCog}
          accent="indigo"
          loading={summaryLoading}
          error={cardError}
          onRetry={loadSummary}
          value={s ? formatINR(s.staffSalary.monthlyPayroll) : null}
          subtitle={s && <>{plural(s.staffSalary.activeStaffCount, 'active staff member')} · base salary per month</>}
          footer={
            s && (
              <>
                <span>Paid ({periodLabel})</span>
                <span className="font-semibold text-slate-800">
                  {formatINR(s.staffSalary.paidInPeriod)} · {plural(s.staffSalary.paymentCount, 'slip')}
                </span>
              </>
            )
          }
        />

        <SummaryCard
          title="Total Expenses"
          icon={Receipt}
          accent="rose"
          loading={summaryLoading}
          error={cardError}
          onRetry={loadSummary}
          value={s ? formatINR(s.expenses.total) : null}
          subtitle={
            s && (
              <>
                {plural(s.expenses.count, 'entry', 'entries')}
                {topCategories.length > 0 && (
                  <>
                    {' '}· top: {topCategories.map(([cat, amt]) => `${cat.replace(/_/g, ' ').toLowerCase()} ${formatINR(amt, { decimals: 0 })}`).join(', ')}
                  </>
                )}
              </>
            )
          }
          footer={s && <span>All categories from the expense log ({periodLabel})</span>}
        />

        <SummaryCard
          title="Today's Day-to-Day Expense"
          badge="Today"
          icon={CalendarDays}
          accent="orange"
          loading={summaryLoading}
          error={cardError}
          onRetry={loadSummary}
          value={s ? formatINR(s.todayExpense.amount) : null}
          subtitle={s && <>{formatDate(s.todayExpense.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {plural(s.todayExpense.count, 'entry', 'entries')}</>}
          footer={s && <span>Logged on the Day-to-day Expenses page for today</span>}
        />

        <SummaryCard
          title="Mess Fees Revenue"
          icon={IndianRupee}
          accent="emerald"
          loading={summaryLoading}
          error={cardError}
          onRetry={loadSummary}
          value={s && s.messFees.expectedMonthly !== null && s.messFees.expectedMonthly !== undefined ? formatINR(s.messFees.expectedMonthly) : (s ? '—' : null)}
          footer={
            s && <span>Expected mess fees for {periodLabel}</span>
          }
        />

        <SummaryCard
          title="Party / Catering Income"
          icon={PartyPopper}
          accent="cyan"
          loading={summaryLoading}
          error={cardError}
          onRetry={loadSummary}
          value={s ? formatINR(s.partyIncome.totalBilled) : null}
          subtitle={
            s && (
              <>
                Received <span className="font-semibold text-emerald-700">{formatINR(s.partyIncome.received)}</span>
                {' '}· Pending <span className="font-semibold text-rose-700">{formatINR(s.partyIncome.pending)}</span>
              </>
            )
          }
          footer={
            s && (
              <>
                <span>{plural(s.partyIncome.partyCount, 'event')}</span>
                <span className="font-semibold text-cyan-700">Billed by event date</span>
              </>
            )
          }
        />
      </section>

      {/* Monthly Profit & Loss */}
      <section className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 min-w-0">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Monthly Profit &amp; Loss ({year})</span>
            </h3>
            <p className="hidden sm:block text-[11px] text-slate-500 mt-0.5">Real revenue vs real expenses for every month, recalculated from the database on each load</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              Year
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="px-3 py-2 sm:py-1.5 h-10 sm:h-auto sm:min-h-0 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => { api.clearCache(); loadPnl(); }}
              disabled={pnlLoading}
              className="p-2.5 sm:p-2 min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title="Reload chart"
            >
              <RefreshCw className={`w-4 h-4 ${pnlLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {pnlTotals && !pnlLoading && !pnlError && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <TotalChip label="Revenue" value={formatINR(pnlTotals.income)} tone="emerald" />
            <TotalChip label="Expenses" value={formatINR(pnlTotals.expenses)} tone="rose" />
            <TotalChip
              label={pnlTotals.profit >= 0 ? 'Net profit' : 'Net loss'}
              value={formatINR(pnlTotals.profit, { signed: true })}
              tone={pnlTotals.profit >= 0 ? 'blue' : 'amber'}
            />
            <TotalChip
              label="Months with data"
              value={`${pnlTotals.monthsWithData} / 12`}
              tone="slate"
              hint={`${pnlTotals.profitableMonths} profitable · ${pnlTotals.lossMonths} loss`}
            />
          </div>
        )}

        <MonthlyProfitLossChart
          data={pnl?.monthlyData || []}
          year={year}
          loading={pnlLoading}
          error={pnlError}
          onRetry={loadPnl}
          selectedMonth={selectedMonthForChart}
        />

        {pnl?.basis && (
          <p className="flex items-start gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
            <span className="min-w-0 break-words">{pnl.basis}</span>
          </p>
        )}
      </section>

      {/* Monthly ledger (real data) */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 text-sm">Monthly Ledger · {year}</h3>
          <span className="text-xs text-slate-500">Amounts in ₹</span>
        </div>

        {pnlLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading monthly ledger…</div>
        ) : pnlError ? (
          <div className="p-8 text-center text-xs text-rose-600">{pnlError}</div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-slate-100">
            {(pnl?.monthlyData || []).map(row => {
              const isSelected = scope === 'MONTH' && row.month === month;
              const muted = !row.hasData;
              const cell = (v: number) => (muted ? '—' : formatINR(v));
              const dot = muted ? 'bg-slate-300' : row.profit >= 0 ? 'bg-emerald-500' : 'bg-rose-500';
              return (
                <button
                  type="button"
                  key={row.month}
                  onClick={() => setDetailMonth(row.month)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2 active:bg-slate-50 ${isSelected ? 'bg-blue-50/60' : ''} ${muted ? 'text-slate-400' : 'text-slate-700'}`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <span className="text-[15px] font-semibold text-slate-900 truncate">{row.monthName} {year}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 shrink-0">Selected</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Fact icon={TrendingUp} label="Revenue" tone={muted ? 'default' : 'good'}>{cell(row.income)}</Fact>
                      <Fact icon={TrendingDown} label="Total costs" tone={muted ? 'default' : 'bad'}>{cell(row.expenses)}</Fact>
                    </div>
                  </div>
                  <div className={`shrink-0 text-base font-bold tabular-nums ${muted ? 'text-slate-300' : row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {muted ? '—' : formatINR(row.profit, { signed: true })}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
                </button>
              );
            })}
            {pnlTotals && (
              <div className="px-3 py-2 space-y-1 bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-slate-900">Total {year}</span>
                  <span className={`shrink-0 text-base font-bold tabular-nums ${pnlTotals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatINR(pnlTotals.profit, { signed: true })}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Rev</span>
                    <span className="text-[12px] font-semibold tabular-nums text-emerald-700">{formatINR(pnlTotals.income)}</span>
                  </span>
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Costs</span>
                    <span className="text-[12px] font-semibold tabular-nums text-rose-700">{formatINR(pnlTotals.expenses)}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Mess Fees</th>
                  <th className="px-4 py-3 text-right">Party Income</th>
                  <th className="px-4 py-3 text-right">College Billing</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Expenses</th>
                  <th className="px-4 py-3 text-right">Staff Salary</th>
                  <th className="px-4 py-3 text-right">Total Costs</th>
                  <th className="px-4 py-3 text-right">Net Profit / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(pnl?.monthlyData || []).map(row => {
                  const isSelected = scope === 'MONTH' && row.month === month;
                  const muted = !row.hasData;
                  const cell = (v: number) => (muted ? <span className="text-slate-300">—</span> : formatINR(v));
                  return (
                    <tr
                      key={row.month}
                      className={`transition-colors ${isSelected ? 'bg-blue-50/60 font-semibold' : 'hover:bg-slate-50/80'} ${muted ? 'text-slate-400' : ''}`}
                    >
                      <td className="px-4 py-3 text-slate-900 font-medium whitespace-nowrap">
                        {row.monthName} {year}
                        {isSelected && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1 font-bold">Selected</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{cell(row.messFees)}</td>
                      <td className="px-4 py-3 text-right">{cell(row.partyIncome)}</td>
                      <td className="px-4 py-3 text-right">{cell(row.collegeBillingIncome)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{cell(row.income)}</td>
                      <td className="px-4 py-3 text-right">{cell(row.dayToDayExpenses)}</td>
                      <td className="px-4 py-3 text-right">{cell(row.staffSalary)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-700">{cell(row.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${muted ? '' : row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {muted ? <span className="text-slate-300">—</span> : formatINR(row.profit, { signed: true })}
                      </td>
                    </tr>
                  );
                })}
                {pnlTotals && (
                  <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                    <td className="px-4 py-3">Total {year}</td>
                    <td className="px-4 py-3 text-right">{formatINR(pnlTotals.messFees)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(pnlTotals.partyIncome)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(pnlTotals.collegeBillingIncome)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatINR(pnlTotals.income)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(pnlTotals.dayToDayExpenses)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(pnlTotals.staffSalary)}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{formatINR(pnlTotals.expenses)}</td>
                    <td className={`px-4 py-3 text-right ${pnlTotals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatINR(pnlTotals.profit, { signed: true })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
      {(() => {
        const row = detailMonth !== null ? (pnl?.monthlyData || []).find(r => r.month === detailMonth) : null;
        if (!row) return null;
        const muted = !row.hasData;
        const cell = (v: number) => (muted ? '—' : formatINR(v));
        return (
          <DetailSheet
            open
            onClose={() => setDetailMonth(null)}
            title={`${row.monthName} ${year}`}
            subtitle={muted ? 'No data for this month' : `Margin ${formatPercent(row.profitMargin)}`}
            headline={<span className={muted ? 'text-slate-300' : row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{muted ? '—' : formatINR(row.profit, { signed: true })}</span>}
            fields={[
              { icon: Receipt, label: 'Mess fees', value: cell(row.messFees) },
              { icon: PartyPopper, label: 'Party income', value: cell(row.partyIncome) },
              { icon: Building2, label: 'College billing', value: cell(row.collegeBillingIncome) },
              { icon: TrendingUp, label: 'Revenue', value: cell(row.income), tone: muted ? 'default' : 'good' },
              { icon: Wallet, label: 'Expenses', value: cell(row.dayToDayExpenses) },
              { icon: UserCog, label: 'Staff salary', value: cell(row.staffSalary) },
              { icon: TrendingDown, label: 'Total costs', value: cell(row.expenses), tone: muted ? 'default' : 'bad' },
              { icon: IndianRupee, label: row.profit >= 0 ? 'Net profit' : 'Net loss', value: muted ? '—' : formatINR(row.profit, { signed: true }), tone: muted ? 'default' : row.profit >= 0 ? 'good' : 'bad' },
            ]}
          />
        );
      })()}
    </div>
  );
};

const chipTones: Record<string, string> = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  rose: 'bg-rose-50 border-rose-200 text-rose-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  slate: 'bg-slate-50 border-slate-200 text-slate-800',
};

const TotalChip: React.FC<{ label: string; value: string; tone: keyof typeof chipTones; hint?: string }> = ({
  label,
  value,
  tone,
  hint,
}) => (
  <div className={`rounded-xl md:rounded-lg border p-2.5 md:px-3 md:py-2 min-w-0 ${chipTones[tone]}`}>
    <div className="text-[10px] uppercase tracking-wider font-semibold opacity-70">{label}</div>
    <div className="text-lg md:text-sm font-bold leading-tight truncate" title={value}>
      {value}
    </div>
    {hint && <div className="text-[10px] opacity-70">{hint}</div>}
  </div>
);

export default BillingPage;