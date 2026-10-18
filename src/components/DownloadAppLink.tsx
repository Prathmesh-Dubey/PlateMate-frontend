// src/components/DownloadAppLink.tsx
import React from 'react';
import { Download, Smartphone, Share2, Check } from 'lucide-react';
import { APP_DOWNLOAD_URL, APP_DOWNLOAD_FILENAME, isNativeApp } from '../config/appDownload';

interface DownloadAppLinkProps {
  /** 'nav' = sidebar row, 'banner' = prominent card (login page / mobile) */
  variant?: 'nav' | 'banner';
  onClick?: () => void;
  className?: string;
}

/** Direct-download link (the `download` attribute makes the file start downloading immediately). */
export const DownloadAppLink: React.FC<DownloadAppLinkProps> = ({ variant = 'nav', onClick, className = '' }) => {
  // Already inside the installed app, or no link configured yet: show nothing
  if (!APP_DOWNLOAD_URL || isNativeApp()) return null;

  const linkProps = {
    href: APP_DOWNLOAD_URL,
    download: APP_DOWNLOAD_FILENAME,
    rel: 'noopener noreferrer',
    onClick,
  };

  if (variant === 'banner') {
    return (
      <a
        {...linkProps}
        className={`flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 active:bg-blue-100 ${className}`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Smartphone className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Get the PlateMate app</span>
          <span className="block text-xs text-blue-700/80">Tap to download instantly</span>
        </span>
        <Download className="h-5 w-5 shrink-0" />
      </a>
    );
  }

  return (
    <a
      {...linkProps}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors ${className}`}
    >
      <Download className="w-4 h-4 shrink-0 text-slate-400" />
      <span>Download App</span>
    </a>
  );
};

/** Opens the phone's share sheet (WhatsApp, Telegram, SMS, ...) with the direct download link. */
export const ShareAppButton: React.FC<{ onClick?: () => void; className?: string }> = ({ onClick, className = '' }) => {
  const [status, setStatus] = React.useState<'idle' | 'copied' | 'nolink'>('idle');

  const flash = (s: 'copied' | 'nolink') => {
    setStatus(s);
    window.setTimeout(() => setStatus('idle'), 2500);
  };

  const handleShare = async () => {
    onClick?.();
    if (!APP_DOWNLOAD_URL) {
      flash('nolink');
      return;
    }
    const text = 'Download the PlateMate app (tap the link to start the download):';

    // Laptop / desktop: no social-media share sheet - open the link in the browser (starts the download)
    // and copy it so it can be pasted anywhere.
    const isPhone = isNativeApp() || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!isPhone) {
      window.open(APP_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
      try {
        await navigator.clipboard.writeText(APP_DOWNLOAD_URL);
        flash('copied');
      } catch {
        /* copying is optional */
      }
      return;
    }

    try {
      if (isNativeApp()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: 'PlateMate app', text, url: APP_DOWNLOAD_URL, dialogTitle: 'Share PlateMate app' });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'PlateMate app', text, url: APP_DOWNLOAD_URL });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${APP_DOWNLOAD_URL}`);
      flash('copied');
    } catch (err: any) {
      // Closing the share sheet throws an AbortError / "Share canceled": not a failure
      if (!/abort|cancel/i.test(String(err?.name || '') + String(err?.message || ''))) {
        try {
          await navigator.clipboard.writeText(`${text} ${APP_DOWNLOAD_URL}`);
          flash('copied');
        } catch {
          /* nothing more to try */
        }
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors text-left ${className}`}
    >
      {status === 'copied' ? <Check className="w-4 h-4 shrink-0 text-green-600" /> : <Share2 className="w-4 h-4 shrink-0 text-slate-400" />}
      <span>{status === 'copied' ? 'Link copied' : status === 'nolink' ? 'Download link not set yet' : 'Share App'}</span>
    </button>
  );
};
