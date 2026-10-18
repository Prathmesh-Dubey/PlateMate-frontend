// src/components/Navigation.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Boxes,
  UserCog,
  CreditCard,
  PartyPopper,
  BookOpen,
  BarChart3,
  User,
  LogOut,
  ChevronUp,
  ChevronDown,
  Shield,
  Building2,
  X,
  SettingsIcon,
} from 'lucide-react';
import { Avatar } from './Avatar';

export type PageId =
  | 'billing'
  | 'dashboard'
  | 'stock'
  | 'expenses'
  | 'total-expenses'
  | 'staff'
  | 'parties'
  | 'menus'
  | 'college-billing'
  | 'profile'
  | 'settings';

interface NavigationProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  lowStockCount: number;
  user?: any;
  onLogout?: () => void;
  /** Mobile / tablet drawer state (the sidebar is always visible from the lg breakpoint) */
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems: Array<{ id: PageId; label: string; icon: React.ElementType; section: 'top' | 'ops' | 'finance' }> = [
  { id: 'college-billing', label: 'College Billing', icon: Building2, section: 'top' },
  { id: 'dashboard', label: 'Monthly Mess', icon: LayoutDashboard, section: 'ops' },
  { id: 'stock', label: 'Stock', icon: Boxes, section: 'ops' },
  { id: 'expenses', label: 'Day-to-day Expenses', icon: Receipt, section: 'ops' },
  { id: 'total-expenses', label: 'Total Expenses', icon: BarChart3, section: 'ops' },
  { id: 'staff', label: 'Staff & Salaries', icon: UserCog, section: 'finance' },
  { id: 'parties', label: 'Party Bookings', icon: PartyPopper, section: 'finance' },
  { id: 'menus', label: 'Menu Planner', icon: BookOpen, section: 'finance' },
  { id: 'billing', label: 'Billing', icon: CreditCard, section: 'finance' },
];

export const Navigation: React.FC<NavigationProps> = ({
  activePage,
  onSelectPage,
  lowStockCount,
  user,
  onLogout,
  isOpen = false,
  onClose,
}) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const topItems = navItems.filter(i => i.section === 'top');
  const opsItems = navItems.filter(i => i.section === 'ops');
  const financeItems = navItems.filter(i => i.section === 'finance');

  // Close the account menu when clicking outside of it
  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const handler = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isAccountMenuOpen]);

  const getUserRole = () => {
    if (user?.role) {
      return user.role.charAt(0) + user.role.slice(1).toLowerCase();
    }
    return 'User';
  };

  const selectPage = (page: PageId) => {
    onSelectPage(page);
    setIsAccountMenuOpen(false);
    onClose?.();
  };

  const renderItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;
    return (
      <button
        key={item.id}
        onClick={() => selectPage(item.id)}
        className={`flex items-center justify-between px-3 py-2 rounded-md font-medium text-sm transition-colors text-left ${
          isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
          <span>{item.label}</span>
        </div>
        {item.id === 'stock' && lowStockCount > 0 && (
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              isActive ? 'bg-blue-200 text-blue-800' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {lowStockCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Backdrop for the mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none h-screen transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm">
              <img src="/logo.png" alt="PlateMate logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900">PlateMate</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Pro</span>
              </div>
              <span className="text-xs text-slate-500">Mess Management System</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
          {topItems.map(renderItem)}
          {opsItems.map(renderItem)}

          {financeItems.map(renderItem)}
        </nav>

        {/* Account section: the only entry point to the profile page */}
        <div className="p-3 border-t border-slate-200">
          <div className="relative" ref={accountMenuRef}>
            <button
              onClick={() => setIsAccountMenuOpen(open => !open)}
              className={`w-full flex items-center justify-between p-2 rounded-lg border transition-colors ${
                activePage === 'profile'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
              }`}
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              title="Account menu"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar src={user?.profilePictureUrl} name={user?.fullName} size="sm" />
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-xs font-semibold text-slate-800 truncate">{user?.fullName || 'Guest User'}</span>
                  <span className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {getUserRole()}
                    {user?.email && <span className="truncate">· {user.email}</span>}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-2 shrink-0">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {isAccountMenuOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {isAccountMenuOpen && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50"
                role="menu"
              >
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-800 truncate">{user?.fullName || 'Guest User'}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email || ''}</div>
                </div>
                <button
                  onClick={() => selectPage('profile')}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    activePage === 'profile' ? 'text-blue-700 font-semibold' : 'text-slate-700'
                  }`}
                  role="menuitem"
                >
                  <User className="w-4 h-4" />
                  My Profile
                </button>
                <button
                  onClick={() => selectPage('settings')}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    activePage === 'settings' ? 'text-blue-700 font-semibold' : 'text-slate-700'
                  }`}
                  role="menuitem"
                >
                  <SettingsIcon className="w-4 h-4" />
                  Settings
                </button>
                <div className="border-t border-slate-200 my-1" />
                <button
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    onClose?.();
                    if (onLogout) onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
