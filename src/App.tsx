// src/App.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigation, type PageId } from './components/Navigation';
import { Header } from './components/Header';
import { MobileTabBar } from './components/MobileTabBar';
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
import { notifyStockAlerts } from './utils/notifications';
import { isDemoMode, setDemoMode, DEMO_USER } from './demo/demoMode';
import { useBackClose, ModalBackGuard, backState } from './hooks/backNavigation';
import { isNativeApp } from './config/appDownload';
import { FlaskConical } from 'lucide-react';
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ---- Back button / gesture: walk back through visited pages instead of leaving the app ----
  const [navDepth, setNavDepth] = useState(0); // pages pushed on top of the first screen
  const activePageRef = useRef<PageId>('dashboard');
  const navigateTo = useCallback((page: PageId) => {
    if (activePageRef.current !== page) {
      activePageRef.current = page;
      setNavDepth(d => d + 1);
      const st = window.history.state;
      // Picking a page from the open drawer replaces the drawer's history entry instead of stacking another
      if (st && st.backLayer) window.history.replaceState({ page }, '');
      else window.history.pushState({ page }, '');
    }
    setActivePage(page);
  }, []);

  useEffect(() => {
    window.history.replaceState({ page: 'dashboard' }, '');
    const onPop = (e: PopStateEvent) => {
      if (e.state && e.state.page) {
        if (activePageRef.current !== e.state.page) setNavDepth(d => Math.max(0, d - 1));
        activePageRef.current = e.state.page as PageId;
        setActivePage(e.state.page as PageId);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useBackClose(isSidebarOpen, () => setIsSidebarOpen(false));

  useEffect(() => {
    backState.pages = navDepth;
  }, [navDepth]);


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

  // Android hardware back button / gesture inside the installed app: close layers, then go back page by
  // page, and only exit on a second press from the first screen.
  useEffect(() => {
    if (!isNativeApp()) return;
    let removed = false;
    let handle: { remove: () => void } | undefined;
    let lastBack = 0;
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('backButton', () => {
        if (backState.layers > 0 || backState.pages > 0) {
          window.history.back();
          return;
        }
        const now = Date.now();
        if (now - lastBack < 2000) {
          CapApp.exitApp();
        } else {
          lastBack = now;
          showToast('info', 'Press back again to exit');
        }
      }).then(h => {
        if (removed) h.remove();
        else handle = h;
      });
    });
    return () => {
      removed = true;
      handle?.remove();
    };
  }, [showToast]);

  /** Persists profile changes (name, phone, picture) so the sidebar and profile stay in sync. */
  const handleUserUpdate = useCallback((data: AuthResponse | any) => {
    const stored = toStoredUser(data);
    if (!stored) return;
    setUser((prev: any) => {
      const merged = { ...(prev || {}), ...stored };
      if (!isDemoMode()) localStorage.setItem('user', JSON.stringify(merged)); // demo data is never saved
      return merged;
    });
  }, []);

  /** Manual reload: drops every saved response and remounts the current page so it fetches fresh data. */
  const handleRefresh = useCallback(() => {
    api.clearCache();
    setIsRefreshing(true);
    setRefreshKey(k => k + 1);
    window.setTimeout(() => setIsRefreshing(false), 900);
    showToast('success', 'Data refreshed');
  }, [showToast]);

  const clearSession = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    api.clearTokens();
    setIsAuthenticated(false);
    setUser(null);
    activePageRef.current = 'dashboard';
    setNavDepth(0);
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
        api.setTokens(token, localStorage.getItem('refreshToken') || '', true);
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
        if (Array.isArray(response)) notifyStockAlerts(response);
      } catch {
        // silent fallback
      }
    };
    checkStock();

    // Keep checking while the app is open, and again whenever it returns to the foreground
    const timer = window.setInterval(checkStock, 10 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkStock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activePage, isAuthenticated, refreshKey]);

  const handleLoginSuccess = (token: string, refreshToken: string, userData: any) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    const stored = toStoredUser(userData);
    localStorage.setItem('user', JSON.stringify(stored));

    api.setTokens(token, refreshToken);

    setUser(stored);
    setIsAuthenticated(true);
    activePageRef.current = 'dashboard';
    setNavDepth(0);
    setActivePage('dashboard');
  };

  /** Visitor demo: sample data served from memory, nothing stored or sent to the real server. */
  const handleStartDemo = () => {
    api.clearTokens();
    setDemoMode(true);
    api.clearCache();
    setUser(DEMO_USER);
    activePageRef.current = 'dashboard';
    setNavDepth(0);
    setActivePage('dashboard');
    setIsAuthenticated(true);
  };

  const handleExitDemo = () => {
    setDemoMode(false);
    api.clearCache();
    setIsAuthenticated(false);
    setUser(null);
    activePageRef.current = 'dashboard';
    setNavDepth(0);
    setActivePage('dashboard');
    setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    if (isDemoMode()) {
      handleExitDemo();
      return;
    }
    // Best effort server side invalidation of the refresh token
    api.auth.logout().catch(() => {});
    clearSession();
    showToast('info', 'Logged out successfully');
  };

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} showToast={showToast} onStartDemo={handleStartDemo} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Authenticated App
  return (
    <div className="app-shell flex w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Sidebar Navigation (drawer below the lg breakpoint) */}
      <Navigation
        activePage={activePage}
        onSelectPage={(page) => {
          navigateTo(page);
          setSearchTerm('');
        }}
        lowStockCount={lowStockCount}
        user={user}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
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
          canGoBack={navDepth > 0}
          onBack={() => window.history.back()}
        />

        {isDemoMode() && (
          <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-xs text-amber-900 print:hidden">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate sm:whitespace-normal">
              <strong>Demo mode</strong> – sample data only. Nothing is saved; reloading clears it.
            </span>
            <button type="button" onClick={handleExitDemo} className="shrink-0 rounded-md bg-amber-200/70 px-2.5 py-1 font-semibold hover:bg-amber-200">
              Exit demo
            </button>
          </div>
        )}

        {/* Scrollable View Container */}
        <main className="app-main flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 md:p-8">
          <div className={activePage === 'stock' ? 'w-full' : 'w-full type-scale-lg'}>
            <ErrorBoundary key={`${activePage}-${refreshKey}`}>
              {activePage === 'college-billing' && (
                <CollegeBillingPage searchTerm={searchTerm} showToast={showToast} />
              )}
              {activePage === 'dashboard' && (
                <DashboardPage onNavigate={navigateTo} showToast={showToast} searchTerm={searchTerm} />
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

      {/* Bottom tab bar (phones only) */}
      <MobileTabBar
        activePage={activePage}
        onSelectPage={(page) => {
          navigateTo(page);
          setSearchTerm('');
        }}
        onOpenMore={() => setIsSidebarOpen(true)}
        lowStockCount={lowStockCount}
      />

      <ModalBackGuard />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
