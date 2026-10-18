// src/pages/ProfilePage.tsx - account profile (view / edit, avatar upload or URL, password)
import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Fingerprint,
  Key,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  Save,
  Shield,
  User,
  X,
} from 'lucide-react';
import api from '../api';
import type { AuthResponse } from '../types';
import { Avatar } from '../components/Avatar';
import { ProfileImageUploader } from '../components/ProfileImageUploader';
import { formatDate, formatDateTime } from '../utils/format';

interface ProfilePageProps {
  user: any;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
  onLogout: () => void;
  /** Called whenever the profile changes so the sidebar / app state stay in sync */
  onUserUpdate?: (user: AuthResponse) => void;
}

interface EditData {
  fullName: string;
  phoneNumber: string;
}

interface FieldErrors {
  fullName?: string;
  phoneNumber?: string;
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const formatRole = (role?: string) => {
  if (!role) return 'User';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};

export function ProfilePage({ user, showToast, onLogout, onUserUpdate }: ProfilePageProps) {
  const [profile, setProfile] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<EditData>({ fullName: '', phoneNumber: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const applyProfile = (next: AuthResponse) => {
    setProfile(next);
    setEditData({ fullName: next.fullName || '', phoneNumber: next.phoneNumber || '' });
    onUserUpdate?.(next);
  };

  const loadProfile = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fresh = await api.auth.getProfile();
      applyProfile(fresh);
    } catch (err) {
      const msg = errorMessage(err, 'Could not load your profile from the server');
      setLoadError(msg);
      if (user) {
        // Fall back to the cached login data so the page is still usable
        setProfile(user as AuthResponse);
        setEditData({ fullName: user.fullName || '', phoneNumber: user.phoneNumber || '' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- EDIT ----------------
  const validate = (data: EditData): FieldErrors => {
    const errors: FieldErrors = {};
    const name = data.fullName.trim();
    if (name.length < 2) errors.fullName = 'Full name must be at least 2 characters';
    else if (name.length > 100) errors.fullName = 'Full name must be at most 100 characters';
    const phone = data.phoneNumber.trim();
    if (!phone) errors.phoneNumber = 'Phone number is required';
    else if (!/^\+?[0-9]{10,15}$/.test(phone)) errors.phoneNumber = 'Enter 10 to 15 digits (optional leading +)';
    return errors;
  };

  const startEdit = () => {
    setEditData({ fullName: profile?.fullName || '', phoneNumber: profile?.phoneNumber || '' });
    setFieldErrors({});
    setSaveError(null);
    setSaveSuccess(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFieldErrors({});
    setSaveError(null);
    setEditData({ fullName: profile?.fullName || '', phoneNumber: profile?.phoneNumber || '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(editData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const updated = await api.auth.updateProfile({
        fullName: editData.fullName.trim(),
        phoneNumber: editData.phoneNumber.trim(),
      });
      applyProfile(updated);
      setIsEditing(false);
      setSaveSuccess('Your profile has been updated.');
      showToast('success', 'Profile updated successfully');
    } catch (err) {
      const msg = errorMessage(err, 'Failed to update profile');
      setSaveError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------------- PICTURE ----------------
  const handleUploadPicture = async (file: File) => {
    const updated = await api.auth.uploadProfileImage(file);
    applyProfile(updated);
    showToast('success', 'Profile picture updated');
  };

  const handleSetPictureUrl = async (url: string) => {
    const updated = await api.auth.setProfileImageUrl(url);
    applyProfile(updated);
    showToast('success', 'Profile picture updated');
  };

  const handleRemovePicture = async () => {
    const updated = await api.auth.removeProfileImage();
    applyProfile(updated);
    showToast('info', 'Profile picture removed');
  };

  // ---------------- PASSWORD ----------------
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    if (passwordData.newPassword === passwordData.currentPassword) {
      setPasswordError('New password must be different from the current password');
      return;
    }

    setPasswordSaving(true);
    try {
      await api.auth.changePassword(passwordData);
      showToast('success', 'Password changed successfully');
      setShowChangePassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const msg = errorMessage(err, 'Failed to change password');
      setPasswordError(msg);
      showToast('error', msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  // ---------------- RENDER ----------------
  if (loading && !profile) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse" aria-busy="true">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="h-32 bg-slate-200" />
          <div className="p-6 flex gap-5">
            <div className="w-24 h-24 rounded-full bg-slate-200 -mt-16 ring-4 ring-white" />
            <div className="flex-1 space-y-2 pt-2">
              <div className="h-5 w-48 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-56 bg-white rounded-xl border border-slate-200" />
          <div className="h-56 bg-white rounded-xl border border-slate-200" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-xl border border-rose-200 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Profile unavailable</h2>
        <p className="text-sm text-slate-500 mt-1">{loadError || 'We could not load your account details.'}</p>
        <button
          onClick={loadProfile}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  const isVerified = !!profile.emailVerified;
  const isActive = profile.enabled !== false;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {loadError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Showing cached account details. {loadError}</span>
          </div>
          <button onClick={loadProfile} className="font-semibold hover:underline shrink-0">
            Reload
          </button>
        </div>
      )}

      {/* Identity card */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="h-28 sm:h-36 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
        <div className="px-5 sm:px-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-14">
            <Avatar
              src={profile.profilePictureUrl}
              name={profile.fullName}
              size="xl"
              className="ring-4 ring-white shadow-lg bg-white"
              colorClass="bg-blue-50 text-blue-700"
            />
            <div className="flex-1 min-w-0 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900 truncate">{profile.fullName}</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <BadgeCheck className="w-3 h-3" />
                  {isVerified ? 'Verified' : 'Verification pending'}
                </span>
              </div>
              <p className="text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> {formatRole(profile.role)}
                </span>
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="w-3.5 h-3.5" /> {profile.email}
                </span>
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {!isEditing ? (
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
              ) : (
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Profile picture */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900">Profile Photo</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          Upload a picture from your device or paste an image link. The picture is stored with your account and shown in the sidebar.
        </p>
        <ProfileImageUploader
          currentUrl={profile.profilePictureUrl}
          name={profile.fullName}
          onUpload={handleUploadPicture}
          onSetUrl={handleSetPictureUrl}
          onRemove={handleRemovePicture}
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal information */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Personal Information
            </h3>
            {isEditing && <span className="text-[11px] font-semibold text-blue-600">Editing</span>}
          </div>

          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <Field label="Full Name" icon={User}>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editData.fullName}
                    onChange={e => setEditData({ ...editData, fullName: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      fieldErrors.fullName ? 'border-rose-400' : 'border-slate-300'
                    }`}
                    maxLength={100}
                    autoFocus
                  />
                  {fieldErrors.fullName && <FieldError text={fieldErrors.fullName} />}
                </>
              ) : (
                <p className="text-sm text-slate-900">{profile.fullName}</p>
              )}
            </Field>

            <Field label="Email" icon={Mail} hint="Email cannot be changed here">
              <p className="text-sm text-slate-900 flex items-center gap-2 break-all">
                {profile.email}
                {isVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </p>
            </Field>

            <Field label="Phone Number" icon={Phone}>
              {isEditing ? (
                <>
                  <input
                    type="tel"
                    value={editData.phoneNumber}
                    onChange={e => setEditData({ ...editData, phoneNumber: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      fieldErrors.phoneNumber ? 'border-rose-400' : 'border-slate-300'
                    }`}
                    placeholder="9876543210"
                    maxLength={16}
                  />
                  {fieldErrors.phoneNumber && <FieldError text={fieldErrors.phoneNumber} />}
                </>
              ) : (
                <p className="text-sm text-slate-900">{profile.phoneNumber || 'Not provided'}</p>
              )}
            </Field>

            {saveError && (
              <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            {saveSuccess && !isEditing && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {isEditing && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </section>

        {/* Account */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-indigo-600" /> Account &amp; Security
          </h3>

          <dl className="space-y-3">
            <InfoRow icon={Shield} label="Role" value={formatRole(profile.role)} />
            <InfoRow
              icon={CheckCircle2}
              label="Account status"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              }
            />
            <InfoRow
              icon={BadgeCheck}
              label="Verification"
              value={`Email ${profile.emailVerified ? 'verified' : 'not verified'} · Phone ${profile.phoneVerified ? 'verified' : 'not verified'}`}
            />
            <InfoRow icon={Calendar} label="Member since" value={formatDate(profile.createdAt)} />
            <InfoRow icon={Clock} label="Last login" value={formatDateTime(profile.lastLoginAt)} />
            <InfoRow icon={Fingerprint} label="User ID" value={<span className="font-mono text-[11px] break-all">{String(profile.id)}</span>} />
          </dl>

          <div className="mt-5 pt-4 border-t border-slate-100">
            {!showChangePassword ? (
              <button
                onClick={() => {
                  setShowChangePassword(true);
                  setPasswordError(null);
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                <Key className="w-4 h-4" /> Change Password
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Key className="w-4 h-4 text-slate-500" /> Change Password
                  </h4>
                  <button type="button" onClick={() => setShowChangePassword(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <PasswordInput
                  label="Current password"
                  value={passwordData.currentPassword}
                  onChange={v => setPasswordData({ ...passwordData, currentPassword: v })}
                />
                <PasswordInput
                  label="New password"
                  value={passwordData.newPassword}
                  onChange={v => setPasswordData({ ...passwordData, newPassword: v })}
                  placeholder="At least 6 characters"
                />
                <PasswordInput
                  label="Confirm new password"
                  value={passwordData.confirmPassword}
                  onChange={v => setPasswordData({ ...passwordData, confirmPassword: v })}
                />
                {passwordError && (
                  <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    {passwordSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {passwordSaving ? 'Updating…' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* Session */}
      <section className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-slate-600">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="truncate">
            Signed in as <strong className="text-slate-900">{profile.email}</strong>
          </span>
        </div>
        <button
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 font-medium shrink-0"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </section>
    </div>
  );
}

// ---------------- Sub-components ----------------

const Field: React.FC<{ label: string; icon: React.ElementType; hint?: string; children: React.ReactNode }> = ({
  label,
  icon: Icon,
  hint,
  children,
}) => (
  <div>
    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
      <Icon className="w-3.5 h-3.5 text-slate-400" /> {label}
    </label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

const FieldError: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
    <AlertCircle className="w-3 h-3" /> {text}
  </p>
);

const InfoRow: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
      <Icon className="w-3.5 h-3.5" />
    </div>
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-slate-900 break-words">{value}</dd>
    </div>
  </div>
);

const PasswordInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({
  label,
  value,
  onChange,
  placeholder,
}) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
    <input
      type="password"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
      placeholder={placeholder}
      required
      minLength={6}
      autoComplete="new-password"
    />
  </div>
);

export default ProfilePage;
