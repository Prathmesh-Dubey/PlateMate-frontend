// src/components/Header.tsx
import React from 'react';
import { Calendar, ShieldCheck, Search, Menu } from 'lucide-react';
import type { PageId } from './Navigation';

interface HeaderProps {
  activePage: PageId;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  todayDateStr: string;
  user?: any;
  onLogout?: () => void;
  /** Opens the navigation drawer on small screens */
  onToggleSidebar?: () => void;
}

const pageTitles: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Monthly Mess', subtitle: 'Manage candidate start/end dates, monthly fees, membership status & renewals' },
  stock: { title: 'Stock Management', subtitle: 'Track available stock, purchases, usage, remaining inventory, low alerts & expiry history' },
  expenses: { title: 'Day-to-day Expenses (Kirkol Kharcha)', subtitle: 'Quick log for daily & weekly small payouts and miscellaneous mess expenses' },
  'total-expenses': { title: 'Total Categorized Expenses', subtitle: 'Comprehensive expense tracking by Vegetables, Grocery, Dairy, Gas Cylinders, Utilities & Maintenance' },
  staff: { title: 'Staff & Salaries', subtitle: 'Manage staff profiles, monthly salaries, payments, and advance loans' },
  parties: { title: 'Party Bookings', subtitle: 'Special event catering, thali rates, headcount, discounts & payment tracking' },
  menus: { title: 'Menu Planner', subtitle: 'Schedule daily recipes, vegetarian markers, and seasonal specials' },
  billing: { title: 'Financial Billing & P&L', subtitle: 'Live billing dashboard: college billing, staff salary, expenses, mess fees, party income & monthly profit / loss' },
  'college-billing': { title: 'College Billing', subtitle: 'Monthly receivables, partial & full payments, and outstanding balances receivable from colleges' },
  profile: { title: 'Account Profile', subtitle: 'Manage your personal details, profile photo, credentials, and settings' },
  settings: { title: 'Settings', subtitle: 'Manage how MessMap looks and behaves on this device' },
};

export const Header: React.FC<HeaderProps> = ({ activePage, searchTerm, onSearchChange, todayDateStr, onToggleSidebar }) => {
  const current = pageTitles[activePage] || { title: 'Mess Management', subtitle: 'Hostel System' };

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0 print:hidden">
      <div className="flex items-start gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 -ml-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">{current.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Global Search */}
        <div className="relative flex-1 min-w-[180px] sm:flex-none sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Date pill */}
        <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-medium text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{todayDateStr}</span>
        </div>

        {/* Status chip */}
        <div className="hidden md:flex items-center px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-tight border border-green-200">
          <ShieldCheck className="w-3.5 h-3.5 mr-1 text-green-700" />
          <span>System Active</span>
        </div>
      </div>
    </header>
  );
};
