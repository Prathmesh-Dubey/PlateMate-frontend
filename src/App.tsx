// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Navigation, type PageId } from './components/Navigation';
import { Header } from './components/Header';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';

import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { TotalExpensesPage } from './pages/TotalExpensesPage';
import { StockPage } from './pages/StockPage';
import { StaffPage } from './pages/StaffPage';
import { BillingPage } from './pages/BillingPage';
import { CollegeBillingPage } from './pages/CollegeBillingPage';
import { PartiesPage } from './pages/PartiesPage';
import { MenusPage } from './pages/MenusPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

import api, { SESSION_EXPIRED_EVENT } from './api';
import type { AuthResponse } from './types';

/** Keeps the cached user object free of tokens (tokens live in their own storage keys). */
const toStoredUser = (data: any) => {
  if (!data) return null;
  const { token, refreshToken, ...profile } = data;
  return profile;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [user, setUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, text }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /** Persists profile changes (name, phone, picture) so the sidebar and profile stay in sync. */
  const handleUserUpdate = useCallback((data: AuthResponse | any) => {
    const stored = toStoredUser(data);
    if (!stored) return;
    setUser((prev: any) => {
      const merged = { ...(prev || {}), ...stored };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    api.clearTokens();
    setIsAuthenticated(false);
    setUser(null);
    setActivePage('dashboard');
    setIsSidebarOpen(false);
  }, []);

  // Restore the session on load and refresh the profile (picture, name) from the server
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        api.setTokens(token, localStorage.getItem('refreshToken') || '');
        api.auth
          .getProfile()
          .then(fresh => handleUserUpdate(fresh))
          .catch(() => {
            // An expired session is handled by the SESSION_EXPIRED_EVENT listener
          });
      } catch {
        clearSession();
      }
    }
  }, [handleUserUpdate, clearSession]);

  // Log out automatically when the API reports that the session cannot be refreshed
  useEffect(() => {
    const onExpired = () => {
      if (!isAuthenticated) return;
      clearSession();
      showToast('info', 'Your session has expired. Please login again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [isAuthenticated, clearSession, showToast]);

  // Poll or check low stock items periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkStock = async () => {
      try {
        // Same request the Stock page makes (served from the shared cache), with the
        // low-stock count calculated here instead of a second backend call.
        const response = await api.stock.item.getAll();
        const low = Array.isArray(response)
          ? response.filter((i) => i && i.currentStock <= i.minimumStockLevel)
          : [];
        setLowStockCount(low.length);
      } catch {
        // silent fallback
      }
    };
    checkStock();
  }, [activePage, isAuthenticated]);

  const handleLoginSuccess = (token: string, refreshToken: string, userData: any) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    const stored = toStoredUser(userData);
    localStorage.setItem('user', JSON.stringify(stored));

    api.setTokens(token, refreshToken);

    setUser(stored);
    setIsAuthenticated(true);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    // Best effort server side invalidation of the refresh token
    api.auth.logout().catch(() => {});
    clearSession();
    showToast('info', 'Logged out successfully');
  };

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} showToast={showToast} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Authenticated App
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Sidebar Navigation (drawer below the lg breakpoint) */}
      <Navigation
        activePage={activePage}
        onSelectPage={(page) => {
          setActivePage(page);
          setSearchTerm('');
        }}
        lowStockCount={lowStockCount}
        user={user}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          activePage={activePage}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          todayDateStr={todayDateStr}
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsSidebarOpen(open => !open)}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className={activePage === 'stock' ? 'w-full' : 'w-full type-scale-lg'}>
            <ErrorBoundary key={activePage}>
              {activePage === 'college-billing' && (
                <CollegeBillingPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'dashboard' && (
                <DashboardPage onNavigate={setActivePage} showToast={showToast} searchTerm={searchTerm} />
              )}
              {activePage === 'stock' && (
                <StockPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'expenses' && (
                <ExpensesPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'total-expenses' && (
                <TotalExpensesPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'staff' && (
                <StaffPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'billing' && (
                <BillingPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'parties' && (
                <PartiesPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'menus' && (
                <MenusPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'profile' && (
                <ProfilePage user={user} showToast={showToast} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              )}
              {activePage === 'settings' && (
                <SettingsPage showToast={showToast} />
              )}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
