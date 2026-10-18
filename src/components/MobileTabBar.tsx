// src/components/MobileTabBar.tsx - bottom tab bar shown on phones (hidden from the lg breakpoint up)
import React from 'react';
import { Building2, LayoutDashboard, Boxes, Receipt, Menu } from 'lucide-react';
import type { PageId } from './Navigation';

interface MobileTabBarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  onOpenMore: () => void;
  lowStockCount: number;
}

const tabs: Array<{ id: PageId; label: string; icon: React.ElementType }> = [
  { id: 'college-billing', label: 'College', icon: Building2 },
  { id: 'dashboard', label: 'Mess', icon: LayoutDashboard },
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
];

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ activePage, onSelectPage, onOpenMore, lowStockCount }) => {
  const isMoreActive = !tabs.some(t => t.id === activePage);
  const base = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors';

  return (
    <nav
      className="mobile-tabbar fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white lg:hidden print:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = activePage === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectPage(id)}
            className={`${base} ${active ? 'text-blue-700' : 'text-slate-500 active:text-slate-800'}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className={`relative flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-blue-50' : ''}`}>
              <Icon className="h-5 w-5" />
              {id === 'stock' && lowStockCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
                  {lowStockCount > 99 ? '99+' : lowStockCount}
                </span>
              )}
            </span>
            {label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className={`${base} ${isMoreActive ? 'text-blue-700' : 'text-slate-500 active:text-slate-800'}`}
      >
        <span className={`flex h-7 w-12 items-center justify-center rounded-full ${isMoreActive ? 'bg-blue-50' : ''}`}>
          <Menu className="h-5 w-5" />
        </span>
        More
      </button>
    </nav>
  );
};
