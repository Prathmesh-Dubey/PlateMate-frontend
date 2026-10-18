// src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Bell,
  IndianRupee,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Phone,
  Mail,
  CalendarDays,
  LogOut,
  Search,
  X,
} from 'lucide-react';
import api from '../api';
import type { Candidate } from '../types';
import type { PageId } from '../components/Navigation';
import { Avatar } from '../components/Avatar';
import { ProfileImageUploader } from '../components/ProfileImageUploader';
import { ImageLightbox } from '../components/ImageLightbox';
import { resolveImageUrl } from '../utils/format';

interface DashboardProps {
  onNavigate: (page: PageId) => void;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
  searchTerm?: string;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'RENEWABLE';
type CandidateStatus = 'ACTIVE' | 'INACTIVE' | 'LEFT';

interface CandidateForm {
  candidateId: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  joiningDate: string;
  endDate: string;
  monthlyFee: number;
  status: CandidateStatus;
  dietaryPreference: string;
  emergencyContact: string;
  emergencyPhone: string;
  notes: string;
}

/** Normalizes a Candidate's identity — backend may use id, _id, or candidateId */
const resolveCandidateId = (c: Candidate): string | undefined =>
  c.id ||
  (c as unknown as { _id?: string })._id ||
  c.candidateId;

const todayISO = () => new Date().toISOString().split('T')[0];

const oneMonthFromNowISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
};

const buildDefaultForm = (): CandidateForm => ({
  candidateId: '',
  fullName: '',
  phone: '',
  email: '',
  address: '',
  joiningDate: todayISO(),
  endDate: oneMonthFromNowISO(),
  monthlyFee: 3000,
  status: 'ACTIVE',
  dietaryPreference: 'VEG',
  emergencyContact: '',
  emergencyPhone: '',
  notes: '',
});

export const DashboardPage: React.FC<DashboardProps> = ({
  onNavigate,
  showToast,
  searchTerm = '',
}) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [nameFilter, setNameFilter] = useState<string>('');

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [form, setForm] = useState<CandidateForm>(buildDefaultForm());
  const [zoomedCandidate, setZoomedCandidate] = useState<Candidate | null>(null);
  // Photo chosen while adding a new member (applied right after creation)
  const [pendingImage, setPendingImage] = useState<{ file?: File; url?: string; preview?: string } | null>(null);

  // ---------------- FETCH ----------------
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const data = await api.candidate.getAll();
      const all = Array.isArray(data) ? data : [];
      const visible = all.filter(
        (c) =>
          c &&
          !(c as unknown as { isDeleted?: boolean }).isDeleted &&
          !(c as unknown as { deleted?: boolean }).deleted
      );
      setCandidates(visible);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load candidate roster';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- HELPERS ----------------
  const isRenewableDue = (cand: Candidate): boolean => {
    if (!cand) return false;
    if (cand.status === 'INACTIVE' || cand.status === 'LEFT') return true;
    if (!cand.joiningDate) return false;
    const start = new Date(cand.joiningDate);
    if (isNaN(start.getTime())) return false;
    const diffDays = Math.ceil(
      (Date.now() - start.getTime()) / (1000 * 3600 * 24)
    );
    return diffDays >= 25;
  };

  const getMonthEndDate = (cand: Candidate): string => {
    if (cand.endDate) return cand.endDate;
    const start = cand.joiningDate ? new Date(cand.joiningDate) : new Date();
    if (isNaN(start.getTime())) return '-';
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return end.toISOString().split('T')[0];
  };

  // ---------------- KPI COUNTERS ----------------
  const safeCandidates = useMemo(
    () => (Array.isArray(candidates) ? candidates.filter(Boolean) : []),
    [candidates]
  );

  const totalCount = safeCandidates.length;
  const activeCount = safeCandidates.filter((c) => c.status === 'ACTIVE').length;
  const inactiveCount = safeCandidates.filter(
    (c) => c.status === 'INACTIVE' || c.status === 'LEFT'
  ).length;
  const renewableDueCount = safeCandidates.filter(isRenewableDue).length;
  const totalFeesExpected = safeCandidates.reduce(
    (sum, c) => sum + (c.monthlyFee || c.monthlyRate || 0),
    0
  );

  // ---------------- FILTER ----------------
  const filteredCandidates = useMemo(() => {
    const globalTerm = searchTerm.trim().toLowerCase();
    const localTerm = nameFilter.trim().toLowerCase();

    return safeCandidates.filter((cand) => {
      const statusMatch =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
            ? cand.status === 'ACTIVE'
            : statusFilter === 'INACTIVE'
              ? cand.status === 'INACTIVE' || cand.status === 'LEFT'
              : isRenewableDue(cand);

      const globalMatch =
        !globalTerm ||
        cand.fullName?.toLowerCase().includes(globalTerm) ||
        cand.candidateId?.toLowerCase().includes(globalTerm) ||
        (cand.phone ?? cand.phoneNumber ?? '').includes(globalTerm) ||
        (cand.email ?? '').toLowerCase().includes(globalTerm);

      const nameMatch =
        !localTerm || cand.fullName?.toLowerCase().includes(localTerm);

      return statusMatch && globalMatch && nameMatch;
    });
  }, [safeCandidates, statusFilter, searchTerm, nameFilter]);

  // ---------------- SAVE (CREATE / UPDATE) ----------------
  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim()) {
      showToast('error', 'Candidate name and phone are required');
      return;
    }

    try {
      // Build strict payload matching backend DTO exactly
      const payload: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phone.trim(),
        email:
          form.email.trim() ||
          `${form.fullName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        address: form.address.trim() || 'Mess Hostel',
        joiningDate: form.joiningDate,
        monthlyRate: Number(form.monthlyFee),
        status: form.status,
      };

      if (form.emergencyContact.trim())
        payload.emergencyContact = form.emergencyContact.trim();
      if (form.emergencyPhone.trim())
        payload.emergencyPhone = form.emergencyPhone.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();

      if (editingCandidate) {
        const id = resolveCandidateId(editingCandidate);
        if (!id) {
          showToast('error', 'Cannot update: missing candidate id');
          return;
        }
        console.log('[Update] id →', id);
        console.log('[Update] payload →', payload);

        await api.candidate.update(id, payload as Partial<Candidate>);
        showToast('success', `Updated candidate ${form.fullName}`);
      } else {
        if (form.candidateId.trim()) {
          payload.candidateId = form.candidateId.trim();
        }
        console.log('[Create] payload →', payload);

        const created = await api.candidate.create(payload as unknown as Candidate);
        showToast('success', `Added new member ${form.fullName}`);
        const createdId = created ? resolveCandidateId(created) : undefined;
        if (createdId && pendingImage) {
          try {
            if (pendingImage.file) {
              await api.candidate.uploadProfileImage(createdId, pendingImage.file);
            } else if (pendingImage.url) {
              await api.candidate.setProfileImageUrl(createdId, pendingImage.url);
            }
          } catch (imgErr: unknown) {
            showToast(
              'error',
              `Member saved, but the photo could not be applied: ${imgErr instanceof Error ? imgErr.message : 'unknown error'}`
            );
          }
        }
      }

      setPendingImage(null);
      setIsAddModalOpen(false);
      setEditingCandidate(null);
      setForm(buildDefaultForm());
      await fetchCandidates();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save candidate';
      console.error('[Save] failed →', err);
      showToast('error', msg);
    }
  };

  // ---------------- DELETE (PERMANENT) ----------------
  const handleDeleteCandidate = async (cand: Candidate) => {
    const id = resolveCandidateId(cand);
    if (!id) {
      showToast('error', 'Cannot delete: missing candidate id');
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete member "${cand.fullName}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setBusyId(id);
      console.log('[Delete] DELETE /api/candidates/' + id);

      await api.candidate.delete(id);

      // Remove from local state — match on all id variants
      setCandidates((prev) =>
        prev.filter((c) => resolveCandidateId(c) !== id)
      );
      showToast('success', `Permanently deleted ${cand.fullName}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete candidate';
      console.error('[Delete] failed →', err);
      showToast('error', msg);
      await fetchCandidates();
    } finally {
      setBusyId(null);
    }
  };

  // ---------------- MARK LEFT ----------------
  const handleMarkLeft = async (cand: Candidate) => {
    const id = resolveCandidateId(cand);
    if (!id) {
      showToast('error', 'Cannot mark left: missing candidate id');
      return;
    }
    if (cand.status === 'LEFT') {
      showToast('info', `${cand.fullName} is already marked as LEFT`);
      return;
    }
    const confirmed = window.confirm(
      `Mark "${cand.fullName}" as LEFT?\n\nThey will move to the Inactive section.`
    );
    if (!confirmed) return;

    try {
      setBusyId(id);
      const leavingDate = todayISO();
      await api.candidate.markLeft(id, leavingDate);

      // Optimistic update — keep them in list under LEFT status
      setCandidates((prev) =>
        prev.map((c) =>
          resolveCandidateId(c) === id
            ? ({ ...c, status: 'LEFT', leavingDate } as Candidate)
            : c
        )
      );
      showToast('info', `${cand.fullName} marked as LEFT (${leavingDate})`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to mark as left';
      console.error('[MarkLeft] failed →', err);
      showToast('error', msg);
      await fetchCandidates();
    } finally {
      setBusyId(null);
    }
  };

  // ---------------- TOGGLE STATUS ----------------
  const handleToggleStatus = async (cand: Candidate) => {
    const id = resolveCandidateId(cand);
    if (!id) {
      showToast('error', 'Cannot update status: missing candidate id');
      return;
    }

    // ACTIVE → INACTIVE | INACTIVE/LEFT → ACTIVE
    const nextStatus: CandidateStatus =
      cand.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      setBusyId(id);

      const payload: Record<string, unknown> = {
        fullName: cand.fullName,
        phoneNumber: cand.phone ?? cand.phoneNumber ?? '',
        email:
          cand.email ??
          `${cand.fullName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        address: cand.address || 'Mess Hostel',
        joiningDate:
          nextStatus === 'ACTIVE' ? todayISO() : cand.joiningDate,
        monthlyRate: cand.monthlyRate ?? cand.monthlyFee ?? 3000,
        status: nextStatus,
      };

      console.log('[ToggleStatus] payload →', payload);

      await api.candidate.update(id, payload as Partial<Candidate>);
      showToast(
        nextStatus === 'ACTIVE' ? 'success' : 'info',
        `${cand.fullName} is now ${nextStatus}`
      );
      await fetchCandidates();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to toggle status';
      console.error('[ToggleStatus] failed →', err);
      showToast('error', msg);
    } finally {
      setBusyId(null);
    }
  };

  // ---------------- RENEW ----------------
  const handleRenewMembership = async (cand: Candidate) => {
    const id = resolveCandidateId(cand);
    if (!id) {
      showToast('error', 'Cannot renew: missing candidate id');
      return;
    }
    try {
      setBusyId(id);
      const today = todayISO();

      const payload: Record<string, unknown> = {
        fullName: cand.fullName,
        phoneNumber: cand.phone ?? cand.phoneNumber ?? '',
        email:
          cand.email ??
          `${cand.fullName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        address: cand.address || 'Mess Hostel',
        joiningDate: today,
        monthlyRate: cand.monthlyRate ?? cand.monthlyFee ?? 3000,
        status: 'ACTIVE',
      };

      console.log('[Renew] payload →', payload);

      await api.candidate.update(id, payload as Partial<Candidate>);

      // Optimistic update
      setCandidates((prev) =>
        prev.map((c) =>
          resolveCandidateId(c) === id
            ? ({ ...c, status: 'ACTIVE', joiningDate: today } as Candidate)
            : c
        )
      );

      showToast(
        'success',
        `Renewed monthly mess membership for ${cand.fullName}!`
      );
      await fetchCandidates();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to renew membership';
      console.error('[Renew] failed →', err);
      showToast('error', msg);
    } finally {
      setBusyId(null);
    }
  };

  // ---------------- OPEN EDIT ----------------
  const openEdit = (cand: Candidate) => {
    setEditingCandidate(cand);
    setForm({
      candidateId: cand.candidateId || '',
      fullName: cand.fullName || '',
      phone: cand.phone || cand.phoneNumber || '',
      email: cand.email || '',
      address: cand.address || '',
      joiningDate: cand.joiningDate || todayISO(),
      endDate: cand.endDate || oneMonthFromNowISO(),
      monthlyFee: cand.monthlyFee || cand.monthlyRate || 3000,
      status: (cand.status as CandidateStatus) || 'ACTIVE',
      dietaryPreference: cand.dietaryPreference || 'VEG',
      emergencyContact:
        (cand as unknown as { emergencyContact?: string })
          .emergencyContact || '',
      emergencyPhone:
        (cand as unknown as { emergencyPhone?: string }).emergencyPhone || '',
      notes: (cand as unknown as { notes?: string }).notes || '',
    });
    setIsAddModalOpen(true);
  };

  const openAdd = () => {
    setEditingCandidate(null);
    setForm(buildDefaultForm());
    setPendingImage(null);
    setIsAddModalOpen(true);
  };

  // ---------------- RENDER ----------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Monthly Mess Members & Fee Roster</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              Live Overview
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage candidate start/end dates, monthly fees, membership status &
            renewable notifications
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { api.clearCache(); fetchCandidates(); }}
            disabled={loading}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Member</span>
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Total Enrolled"
          value={totalCount}
          hint="Registered members"
          icon={<Users className="w-4 h-4 text-blue-600" />}
        />
        <KpiCard
          label="Active Members"
          value={activeCount}
          hint="Active mess dining"
          valueClass="text-emerald-600"
          icon={<UserCheck className="w-4 h-4 text-emerald-600" />}
        />
        <KpiCard
          label="Inactive / Left"
          value={inactiveCount}
          hint="Paused or left mess"
          valueClass="text-rose-600"
          icon={<UserX className="w-4 h-4 text-rose-500" />}
        />
        <KpiCard
          label="Renewable Due"
          value={renewableDueCount}
          hint="Renewal required"
          valueClass="text-amber-600"
          icon={<Bell className="w-4 h-4 text-amber-500" />}
        />
        <KpiCard
          label="Monthly Mess Fees"
          value={`₹${totalFeesExpected.toLocaleString()}`}
          hint="Expected monthly total"
          icon={<IndianRupee className="w-4 h-4 text-blue-600" />}
        />
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <FilterButton
            active={statusFilter === 'ALL'}
            onClick={() => setStatusFilter('ALL')}
            activeClass="bg-slate-900 text-white"
          >
            All ({totalCount})
          </FilterButton>
          <FilterButton
            active={statusFilter === 'ACTIVE'}
            onClick={() => setStatusFilter('ACTIVE')}
            activeClass="bg-emerald-600 text-white"
          >
            Active ({activeCount})
          </FilterButton>
          <FilterButton
            active={statusFilter === 'INACTIVE'}
            onClick={() => setStatusFilter('INACTIVE')}
            activeClass="bg-rose-600 text-white"
          >
            Inactive ({inactiveCount})
          </FilterButton>
          <FilterButton
            active={statusFilter === 'RENEWABLE'}
            onClick={() => setStatusFilter('RENEWABLE')}
            activeClass="bg-amber-600 text-white"
          >
            Renewal Due ({renewableDueCount})
          </FilterButton>
        </div>

        {/* Name filter input */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter by name..."
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {nameFilter && (
              <button
                onClick={() => setNameFilter('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded"
                title="Clear name filter"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500 whitespace-nowrap">
            <strong className="text-slate-900">
              {filteredCandidates.length}
            </strong>{' '}
            shown
          </div>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
          Loading mess member roster...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          No candidates found matching the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filteredCandidates.map((cand) => {
            const key = resolveCandidateId(cand) || cand.fullName;
            const due = isRenewableDue(cand);
            const isActive = cand.status === 'ACTIVE';
            const isLeft = cand.status === 'LEFT';
            const isBusy = busyId === resolveCandidateId(cand);
            const monthEnd = getMonthEndDate(cand);

            const pillClass = isActive
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
              : isLeft
                ? 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                : 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200';

            const pillTitle = isActive
              ? 'Click to mark INACTIVE'
              : 'Click to mark ACTIVE';

            return (
              <div
                key={key}
                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-3.5 flex flex-col gap-2.5 ${isLeft ? 'border-slate-300 opacity-90' : 'border-slate-200'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {resolveImageUrl(cand.profileImageUrl) ? (
                      <button
                        type="button"
                        onClick={() => setZoomedCandidate(cand)}
                        className="rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                        title={`View ${cand.fullName}'s photo`}
                      >
                        <Avatar
                          src={cand.profileImageUrl}
                          name={cand.fullName}
                          size="md"
                          rounded="xl"
                          className="cursor-pointer hover:opacity-80 transition-opacity ring-1 ring-slate-200"
                        />
                      </button>
                    ) : (
                      <Avatar src={cand.profileImageUrl} name={cand.fullName} size="md" rounded="xl" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 truncate">
                        {cand.fullName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {cand.candidateId ||
                          `CND-${cand.id?.substring(0, 4) ?? '----'}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(cand)}
                    disabled={isBusy}
                    title={pillTitle}
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors disabled:opacity-50 ${pillClass}`}
                  >
                    {isBusy ? '...' : cand.status || 'INACTIVE'}
                  </button>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {cand.phone || cand.phoneNumber || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{cand.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {cand.joiningDate || '-'} → {monthEnd}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                  <div className="text-sm font-bold text-slate-900">
                    ₹
                    {(
                      cand.monthlyFee ||
                      cand.monthlyRate ||
                      3000
                    ).toLocaleString()}
                    <span className="text-[10px] font-normal text-slate-400">
                      /mo
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {cand.dietaryPreference || 'VEG'}
                    </span>
                    {due && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        Due
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleRenewMembership(cand)}
                    disabled={isBusy}
                    className="flex-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold border border-amber-200 rounded text-[10px] transition-colors disabled:opacity-50"
                    title="Renew Mess Membership (sets back to ACTIVE)"
                  >
                    Renew
                  </button>

                  {!isLeft && (
                    <button
                      onClick={() => handleMarkLeft(cand)}
                      disabled={isBusy}
                      className="flex-1 px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded text-[10px] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      title="Mark member as LEFT"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Left</span>
                    </button>
                  )}

                  <button
                    onClick={() => openEdit(cand)}
                    disabled={isBusy}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                    title="Edit Member"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCandidate(cand)}
                    disabled={isBusy}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                    title="Delete Permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">
              {editingCandidate
                ? 'Edit Monthly Mess Member'
                : 'Add New Mess Member'}
            </h3>
            <form onSubmit={handleSaveCandidate} className="space-y-3 text-xs">
              <div className="pb-1">
                <label className="block font-semibold text-slate-700 mb-1">Profile Photo</label>
                <ProfileImageUploader
                  key={editingCandidate ? resolveCandidateId(editingCandidate) : 'new-member'}
                  currentUrl={editingCandidate ? editingCandidate.profileImageUrl : (pendingImage?.preview || pendingImage?.url || null)}
                  name={form.fullName || 'Member'}
                  size="lg"
                  successMessage={editingCandidate ? undefined : 'Photo selected. It will be applied when you save the member.'}
                  onUpload={async (file) => {
                    const id = editingCandidate ? resolveCandidateId(editingCandidate) : undefined;
                    if (id) {
                      const updated = await api.candidate.uploadProfileImage(id, file);
                      setEditingCandidate(prev => (prev ? { ...prev, profileImageUrl: updated?.profileImageUrl } : prev));
                      await fetchCandidates();
                    } else {
                      setPendingImage({ file, preview: URL.createObjectURL(file) });
                    }
                  }}
                  onSetUrl={async (url) => {
                    const id = editingCandidate ? resolveCandidateId(editingCandidate) : undefined;
                    if (id) {
                      const updated = await api.candidate.setProfileImageUrl(id, url);
                      setEditingCandidate(prev => (prev ? { ...prev, profileImageUrl: updated?.profileImageUrl } : prev));
                      await fetchCandidates();
                    } else {
                      setPendingImage({ url });
                    }
                  }}
                  onRemove={editingCandidate?.profileImageUrl ? async () => {
                    const id = resolveCandidateId(editingCandidate);
                    if (!id) return;
                    await api.candidate.removeProfileImage(id);
                    setEditingCandidate(prev => (prev ? { ...prev, profileImageUrl: undefined } : prev));
                    await fetchCandidates();
                  } : undefined}
                  hint={editingCandidate ? 'Photo changes are saved immediately.' : 'Optional. Applied right after the member is created.'}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email (Gmail)
                  </label>
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="Mess Hostel"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) =>
                      setForm({ ...form, joiningDate: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Monthly Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={form.monthlyFee}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        monthlyFee: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={form.emergencyContact}
                    onChange={(e) =>
                      setForm({ ...form, emergencyContact: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Emergency Phone
                  </label>
                  <input
                    type="text"
                    placeholder="9876543211"
                    value={form.emergencyPhone}
                    onChange={(e) =>
                      setForm({ ...form, emergencyPhone: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Membership Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as CandidateStatus,
                      })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Dietary Preference
                  </label>
                  <select
                    value={form.dietaryPreference}
                    onChange={(e) =>
                      setForm({ ...form, dietaryPreference: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="VEG">VEG</option>
                    <option value="NON_VEG">NON-VEG</option>
                    <option value="JAIN">JAIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingCandidate(null);
                    setPendingImage(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zoomed candidate photo */}
      {zoomedCandidate && resolveImageUrl(zoomedCandidate.profileImageUrl) && (
        <ImageLightbox
          src={resolveImageUrl(zoomedCandidate.profileImageUrl)!}
          alt={`${zoomedCandidate.fullName}'s photo`}
          title={zoomedCandidate.fullName}
          onClose={() => setZoomedCandidate(null)}
        />
      )}
    </div>
  );
};

// ---------------- Sub-components ----------------

const KpiCard: React.FC<{
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  valueClass?: string;
}> = ({ label, value, hint, icon, valueClass = 'text-slate-900' }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
      <span>{label}</span>
      {icon}
    </div>
    <div className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</div>
    <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>
  </div>
);

const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  activeClass: string;
  children: React.ReactNode;
}> = ({ active, onClick, activeClass, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${active
        ? `${activeClass} shadow-sm`
        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
      }`}
  >
    {children}
  </button>
);

export default DashboardPage;