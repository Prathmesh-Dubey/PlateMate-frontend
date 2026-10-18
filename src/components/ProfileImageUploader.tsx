// src/components/ProfileImageUploader.tsx - reusable avatar picker (local upload OR image URL)
import React, { useEffect, useRef, useState } from 'react';
import { Camera, Link2, Loader2, Trash2, Upload, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { useImageCompression } from '../hooks/useImageCompression';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
export const MAX_IMAGE_SIZE_MB = 5;

/** Returns an error message when the file is not an acceptable image, otherwise null */
export const validateImageFile = (file: File): string | null => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const typeOk = ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase());
  const extOk = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
  if (!typeOk && !extOk) {
    return 'Unsupported file type. Please choose a JPG, PNG, WebP or GIF image.';
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${MAX_IMAGE_SIZE_MB} MB.`;
  }
  return null;
};

/** Returns an error message when the URL is not a valid http(s) URL, otherwise null */
export const validateImageUrl = (value: string): string | null => {
  const v = value.trim();
  if (!v) return 'Please enter an image URL.';
  if (v.length > 2048) return 'The URL is too long.';
  if (/^(blob|data|javascript):/i.test(v)) return 'Temporary browser links are not allowed. Use a public image URL.';
  try {
    const url = new URL(v);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'The URL must start with http:// or https://';
    }
    if (!url.hostname) return 'The URL must include a host name.';
    return null;
  } catch {
    return 'Please enter a valid URL (e.g. https://example.com/photo.jpg).';
  }
};

interface ProfileImageUploaderProps {
  /** Currently stored image reference (relative /uploads path or absolute URL) */
  currentUrl?: string | null;
  name?: string | null;
  /** Called with the (compressed) file; must persist it and resolve when done */
  onUpload: (file: File) => Promise<void>;
  /** Called with a validated http(s) URL; must persist it and resolve when done */
  onSetUrl: (url: string) => Promise<void>;
  /** Optional: remove the current picture */
  onRemove?: () => Promise<void>;
  disabled?: boolean;
  size?: 'lg' | 'xl' | '2xl';
  /** Text shown under the controls, e.g. "Applied after the member is saved" */
  hint?: string;
  className?: string;
  /** Message shown after a successful upload / URL save */
  successMessage?: string;
}

export const ProfileImageUploader: React.FC<ProfileImageUploaderProps> = ({
  currentUrl,
  name,
  onUpload,
  onSetUrl,
  onRemove,
  disabled = false,
  size = 'xl',
  hint,
  className = '',
  successMessage = 'Profile picture saved.',
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlPreviewState, setUrlPreviewState] = useState<'idle' | 'checking' | 'ok' | 'failed'>('idle');
  const [busy, setBusy] = useState<'upload' | 'url' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { compressImage } = useImageCompression();

  // Revoke object URLs when the preview changes / component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Soft preview check for URLs (does not block saving - some hosts block hotlinking)
  useEffect(() => {
    const value = urlInput.trim();
    if (mode !== 'url' || !value || validateImageUrl(value)) {
      setUrlPreviewState('idle');
      return;
    }
    let cancelled = false;
    setUrlPreviewState('checking');
    const img = new Image();
    const timer = window.setTimeout(() => {
      if (!cancelled) setUrlPreviewState('failed');
    }, 8000);
    img.onload = () => {
      if (!cancelled) setUrlPreviewState('ok');
      window.clearTimeout(timer);
    };
    img.onerror = () => {
      if (!cancelled) setUrlPreviewState('failed');
      window.clearTimeout(timer);
    };
    img.src = value;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [urlInput, mode]);

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetMessages();
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validation = validateImageFile(file);
    if (validation) {
      setError(validation);
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please choose an image first.');
      return;
    }
    resetMessages();
    setBusy('upload');
    try {
      // Shrink large photos client side so uploads stay fast; the server validates again
      const prepared = await compressImage(selectedFile, { maxWidth: 800, maxHeight: 800, quality: 0.85, maxSizeMB: 1 });
      await onUpload(prepared);
      setSuccess(successMessage);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleSetUrl = async () => {
    const value = urlInput.trim();
    const validation = validateImageUrl(value);
    if (validation) {
      setError(validation);
      return;
    }
    resetMessages();
    setBusy('url');
    try {
      await onSetUrl(value);
      setSuccess(successMessage);
      setUrlInput('');
    } catch (err: any) {
      setError(err?.message || 'Could not save the image URL.');
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    resetMessages();
    setBusy('remove');
    try {
      await onRemove();
      setSuccess('Profile picture removed.');
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      setError(err?.message || 'Could not remove the picture.');
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy !== null;
  const displayedSrc = previewUrl || (mode === 'url' && urlPreviewState === 'ok' ? urlInput.trim() : currentUrl);

  return (
    <div className={`flex flex-col sm:flex-row gap-4 ${className}`}>
      {/* Preview */}
      <div className="relative shrink-0 self-center sm:self-start">
        <Avatar src={displayedSrc} name={name} size={size} className="ring-4 ring-white shadow-md" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isBusy}
          title="Choose a photo"
          className="absolute -bottom-1 -right-1 p-2 rounded-full bg-blue-600 text-white shadow hover:bg-blue-700 disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
        {busy === 'upload' && (
          <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setMode('upload'); resetMessages(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${mode === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          <button
            type="button"
            onClick={() => { setMode('url'); resetMessages(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${mode === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Link2 className="w-3.5 h-3.5" /> Image URL
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isBusy}
        />

        {mode === 'upload' ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isBusy}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                {selectedFile ? 'Choose another' : 'Choose image'}
              </button>
              {selectedFile && (
                <>
                  <span className="text-xs text-slate-600 truncate max-w-[180px]" title={selectedFile.name}>
                    {selectedFile.name} · {(selectedFile.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={disabled || isBusy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {busy === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {busy === 'upload' ? 'Uploading…' : 'Save photo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); resetMessages(); }}
                    disabled={isBusy}
                    className="p-1.5 text-slate-400 hover:text-slate-700"
                    title="Discard selection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-400">JPG, PNG, WebP or GIF · up to {MAX_IMAGE_SIZE_MB} MB</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); resetMessages(); }}
                placeholder="https://example.com/photo.jpg"
                disabled={disabled || isBusy}
                className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSetUrl}
                disabled={disabled || isBusy || !urlInput.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {busy === 'url' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                {busy === 'url' ? 'Saving…' : 'Use URL'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {urlPreviewState === 'checking' && 'Checking the image…'}
              {urlPreviewState === 'ok' && <span className="text-emerald-600">Image preview loaded successfully.</span>}
              {urlPreviewState === 'failed' && (
                <span className="text-amber-600">Could not load a preview from this URL. You can still save it if the link is correct.</span>
              )}
              {urlPreviewState === 'idle' && 'Paste a direct link to a publicly accessible image.'}
            </p>
          </div>
        )}

        {onRemove && currentUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || isBusy}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 disabled:opacity-50"
          >
            {busy === 'remove' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Remove current picture
          </button>
        )}

        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}

        {error && (
          <div className="flex items-start gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileImageUploader;
