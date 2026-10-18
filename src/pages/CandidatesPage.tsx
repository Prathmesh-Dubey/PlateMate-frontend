// src/pages/CandidatesPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  UserMinus,
  X,
  IndianRupee,
  RefreshCw,
  CreditCard,
  LayoutGrid,
  List,
  Receipt,
  Wallet,
  AlertCircle,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import api from '../api';
import type { Candidate, FeeCollection, PaymentMethod } from '../types';

interface CandidatesPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CandidatesPage: React.FC<CandidatesPageProps> = ({ searchTerm, showToast }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  // Fee collections for the current month; every fee total below is derived from this list
  const [monthFees, setMonthFees] = useState<FeeCollection[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LEFT'>('ALL');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');
  const [loading, setLoading] = useState<boolean>(true);

  const [feeTab, setFeeTab] = useState<'ALL' | 'PAID' | 'DUE'>('ALL');

  // ===== Fee panel filters =====
  const [collectedFilter, setCollectedFilter] = useState<string>('');
  const [pendingFilter, setPendingFilter] = useState<string>('');

  // Summary boxes are calculated from the loaded lists, never fetched separately
  const stats = useMemo(
    () => ({
      total: candidates.length,
      active: candidates.filter((c) => c.status === 'ACTIVE').length,
      left: candidates.filter((c) => c.status === 'LEFT').length,
    }),
    [candidates]
  );

  const thisMonthCollected = useMemo(
    () => monthFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
    [monthFees]
  );

  const feeSummary = useMemo(() => {
    const paidByCandidate = new Map<string, { amount: number; date?: string }>();
    monthFees.forEach((f) => {
      const prev = paidByCandidate.get(f.candidateId);
      paidByCandidate.set(f.candidateId, {
        amount: (prev?.amount || 0) + (Number(f.amount) || 0),
        date: f.collectionDate || prev?.date,
      });
    });

    const candidateFees = candidates.map((c) => {
      const id = c.id || c.candidateId || '';
      const paid =
        paidByCandidate.get(id) || (c.candidateId ? paidByCandidate.get(c.candidateId) : undefined);
      const rate = c.monthlyRate || c.monthlyFee || 0;
      const paidAmount = paid?.amount || 0;
      return {
        candidateId: id,
        candidateName: c.fullName,
        monthlyRate: rate,
        paidAmount,
        pendingAmount: Math.max(0, rate - paidAmount),
        isPaid: rate > 0 ? paidAmount >= rate : paidAmount > 0,
        paymentDate: paid?.date,
      };
    });

    return {
      totalCollectedFees: candidateFees.reduce((s, f) => s + f.paidAmount, 0),
      pendingAmount: candidateFees.reduce((s, f) => s + f.pendingAmount, 0),
      paidCandidates: candidateFees.filter((f) => f.isPaid).length,
      pendingCandidates: candidateFees.filter((f) => !f.isPaid).length,
      candidateFees,
    };
  }, [candidates, monthFees]);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [formData, setFormData] = useState<Partial<Candidate>>({
    fullName: '',
    phoneNumber: '',
    email: '',
    address: '',
    joiningDate: new Date().toISOString().split('T')[0],
    monthlyRate: 3500,
    status: 'ACTIVE',
    emergencyContact: '',
    emergencyPhone: '',
    notes: '',
  });

  const [isFeeModalOpen, setIsFeeModalOpen] = useState<boolean>(false);
  const [selectedCandidateForFee, setSelectedCandidateForFee] = useState<Candidate | null>(null);
  const [feeForm, setFeeForm] = useState({
    amount: 3500,
    collectionDate: new Date().toISOString().split('T')[0],
    paymentMonth: MONTH_NAMES[new Date().getMonth()],
    paymentMonthNumber: new Date().getMonth() + 1,
    paymentYear: new Date().getFullYear(),
    paymentMethod: 'CASH' as PaymentMethod,
    transactionId: '',
    remarks: '',
  });
  const [isSubmittingFee, setIsSubmittingFee] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // Two reads, in parallel. Both are served from the shared cache when already loaded.
      const [list, fees] = await Promise.all([
        api.candidate.getAll(),
        api.billing.fee.getByMonth(currentMonth, currentYear).catch(() => []),
      ]);

      setCandidates(Array.isArray(list) ? list : []);
      setMonthFees(Array.isArray(fees) ? fees : []);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to load candidates data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ==================== CREATE / UPDATE ====================
  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = (formData.fullName || '').trim();
    const phone = (formData.phoneNumber || (formData as any).phone || '').trim();
    if (!name) {
      showToast('error', 'Full Name is required');
      return;
    }
    if (!phone) {
      showToast('error', 'Phone Number is required');
      return;
    }

    const rate = Number(formData.monthlyRate) || Number(formData.monthlyFee) || 3500;
    const validStatus = ['ACTIVE', 'INACTIVE', 'LEFT'].includes(String(formData.status))
      ? (formData.status as Candidate['status'])
      : 'ACTIVE';
    const joinDate = formData.joiningDate || new Date().toISOString().split('T')[0];

    try {
      if (editingCandidate && editingCandidate.id) {
        const payload: any = {
          fullName: name,
          phoneNumber: phone,
          monthlyRate: rate,
          monthlyFee: rate,
          status: validStatus,
          joiningDate: joinDate,
          dietaryPreference: formData.dietaryPreference || 'VEG',
          address: formData.address || formData.roomNumber || 'Mess Hostel',
        };
        if (formData.email?.trim()) payload.email = formData.email.trim();
        if (formData.roomNumber && String(formData.roomNumber).trim()) payload.roomNumber = formData.roomNumber;
        if (formData.emergencyContact?.trim()) payload.emergencyContact = formData.emergencyContact.trim();
        if (formData.emergencyPhone?.trim()) payload.emergencyPhone = formData.emergencyPhone.trim();
        if (formData.notes?.trim()) payload.notes = formData.notes.trim();

        await api.candidate.update(editingCandidate.id, payload);
        showToast('success', 'Candidate details updated successfully');
      } else {
        const createPayload: any = {
          fullName: name,
          phoneNumber: phone,
          monthlyRate: rate,
          monthlyFee: rate,
          status: validStatus,
          joiningDate: joinDate,
          dietaryPreference: formData.dietaryPreference || 'VEG',
          address: formData.address || formData.roomNumber || 'Mess Hostel',
        };
        if (formData.email?.trim()) createPayload.email = formData.email.trim();
        if (formData.roomNumber && String(formData.roomNumber).trim()) createPayload.roomNumber = formData.roomNumber;
        if (formData.emergencyContact?.trim()) createPayload.emergencyContact = formData.emergencyContact.trim();
        if (formData.emergencyPhone?.trim()) createPayload.emergencyPhone = formData.emergencyPhone.trim();
        if (formData.notes?.trim()) createPayload.notes = formData.notes.trim();

        await api.candidate.create(createPayload as Candidate);
        showToast('success', 'New candidate enrolled successfully');
      }

      setIsAddModalOpen(false);
      setEditingCandidate(null);
      resetForm();
      loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Operation failed');
    }
  };

  const handleMarkLeft = async (c: Candidate) => {
    if (!c.id) return;
    const date = new Date().toISOString().split('T')[0];
    if (window.confirm(`Mark ${c.fullName} as LEFT on date ${date}?`)) {
      try {
        await api.candidate.markLeft(c.id, date);
        showToast('success', `${c.fullName} marked as Left`);
        loadData();
      } catch (err: any) {
        showToast('error', err?.message || 'Failed to update status');
      }
    }
  };

  const handleRejoin = async (c: Candidate) => {
    if (!c.id) return;
    const today = new Date().toISOString().split('T')[0];

    const confirmed = window.confirm(
      `Rejoin ${c.fullName} starting ${today}?\n\nThis will restore their mess membership and set status to ACTIVE.`
    );
    if (!confirmed) return;

    try {
      await api.candidate.update(c.id, {
        fullName: c.fullName,
        phoneNumber: (c.phoneNumber || c.phone || '').trim(),
        monthlyRate: c.monthlyRate || c.monthlyFee || 3500,
        monthlyFee: c.monthlyRate || c.monthlyFee || 3500,
        dietaryPreference: c.dietaryPreference || 'VEG',
        address: c.address || c.roomNumber || 'Mess Hostel',
        status: 'ACTIVE',
        joiningDate: today,
      });
      showToast('success', `${c.fullName} has rejoined the mess`);
      loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to rejoin candidate');
    }
  };

  const handleDelete = async (c: Candidate) => {
    if (!c.id) return;
    if (window.confirm(`Are you sure you want to permanently delete candidate ${c.fullName}?`)) {
      try {
        await api.candidate.delete(c.id);
        showToast('success', 'Candidate record removed');
        loadData();
      } catch (err: any) {
        showToast('error', err?.message || 'Failed to delete candidate');
      }
    }
  };

  const openCollectFeeModal = (c: Candidate) => {
    const rate = c.monthlyRate || c.monthlyFee || 3500;
    const now = new Date();
    setSelectedCandidateForFee(c);
    setFeeForm({
      amount: rate,
      collectionDate: now.toISOString().split('T')[0],
      paymentMonth: MONTH_NAMES[now.getMonth()],
      paymentMonthNumber: now.getMonth() + 1,
      paymentYear: now.getFullYear(),
      paymentMethod: 'CASH',
      transactionId: '',
      remarks: `Monthly fee for ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
    });
    setIsFeeModalOpen(true);
  };

  const handleCollectFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedCandidateForFee ||
      (!selectedCandidateForFee.id && !selectedCandidateForFee.candidateId)
    ) {
      showToast('error', 'Invalid candidate selected');
      return;
    }

    if (!feeForm.amount || feeForm.amount <= 0) {
      showToast('error', 'Please enter a valid amount');
      return;
    }

    setIsSubmittingFee(true);
    try {
      const candidateId =
        selectedCandidateForFee.id || selectedCandidateForFee.candidateId!;
      const payload: FeeCollection = {
        candidateId,
        amount: Number(feeForm.amount),
        collectionDate: feeForm.collectionDate,
        paymentMonth: feeForm.paymentMonth,
        paymentMonthNumber: Number(feeForm.paymentMonthNumber),
        paymentYear: Number(feeForm.paymentYear),
        paymentMethod: feeForm.paymentMethod,
        transactionId: feeForm.transactionId || undefined,
        remarks: feeForm.remarks || undefined,
      };

      await api.billing.fee.collect(payload);
      showToast(
        'success',
        `Fee of ₹${feeForm.amount} collected for ${selectedCandidateForFee.fullName}!`
      );
      setIsFeeModalOpen(false);
      setSelectedCandidateForFee(null);
      loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to record fee collection');
    } finally {
      setIsSubmittingFee(false);
    }
  };

  const startEdit = (c: Candidate) => {
    setEditingCandidate(c);
    setFormData({
      ...c,
      fullName: c.fullName || '',
      phoneNumber: c.phoneNumber || c.phone || '',
      email: c.email || '',
      address: c.address || c.roomNumber || '',
      joiningDate: c.joiningDate || new Date().toISOString().split('T')[0],
      monthlyRate: c.monthlyRate || c.monthlyFee || 3500,
      status: c.status || 'ACTIVE',
      emergencyContact: c.emergencyContact || '',
      emergencyPhone: c.emergencyPhone || '',
      notes: c.notes || '',
    });
    setIsAddModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      phoneNumber: '',
      email: '',
      address: '',
      joiningDate: new Date().toISOString().split('T')[0],
      monthlyRate: 3500,
      status: 'ACTIVE',
      emergencyContact: '',
      emergencyPhone: '',
      notes: '',
    });
  };

  const getInitials = (name: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-blue-600 to-indigo-700',
      'from-emerald-600 to-teal-700',
      'from-purple-600 to-pink-700',
      'from-amber-600 to-orange-700',
      'from-cyan-600 to-blue-700',
      'from-rose-600 to-red-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  const isCandidateLeft = (c: Candidate) =>
    c.status === 'LEFT' || c.status === 'INACTIVE';

  const getFeeInfo = (c: Candidate) => {
    if (!feeSummary?.candidateFees) return null;
    const id = c.id || c.candidateId;
    const found = feeSummary.candidateFees.find(
      (cf) => cf.candidateId === id || cf.candidateId === c.candidateId
    );
    if (found) return found;

    const rate = c.monthlyRate || c.monthlyFee || 0;
    return {
      candidateId: id || '',
      candidateName: c.fullName,
      monthlyRate: rate,
      paidAmount: 0,
      pendingAmount: rate,
      isPaid: false,
      paymentDate: undefined,
    };
  };

  const filtered = useMemo(() => {
    const query = (nameFilter || searchTerm || '').trim().toLowerCase();

    return candidates.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;

      if (query) {
        const matchName = c.fullName?.toLowerCase().includes(query);
        const matchPhone =
          c.phoneNumber?.toLowerCase().includes(query) ||
          c.phone?.toLowerCase().includes(query);
        const matchEmail = c.email?.toLowerCase().includes(query);
        const matchId =
          c.candidateId?.toLowerCase().includes(query) ||
          c.id?.toLowerCase().includes(query);
        const matchAddr =
          c.address?.toLowerCase().includes(query) ||
          c.roomNumber?.toLowerCase().includes(query);
        if (!(matchName || matchPhone || matchEmail || matchId || matchAddr)) return false;
      }

      if (feeTab !== 'ALL') {
        const info = getFeeInfo(c);
        const isPaid = info ? info.isPaid : false;
        if (feeTab === 'PAID' && !isPaid) return false;
        if (feeTab === 'DUE' && isPaid) return false;
      }

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, statusFilter, nameFilter, searchTerm, feeTab, feeSummary]);

  const visibleTotals = useMemo(() => {
    let paid = 0;
    let due = 0;
    let paidCount = 0;
    let dueCount = 0;

    filtered.forEach((c) => {
      const info = getFeeInfo(c);
      if (!info) {
        dueCount += 1;
        due += c.monthlyRate || c.monthlyFee || 0;
        return;
      }
      paid += Number(info.paidAmount) || 0;
      due += Number(info.pendingAmount) || 0;
      if (info.isPaid) paidCount += 1;
      else dueCount += 1;
    });

    return { paid, due, paidCount, dueCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, feeSummary]);

  // ===== Fee panel data =====
  const collectedList = useMemo(() => {
    return candidates
      .map((c) => ({ cand: c, info: getFeeInfo(c) }))
      .filter(({ info }) => info && info.isPaid && Number(info.paidAmount) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, feeSummary]);

  const pendingList = useMemo(() => {
    return candidates
      .map((c) => ({ cand: c, info: getFeeInfo(c) }))
      .filter(({ info }) => info && Number(info.pendingAmount) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, feeSummary]);

  const filteredCollected = useMemo(() => {
    const q = collectedFilter.trim().toLowerCase();
    if (!q) return collectedList;
    return collectedList.filter(({ cand }) =>
      (cand.fullName || '').toLowerCase().includes(q) ||
      (cand.candidateId || cand.id || '').toLowerCase().includes(q)
    );
  }, [collectedList, collectedFilter]);

  const filteredPending = useMemo(() => {
    const q = pendingFilter.trim().toLowerCase();
    if (!q) return pendingList;
    return pendingList.filter(({ cand }) =>
      (cand.fullName || '').toLowerCase().includes(q) ||
      (cand.candidateId || cand.id || '').toLowerCase().includes(q)
    );
  }, [pendingList, pendingFilter]);

  const totalCollectedVisible = filteredCollected.reduce(
    (sum, { info }) => sum + (Number(info?.paidAmount) || 0),
    0
  );
  const totalPendingVisible = filteredPending.reduce(
    (sum, { info }) => sum + (Number(info?.pendingAmount) || 0),
    0
  );

  const totalMonthlyExpected = candidates
    .filter((c) => c.status === 'ACTIVE')
    .reduce((sum, c) => sum + (c.monthlyRate || c.monthlyFee || 0), 0);

  const hasActiveFilters =
    statusFilter !== 'ALL' || !!nameFilter || feeTab !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Candidates & Mess Members Directory
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage enrollments, fees, memberships & monthly statistics
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => { api.clearCache(); loadData(); }}
            className="p-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors shadow-sm"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingCandidate(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll New Candidate</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Enrolled</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Candidates registered</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Active Dining</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Active meal plans</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Left / Inactive</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-600 mt-1">{stats.left}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Discontinued</div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
            <span>Collected ({MONTH_NAMES[new Date().getMonth()].substring(0, 3)})</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            ₹{thisMonthCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
            This month's fee payments
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Expected Monthly</span>
            <IndianRupee className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            ₹{totalMonthlyExpected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active candidates potential</div>
        </div>
      </div>

      {/* ============== FEES SECTION — Collected vs Pending ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Collected Fee Panel */}
        <div className="bg-white border border-emerald-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-900">
                Collected Fee — {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                {filteredCollected.length} paid
              </span>
              <span className="text-xs font-bold text-emerald-700">
                ₹{totalCollectedVisible.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-3 border-b border-emerald-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter collected by name or ID..."
                value={collectedFilter}
                onChange={(e) => setCollectedFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
            {filteredCollected.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No collected fees match your filter.
              </div>
            ) : (
              filteredCollected.map(({ cand, info }) => {
                const initials = getInitials(cand.fullName);
                const gradient = getAvatarGradient(cand.fullName);
                return (
                  <div
                    key={cand.id || cand.candidateId}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} text-white font-bold flex items-center justify-center text-[10px] shadow-sm shrink-0`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {cand.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {cand.candidateId || cand.id}
                          {info?.paymentDate ? ` · ${info.paymentDate}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-emerald-700">
                        ₹{Number(info?.paidAmount || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        of ₹{Number(info?.monthlyRate || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Remaining / Pending Fee Panel */}
        <div className="bg-white border border-rose-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span className="text-sm font-bold text-rose-900">
                Remaining Fee — {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                {filteredPending.length} pending
              </span>
              <span className="text-xs font-bold text-rose-700">
                ₹{totalPendingVisible.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-3 border-b border-rose-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter pending by name or ID..."
                value={pendingFilter}
                onChange={(e) => setPendingFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
            {filteredPending.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No pending fees match your filter. All collected!
              </div>
            ) : (
              filteredPending.map(({ cand, info }) => {
                const initials = getInitials(cand.fullName);
                const gradient = getAvatarGradient(cand.fullName);
                return (
                  <div
                    key={cand.id || cand.candidateId}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-rose-50/40 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} text-white font-bold flex items-center justify-center text-[10px] shadow-sm shrink-0`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {cand.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {cand.candidateId || cand.id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-rose-700">
                          ₹{Number(info?.pendingAmount || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          of ₹{Number(info?.monthlyRate || 0).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => openCollectFeeModal(cand)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition-colors"
                        title="Collect fee"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      {/* ============== END FEES SECTION ============== */}

      {/* Filter Bar + Paid/Due toggle + Paid/Due summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, ID, room..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {nameFilter && (
              <button
                onClick={() => setNameFilter('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
              {(['ALL', 'ACTIVE', 'LEFT'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${statusFilter === tab
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {tab === 'ALL' && `All (${stats.total})`}
                  {tab === 'ACTIVE' && `Active (${stats.active})`}
                  {tab === 'LEFT' && `Left (${stats.left})`}
                </button>
              ))}
            </div>

            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button
                onClick={() => setViewMode('CARD')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'CARD'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'TABLE'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500 font-semibold inline-flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              Fee Status:
            </span>
            <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFeeTab('ALL')}
                className={`px-3 py-1.5 rounded-md transition-colors ${feeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                All ({filtered.length})
              </button>
              <button
                type="button"
                onClick={() => setFeeTab('PAID')}
                className={`px-3 py-1.5 rounded-md transition-colors inline-flex items-center ${feeTab === 'PAID'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-emerald-700'
                  }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Paid ({visibleTotals.paidCount})
              </button>
              <button
                type="button"
                onClick={() => setFeeTab('DUE')}
                className={`px-3 py-1.5 rounded-md transition-colors inline-flex items-center ${feeTab === 'DUE'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:text-rose-700'
                  }`}
              >
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Due ({visibleTotals.dueCount})
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setNameFilter('');
                  setStatusFilter('ALL');
                  setFeeTab('ALL');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="inline-flex items-center bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <Wallet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              <span className="text-emerald-800 font-semibold">Paid:</span>
              <span className="ml-1.5 font-bold text-emerald-700">
                ₹{visibleTotals.paid.toLocaleString()}
              </span>
            </div>
            <div className="inline-flex items-center bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              <span className="text-rose-800 font-semibold">Due:</span>
              <span className="ml-1.5 font-bold text-rose-700">
                ₹{visibleTotals.due.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{' '}
          <span className="font-semibold text-slate-700">{candidates.length}</span> candidates
        </div>
      </div>

      {/* Content — Card / Table */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400 text-sm">
          Loading candidates directory…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400 text-sm">
          No candidates match your filters.
        </div>
      ) : viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => {
            const isLeft = isCandidateLeft(c);
            const rate = c.monthlyRate || c.monthlyFee || 3500;
            const gradient = getAvatarGradient(c.fullName);
            const initials = getInitials(c.fullName);
            const feeInfo = getFeeInfo(c);
            const paid = feeInfo ? Number(feeInfo.paidAmount) || 0 : 0;
            const due = feeInfo ? Number(feeInfo.pendingAmount) || 0 : rate;
            const isPaid = feeInfo ? feeInfo.isPaid : false;

            return (
              <div
                key={c.id || c.candidateId}
                className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative shrink-0">
                      <div
                        className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} text-white font-bold flex items-center justify-center text-base shadow-sm ring-2 ring-white`}
                      >
                        {initials}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${isLeft ? 'bg-slate-400' : 'bg-emerald-500'
                          }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm truncate">
                        {c.fullName}
                      </h3>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {c.candidateId || c.id}
                      </div>
                    </div>
                  </div>

                  {!isLeft ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      <XCircle className="w-3 h-3 mr-1" /> Left
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-2.5 text-sm flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Monthly Fee</span>
                    <span className="font-bold text-slate-900">
                      ₹{rate.toLocaleString()}
                      <span className="text-xs font-normal text-slate-500">/mo</span>
                    </span>
                  </div>

                  <div className="flex items-center text-slate-700">
                    <Phone className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span className="text-xs">{c.phoneNumber || c.phone || '—'}</span>
                  </div>

                  {c.email && (
                    <div className="flex items-center text-slate-600">
                      <Mail className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                      <span className="text-xs truncate">{c.email}</span>
                    </div>
                  )}

                  <div className="flex items-start text-slate-600">
                    <MapPin className="w-3.5 h-3.5 mr-2 mt-0.5 text-slate-400 shrink-0" />
                    <span className="text-xs truncate">
                      {c.address || c.roomNumber || 'Hostel Mess'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 text-xs pt-1">
                    <div className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      Joined: {c.joiningDate || '—'}
                    </div>
                    {c.leavingDate && (
                      <span className="text-rose-600 font-semibold">
                        Left: {c.leavingDate}
                      </span>
                    )}
                  </div>

                  <div
                    className={`mt-3 p-2.5 rounded-lg border flex items-center justify-between ${isPaid
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-amber-50 border-amber-200'
                      }`}
                  >
                    <div className="text-xs">
                      <div className="font-semibold text-slate-700">
                        {MONTH_NAMES[new Date().getMonth()].substring(0, 3)} Fee
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-emerald-700 font-bold">
                          Paid ₹{paid.toLocaleString()}
                        </span>
                        {due > 0 && (
                          <span className="text-rose-700 font-bold">
                            · Due ₹{due.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {isPaid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                  <button
                    onClick={() => openCollectFeeModal(c)}
                    className="w-full inline-flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-sm transition-colors"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Collect Fee</span>
                  </button>

                  <div className="flex items-center justify-between">
                    {!isLeft ? (
                      <button
                        onClick={() => handleMarkLeft(c)}
                        className="inline-flex items-center space-x-1 text-amber-600 hover:text-amber-700 font-semibold text-xs px-2 py-1 rounded hover:bg-amber-50 transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Leave</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRejoin(c)}
                        className="inline-flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 font-semibold text-xs px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Rejoin</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Candidate</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Joining / Left</th>
                  <th className="py-3.5 px-4">Monthly Fee</th>
                  <th className="py-3.5 px-4">Fee Status</th>
                  <th className="py-3.5 px-4">Member Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((c) => {
                  const rate = c.monthlyRate || c.monthlyFee || 3500;
                  const initials = getInitials(c.fullName);
                  const gradient = getAvatarGradient(c.fullName);
                  const feeInfo = getFeeInfo(c);
                  const paid = feeInfo ? Number(feeInfo.paidAmount) || 0 : 0;
                  const due = feeInfo ? Number(feeInfo.pendingAmount) || 0 : rate;
                  const isPaid = feeInfo ? feeInfo.isPaid : false;
                  const isLeft = isCandidateLeft(c);

                  return (
                    <tr
                      key={c.id || c.candidateId}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} text-white font-bold flex items-center justify-center text-xs shadow-sm shrink-0`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{c.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {c.candidateId || c.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center text-slate-700 text-xs">
                          <Phone className="w-3 h-3 mr-1.5 text-slate-400" />
                          {c.phoneNumber || c.phone || '—'}
                        </div>
                        {c.email && (
                          <div className="flex items-center text-slate-500 text-[11px]">
                            <Mail className="w-3 h-3 mr-1.5 text-slate-400" />
                            {c.email}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1.5 text-slate-400" />
                          {c.joiningDate || '—'}
                        </div>
                        {c.leavingDate && (
                          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                            Left: {c.leavingDate}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ₹{rate.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-emerald-700">
                            Paid: ₹{paid.toLocaleString()}
                          </div>
                          {due > 0 && (
                            <div className="text-xs font-semibold text-rose-700">
                              Due: ₹{due.toLocaleString()}
                            </div>
                          )}
                          {isPaid ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertCircle className="w-3 h-3 mr-1" /> Due
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {!isLeft ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3 mr-1" /> Left
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openCollectFeeModal(c)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] shadow-sm inline-flex items-center"
                        >
                          <CreditCard className="w-3 h-3 mr-1" />
                          Collect
                        </button>
                        {!isLeft ? (
                          <button
                            onClick={() => handleMarkLeft(c)}
                            title="Mark as Left"
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold border border-amber-200 rounded text-[11px] inline-flex items-center"
                          >
                            <UserMinus className="w-3 h-3 mr-1" />
                            Leave
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRejoin(c)}
                            title="Rejoin Candidate"
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 rounded text-[11px] inline-flex items-center"
                          >
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            Rejoin
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(c)}
                          title="Edit"
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          title="Delete"
                          className="p-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-800 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============== FEE COLLECTION MODAL ============== */}
      {isFeeModalOpen && selectedCandidateForFee && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Record Fee Payment</span>
              </h3>
              <button
                onClick={() => setIsFeeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCollectFeeSubmit} className="p-6 space-y-4 text-sm">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                  {getInitials(selectedCandidateForFee.fullName)}
                </div>
                <div>
                  <div className="font-bold text-blue-950">
                    {selectedCandidateForFee.fullName}
                  </div>
                  <div className="text-[11px] text-blue-700 font-mono">
                    ID: {selectedCandidateForFee.candidateId || selectedCandidateForFee.id}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={feeForm.amount}
                    onChange={(e) =>
                      setFeeForm({ ...feeForm, amount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Collection Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={feeForm.collectionDate}
                    onChange={(e) =>
                      setFeeForm({ ...feeForm, collectionDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Month *
                  </label>
                  <select
                    value={feeForm.paymentMonth}
                    onChange={(e) => {
                      const mName = e.target.value;
                      const mNum = MONTH_NAMES.indexOf(mName) + 1;
                      setFeeForm({
                        ...feeForm,
                        paymentMonth: mName,
                        paymentMonthNumber: mNum,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {MONTH_NAMES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Year *
                  </label>
                  <input
                    type="number"
                    required
                    value={feeForm.paymentYear}
                    onChange={(e) =>
                      setFeeForm({ ...feeForm, paymentYear: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">
                  Payment Method *
                </label>
                <select
                  value={feeForm.paymentMethod}
                  onChange={(e) =>
                    setFeeForm({
                      ...feeForm,
                      paymentMethod: e.target.value as PaymentMethod,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                  <option value="ONLINE">ONLINE / NET BANKING</option>
                  <option value="CHEQUE">CHEQUE</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">
                  Transaction / Ref ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-1234567890"
                  value={feeForm.transactionId}
                  onChange={(e) =>
                    setFeeForm({ ...feeForm, transactionId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">
                  Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received via GPay"
                  value={feeForm.remarks}
                  onChange={(e) => setFeeForm({ ...feeForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFeeModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFee}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
                >
                  {isSubmittingFee ? 'Saving…' : 'Record Fee Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============== ADD / EDIT CANDIDATE MODAL ============== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCandidate ? 'Edit Candidate Details' : 'Enroll New Candidate'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateOrUpdate}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-sm"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phoneNumber || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, phoneNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="candidate@example.com"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Monthly Fee Rate (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.monthlyRate || 3500}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyRate: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">
                  Hostel Room / Address
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Room 204, Ganga Hostel"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={formData.joiningDate || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, joiningDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Status
                  </label>
                  <select
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="LEFT">LEFT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContact: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Father / Guardian name"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    Emergency Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyPhone || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyPhone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="+91 98765 00000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">
                  Dietary Preferences & Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Pure Veg, Jain, Eggitarian"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
                >
                  {editingCandidate ? 'Save Changes' : 'Enroll Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};