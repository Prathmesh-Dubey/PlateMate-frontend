// src/pages/SettingsPage.tsx
import React from 'react';
import { Moon, Sun, SettingsIcon } from 'lucide-react';
import { useTheme } from '../theme';

interface SettingsPageProps {
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function SettingsPage({ showToast }: SettingsPageProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const handleToggle = () => {
    toggleTheme();
    showToast('success', isDark ? 'Light mode enabled' : 'Dark mode enabled');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-slate-400" />
          Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage how MessMap looks and behaves on this device.
        </p>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900 mb-1">Appearance</h2>
        <p className="text-xs text-slate-500 mb-5">
          Choose how MessMap looks. Your preference is saved on this device.
        </p>

        <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
              {isDark ? (
                <Moon className="w-4 h-4 text-blue-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Dark Mode</div>
              <div className="text-xs text-slate-500">
                {isDark ? 'Currently on — dark theme across the app' : 'Currently off — using the light theme'}
              </div>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Toggle dark mode"
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isDark ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                isDark ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
