// src/components/Toast.tsx
import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: { bg: 'bg-emerald-600 text-white', icon: CheckCircle2 },
    error: { bg: 'bg-rose-600 text-white', icon: AlertCircle },
    info: { bg: 'bg-slate-800 text-white', icon: Info },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div className={`pointer-events-auto flex items-center justify-between px-4 py-3 rounded-lg shadow-lg ${config.bg} text-xs font-medium space-x-3 transition-all transform translate-y-0`}>
      <div className="flex items-center space-x-2">
        <Icon className="w-4 h-4 shrink-0" />
        <span>{toast.text}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/80 hover:text-white shrink-0 p-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
