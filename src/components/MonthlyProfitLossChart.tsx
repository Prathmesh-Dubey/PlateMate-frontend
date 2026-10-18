// src/components/MonthlyProfitLossChart.tsx - real revenue vs expenses per month (recharts)
import React from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, BarChart3, RefreshCw } from 'lucide-react';
import type { MonthlyProfitLossEntry } from '../types';
import { formatCompactINR, formatINR } from '../utils/format';

interface MonthlyProfitLossChartProps {
  data: MonthlyProfitLossEntry[];
  year: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectedMonth?: number;
  height?: number;
}

const COLORS = {
  revenue: '#059669', // emerald-600
  expenses: '#e11d48', // rose-600
  profit: '#2563eb', // blue-600
  loss: '#f59e0b', // amber-500
};

const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const entry: MonthlyProfitLossEntry | undefined = payload[0]?.payload;
  if (!entry) return null;
  const profit = Number(entry.profit || 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[220px]">
      <div className="font-bold text-slate-900 mb-2">{entry.monthName || label}</div>
      <div className="space-y-1">
        <Row label="Mess fees" value={entry.messFees} />
        <Row label="Party / catering" value={entry.partyIncome} />
        <Row label="College billing" value={entry.collegeBillingIncome} />
        <Row label="Revenue" value={entry.income} bold color="text-emerald-700" />
        <div className="border-t border-slate-100 my-1" />
        <Row label="Expenses (day-to-day)" value={entry.dayToDayExpenses} />
        <Row label="Staff salary" value={entry.staffSalary} />
        <Row label="Total expenses" value={entry.expenses} bold color="text-rose-700" />
        <div className="border-t border-slate-100 my-1" />
        <Row
          label={profit >= 0 ? 'Net profit' : 'Net loss'}
          value={profit}
          bold
          color={profit >= 0 ? 'text-blue-700' : 'text-amber-700'}
        />
      </div>
      {!entry.hasData && <div className="mt-2 text-[10px] text-slate-400">No transactions recorded for this month</div>}
    </div>
  );
};

const Row: React.FC<{ label: string; value: number | string | undefined; bold?: boolean; color?: string }> = ({
  label,
  value,
  bold,
  color = 'text-slate-700',
}) => (
  <div className={`flex items-center justify-between gap-4 ${bold ? 'font-semibold' : ''} ${color}`}>
    <span className={bold ? '' : 'text-slate-500'}>{label}</span>
    <span>{formatINR(value)}</span>
  </div>
);

export const MonthlyProfitLossChart: React.FC<MonthlyProfitLossChartProps> = ({
  data,
  year,
  loading = false,
  error = null,
  onRetry,
  selectedMonth,
  height = 320,
}) => {
  if (loading) {
    return (
      <div className="animate-pulse" style={{ height }} aria-busy="true" aria-label="Loading chart">
        <div className="h-full w-full bg-slate-100 rounded-lg flex items-end gap-2 p-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 bg-slate-200 rounded-t" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-2" style={{ height }}>
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-sm font-semibold text-slate-800">Could not load the monthly profit &amp; loss data</p>
        <p className="text-xs text-slate-500 max-w-md">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        )}
      </div>
    );
  }

  const hasAnyData = data.some(d => d.hasData);
  if (!data.length || !hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-2" style={{ height }}>
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-800">No financial records for {year}</p>
        <p className="text-xs text-slate-500 max-w-sm">
          Mess fee collections, party bookings, college bills, expenses or staff salary payments dated in {year} will
          appear here automatically.
        </p>
      </div>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    income: Number(d.income || 0),
    expenses: Number(d.expenses || 0),
    profit: Number(d.profit || 0),
    label: d.shortName || d.monthName?.slice(0, 3) || String(d.month),
  }));

  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#cbd5e1' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactINR(v)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Bar
            dataKey="income"
            name="Revenue"
            fill={COLORS.revenue}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            fillOpacity={0.9}
          />
          <Bar
            dataKey="expenses"
            name="Expenses"
            fill={COLORS.expenses}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            fillOpacity={0.85}
          />
          <Line
            type="monotone"
            dataKey="profit"
            name="Net profit / loss"
            stroke={COLORS.profit}
            strokeWidth={2.5}
            dot={(props: any) => {
              const { cx, cy, payload, index } = props;
              if (cx === undefined || cy === undefined) return <g key={index} />;
              const isSelected = selectedMonth === payload.month;
              const positive = payload.profit >= 0;
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 6 : 4}
                  fill={positive ? COLORS.profit : COLORS.loss}
                  stroke="#fff"
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
              );
            }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MonthlyProfitLossChart;
