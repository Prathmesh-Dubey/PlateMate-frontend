// src/pages/PartiesPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  X,
  Edit2,
  Trash2,
  Building2,
  Filter,
  IndianRupee,
  Search,
  Users,
  Utensils,
  Receipt,
  SlidersHorizontal,
  Hash,
  StickyNote,
  ChevronRight,
} from 'lucide-react';
import api from '../api';
import { Fact, DetailSheet } from '../components/DetailSheet';
import type { Party, PartyPayment } from '../types';

interface PartiesPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

interface PartySummary {
  totalParties: number;
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
}

const emptyPartyForm = (): Partial<Party> => ({
  partyName: '',
  clientName: '',
  clientPhone: '',
  departmentName: '',
  eventDate: new Date().toISOString().split('T')[0],
  eventTime: '',
  partyType: '',
  mealType: 'VEG',           // backend NOT NULL — safe default, user can change
  numberOfPeople: undefined,
  thaliRate: undefined,
  advanceAmount: undefined,
  paidAmount: 0,
  paymentStatus: 'PENDING',
  specialRequests: '',
  extraItems: [],
});

const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizeDate = (d?: string | null): string => {
  if (!d) return new Date().toISOString().split('T')[0];
  return String(d).split('T')[0];
};

export const PartiesPage: React.FC<PartiesPageProps> = ({ searchTerm, showToast }) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyForm, setPartyForm] = useState<Partial<Party>>(emptyPartyForm());

  const [settlingParty, setSettlingParty] = useState<Party | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);

  // ===== Filters =====
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'' | 'PAID' | 'PARTIAL' | 'PENDING'>('');

  const activeFilterCount =
    (deptFilter ? 1 : 0) + (paymentFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearFilters = () => {
    setLocalSearch('');
    setDeptFilter('');
    setDateFrom('');
    setDateTo('');
    setPaymentFilter('');
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // One request; the KPI cards are calculated from this list (see `summary` below)
      const list = await api.party.getAll();
      setParties(Array.isArray(list) ? list : []);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to load party catering bookings');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateBill = (p: Partial<Party>) => {
    const base = toNumber(p.numberOfPeople) * toNumber(p.thaliRate);
    const extras = Array.isArray(p.extraItems)
      ? p.extraItems.reduce(
        (s, it) => s + toNumber((it as any)?.quantity) * toNumber((it as any)?.rate),
        0
      )
      : 0;
    const disc = toNumber(p.discount);
    return Math.max(0, base + extras - disc);
  };

  const openCreateModal = () => {
    setEditingParty(null);
    setPartyForm(emptyPartyForm());
    setIsPartyModalOpen(true);
  };

  const openEditModal = (p: Party) => {
    setEditingParty(p);
    setPartyForm({
      ...p,
      // Backend only persists contactPerson/phoneNumber — map them back onto
      // the form's clientName/clientPhone fields so editing pre-fills them.
      clientName: p.clientName || p.contactPerson || '',
      clientPhone: p.clientPhone || p.phoneNumber || '',
      partyType: p.partyType || '',
      eventTime: p.eventTime || '',
      eventDate: normalizeDate(p.eventDate),
      paidAmount: toNumber(p.paidAmount),
      advanceAmount: toNumber(p.advanceAmount),
      numberOfPeople: toNumber(p.numberOfPeople),
      thaliRate: toNumber(p.thaliRate),
      extraItems: Array.isArray(p.extraItems) ? p.extraItems : [],
      mealType: p.mealType || 'VEG',
      departmentName: p.departmentName || '',
    });
    setIsPartyModalOpen(true);
  };

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyForm.clientName?.trim() || !partyForm.clientPhone?.trim()) {
      showToast('error', 'Client Name and Contact are required');
      return;
    }

    try {
      const payload: Partial<Party> = {
        ...partyForm,
        mealType: partyForm.mealType || 'VEG',
        partyName: partyForm.partyName || partyForm.clientName,
        contactPerson: partyForm.clientName.trim(),
        phoneNumber: partyForm.clientPhone.trim(),
        clientName: partyForm.clientName.trim(),
        clientPhone: partyForm.clientPhone.trim(),
        departmentName: (partyForm.departmentName || '').trim() || undefined,
        eventDate: normalizeDate(partyForm.eventDate),
        numberOfPeople: toNumber(partyForm.numberOfPeople),
        thaliRate: toNumber(partyForm.thaliRate),
        paidAmount: toNumber(partyForm.paidAmount),
        advanceAmount: toNumber(partyForm.paidAmount),
        extraItems: Array.isArray(partyForm.extraItems) ? partyForm.extraItems : [],
      };

      if (editingParty?.id) {
        await api.party.update(editingParty.id, payload);
        showToast('success', 'Party booking updated');
      } else {
        await api.party.create(payload as Party);
        showToast('success', 'New party booking confirmed');
      }
      setIsPartyModalOpen(false);
      setEditingParty(null);
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save booking');
    }
  };

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingParty?.id || settleAmount <= 0) return;

    try {
      const payment = {
        partyId: settlingParty.id,
        amount: Number(settleAmount),
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'UPI',
        receiptNumber: `REC-PTY-${Date.now().toString().slice(-6)}`,
        remarks: 'Payment received towards final catering bill',
      } as PartyPayment;

      await api.party.makePayment(payment);
      showToast('success', `Recorded payment of ₹${settleAmount}`);
      setSettlingParty(null);
      setSettleAmount(0);
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Payment record failed');
    }
  };

  const handleDelete = async (p: Party) => {
    if (!p.id) return;
    if (confirm(`Delete booking for "${p.partyName || p.clientName}"?`)) {
      try {
        await api.party.delete(p.id);
        showToast('success', 'Party booking removed');
        await loadData();
      } catch (err: any) {
        showToast('error', err?.message || 'Failed to delete');
      }
    }
  };

  const filtered = useMemo(() => {
    const q = (searchTerm || localSearch || '').trim().toLowerCase();

    return parties.filter((p) => {
      if (q) {
        const haystack = [
          p.partyName,
          p.clientName,
          p.partyId,
          p.clientPhone,
          p.phoneNumber,
          p.departmentName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (deptFilter && (p.departmentName || '').trim().toLowerCase() !== deptFilter) return false;
      if (paymentFilter && (p.paymentStatus || '') !== paymentFilter) return false;

      const pDate = normalizeDate(p.eventDate);
      if (dateFrom && pDate < dateFrom) return false;
      if (dateTo && pDate > dateTo) return false;

      return true;
    });
  }, [parties, searchTerm, localSearch, deptFilter, paymentFilter, dateFrom, dateTo]);

  // KPI cards: calculated from the orders listed below, using the same bill maths as each row
  const summary = useMemo<PartySummary>(() => {
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    filtered.forEach((p) => {
      const bill = calculateBill(p);
      const paid = toNumber(p.paidAmount);
      totalRevenue += bill;
      totalPaid += paid;
      totalOutstanding += Math.max(0, bill - paid);
    });
    return { totalParties: filtered.length, totalRevenue, totalPaid, totalOutstanding };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const hasActiveFilters =
    !!localSearch || !!deptFilter || !!dateFrom || !!dateTo || !!paymentFilter;

  const uniqueDepartmentNames = useMemo(() => {
    const names = new Set<string>();
    parties.forEach((p) => {
      const n = (p.departmentName || '').trim();
      if (n) names.add(n);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [parties]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Banquet & Special Event Orders
          </h2>
          <p className="text-sm text-slate-500">
            Per-head rate calculations, advance deposits & invoicing
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center w-full sm:w-auto min-h-11 space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded-lg text-sm shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Party Order</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] sm:text-sm text-slate-500 font-semibold sm:font-medium">Total Bookings</div>
          <div className="text-lg sm:text-2xl leading-tight font-bold break-words text-slate-900 mt-0.5 sm:mt-1.5">
            {summary.totalParties}{' '}
            <span className="text-base font-medium text-slate-500">events</span>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] sm:text-sm text-slate-500 font-semibold sm:font-medium">Gross Invoiced</div>
          <div className="text-lg sm:text-2xl leading-tight font-bold break-words text-slate-900 mt-0.5 sm:mt-1.5">
            ₹{summary.totalRevenue.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] sm:text-sm text-emerald-700 font-semibold sm:font-medium">Payments Received</div>
          <div className="text-lg sm:text-2xl leading-tight font-bold break-words text-emerald-600 mt-0.5 sm:mt-1.5">
            ₹{summary.totalPaid.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] sm:text-sm text-rose-700 font-semibold sm:font-medium">Pending Dues</div>
          <div className="text-lg sm:text-2xl leading-tight font-bold break-words text-rose-600 mt-0.5 sm:mt-1.5">
            ₹{summary.totalOutstanding.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-5 shadow-sm">
        {/* Phone: search + filters toggle */}
        <div className="md:hidden flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search party / client"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold inline-flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="hidden md:flex items-center justify-between mb-4">
          <div className="flex items-center text-slate-700 text-sm font-semibold">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-2 -my-2"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search party / client"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2 mt-2 md:mt-0 md:contents`}>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full h-10 md:h-auto px-3 md:py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="">All Departments</option>
            {uniqueDepartmentNames.map((name) => (
              <option key={name} value={name.toLowerCase()}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as '' | 'PAID' | 'PARTIAL' | 'PENDING')
            }
            className="w-full h-10 md:h-auto px-3 md:py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="">All Payment Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="PENDING">Pending</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
            className="w-full h-10 md:h-auto px-3 md:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
            className="w-full h-10 md:h-auto px-3 md:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="md:hidden col-span-2 text-xs font-semibold text-rose-600 py-1"
            >
              Clear all
            </button>
          )}
          </div>
        </div>

        <div className="mt-2 sm:mt-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filtered.length}</span>
          <span className="md:hidden"> bookings</span>
          <span className="hidden md:inline">
            {' '}of <span className="font-semibold text-slate-700">{parties.length}</span> bookings
          </span>
        </div>
      </div>

      {/* Parties — Card View */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400 text-sm">
          Loading party catering orders…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400 text-sm">
          No party catering orders match your filters.
        </div>
      ) : (
        <>
        {/* Phone: compact list rows (tap a row for full details) */}
        <div className="md:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {filtered.map((p) => {
            const totalBill = calculateBill(p);
            const paid = toNumber(p.paidAmount);
            const balance = Math.max(0, totalBill - paid);
            const status =
              p.paymentStatus ||
              (balance === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING');
            return (
              <button
                type="button"
                key={p.id || p.partyId}
                onClick={() => setDetailKey(String(p.id || p.partyId))}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 active:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold text-slate-900 truncate">
                      {p.partyName || p.clientName || p.departmentName || 'Untitled Party'}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 shrink-0">
                      ₹{totalBill.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {balance === 0 ? (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" /> Settled
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        {status}
                      </span>
                    )}
                    <Fact icon={Calendar} label="Event date">{normalizeDate(p.eventDate)}</Fact>
                    {!!p.numberOfPeople && <Fact icon={Users} label="Guests">{p.numberOfPeople}</Fact>}
                    {balance > 0 && <Fact icon={IndianRupee} label="Balance due" tone="bad">{balance.toLocaleString()}</Fact>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        {(() => {
          const d = detailKey != null ? filtered.find((x) => String(x.id || x.partyId) === detailKey) : undefined;
          if (!d) return null;
          const totalBill = calculateBill(d);
          const paid = toNumber(d.paidAmount);
          const balance = Math.max(0, totalBill - paid);
          const status =
            d.paymentStatus ||
            (balance === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING');
          const email = d.clientEmail || d.email;
          return (
            <DetailSheet
              open
              onClose={() => setDetailKey(null)}
              title={d.partyName || d.clientName || 'Untitled Party'}
              subtitle={d.departmentName || 'General'}
              badges={
                balance === 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> Settled
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    {status}
                  </span>
                )
              }
              headline={`₹${totalBill.toLocaleString()}`}
              fields={[
                { icon: Hash, label: 'Booking ID', value: d.partyId },
                ...(d.invoiceNumber ? [{ icon: Receipt, label: 'Invoice', value: d.invoiceNumber }] : []),
                { icon: Users, label: 'Client', value: d.clientName || d.contactPerson || '—' },
                { icon: Phone, label: 'Phone', value: d.clientPhone || d.phoneNumber || '—' },
                ...(email ? [{ icon: Mail, label: 'Email', value: email, wide: true }] : []),
                { icon: Calendar, label: 'Event date', value: normalizeDate(d.eventDate) },
                { icon: Clock, label: 'Time', value: d.eventTime || '—' },
                { icon: Users, label: 'Guests', value: d.numberOfPeople || 0 },
                { icon: IndianRupee, label: 'Rate per thali', value: `₹${d.thaliRate || 0}` },
                { icon: Utensils, label: 'Party type', value: d.partyType || '—' },
                { icon: Utensils, label: 'Meal', value: d.mealType || 'VEG' },
                { icon: Building2, label: 'Department', value: d.departmentName || 'General' },
                ...(d.additionalDepartments
                  ? [{ icon: Building2, label: 'Joint with', value: d.additionalDepartments, wide: true }]
                  : []),
                ...(d.specialRequests
                  ? [{ icon: StickyNote, label: 'Party menu', value: d.specialRequests, wide: true }]
                  : []),
                { icon: Receipt, label: 'Total bill', value: `₹${totalBill.toLocaleString()}` },
                { icon: CheckCircle2, label: 'Paid', value: `₹${paid.toLocaleString()}`, tone: 'good' as const },
                { icon: IndianRupee, label: 'Balance', value: `₹${balance.toLocaleString()}`, tone: balance > 0 ? ('bad' as const) : ('good' as const) },
              ]}
              actions={[
                ...(balance > 0
                  ? [{
                      label: 'Receive payment',
                      icon: IndianRupee,
                      tone: 'primary' as const,
                      onClick: () => {
                        setDetailKey(null);
                        setSettlingParty(d);
                        setSettleAmount(balance);
                      },
                    }]
                  : []),
                { label: 'Edit', icon: Edit2, onClick: () => { setDetailKey(null); openEditModal(d); } },
                { label: 'Delete', icon: Trash2, tone: 'danger' as const, onClick: () => { setDetailKey(null); handleDelete(d); } },
              ]}
            />
          );
        })()}
        <div className="hidden md:block space-y-4">
          {filtered.map((p) => {
            const totalBill = calculateBill(p);
            const paid = toNumber(p.paidAmount);
            const balance = Math.max(0, totalBill - paid);
            const status =
              p.paymentStatus ||
              (balance === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING');

            return (
              <div
                key={p.id || p.partyId}
                className="relative bg-white border border-slate-200 rounded-2xl lg:rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <span
                  className={`lg:hidden absolute inset-y-0 left-0 w-1 ${
                    balance === 0 ? 'bg-emerald-500' : paid > 0 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  {/* Left — Party info */}
                  <div className="lg:col-span-8 p-4 pl-5 sm:p-5 sm:pl-6 lg:pl-5 border-b lg:border-b-0 lg:border-r border-slate-100">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {p.partyId}
                          </span>
                          {p.invoiceNumber && (
                            <span className="text-xs text-slate-400 font-mono">
                              {p.invoiceNumber}
                            </span>
                          )}
                        </div>
                        <h3 className="text-[15px] sm:text-lg font-semibold sm:font-bold leading-snug text-slate-900 mt-2 break-words">
                          {p.departmentName || 'General'}
                        </h3>
                        <div className="text-sm text-slate-500 mt-0.5 break-words">
                          {p.partyName || p.clientName || 'Untitled Party'}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="lg:hidden text-right">
                          <div className="text-lg font-bold tabular-nums text-slate-900">
                            ₹{totalBill.toLocaleString()}
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Total
                          </div>
                        </div>
                        {balance === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold sm:font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold sm:font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center text-sm text-slate-700 min-w-0">
                        <Phone className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold break-words">
                            {p.clientName || p.contactPerson || '—'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {p.clientPhone || p.phoneNumber || '—'}
                          </div>
                        </div>
                      </div>

                      {(p.clientEmail || p.email) && (
                        <div className="flex items-center text-sm text-slate-700 min-w-0">
                          <Mail className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                          <div className="text-xs truncate">{p.clientEmail || p.email}</div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 pt-4 border-t border-slate-100">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 sm:text-xs sm:font-normal sm:normal-case sm:tracking-normal sm:text-slate-500">Event</div>
                        <div className="flex items-center text-sm font-semibold text-slate-800">
                          <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {normalizeDate(p.eventDate)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {p.eventTime || '—'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 sm:text-xs sm:font-normal sm:normal-case sm:tracking-normal sm:text-slate-500">Guests</div>
                        <div className="flex items-center text-sm font-semibold text-slate-800">
                          <Users className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {p.numberOfPeople || 0}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          @ ₹{p.thaliRate || 0} / thali
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 sm:text-xs sm:font-normal sm:normal-case sm:tracking-normal sm:text-slate-500">Type</div>
                        <div className="flex items-center text-sm font-semibold text-slate-800">
                          <Utensils className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {p.partyType || '—'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {p.mealType || 'VEG'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 sm:text-xs sm:font-normal sm:normal-case sm:tracking-normal sm:text-slate-500">Department</div>
                        {p.departmentName ? (
                          <div className="flex items-start">
                            <Building2 className="w-3.5 h-3.5 mr-1.5 mt-0.5 text-slate-400 shrink-0" />
                            <div className="text-sm font-semibold text-slate-800 truncate">
                              {p.departmentName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">General</span>
                        )}
                      </div>
                    </div>

                    {p.additionalDepartments && (
                      <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block break-words">
                        + Joint with: {p.additionalDepartments}
                      </div>
                    )}

                    {p.specialRequests && (
                      <div className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 break-words">
                        <span className="font-semibold text-slate-700">Party Menu:</span>{' '}
                        {p.specialRequests}
                      </div>
                    )}
                  </div>

                  {/* Right — Billing & Actions */}
                  <div className="lg:col-span-4 bg-slate-50/70 lg:bg-slate-50/50 p-3 sm:p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center text-xs text-slate-500 mb-3 font-semibold uppercase tracking-wider">
                        <Receipt className="w-3.5 h-3.5 mr-1.5" />
                        Billing Summary
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Total Bill</span>
                          <span className="font-bold text-slate-900">
                            ₹{totalBill.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Paid</span>
                          <span className="font-semibold text-emerald-700">
                            ₹{paid.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                          <span className="text-slate-700 font-semibold">Balance</span>
                          <span
                            className={`font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                          >
                            ₹{balance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 lg:mt-5 flex flex-col gap-2">
                      {balance > 0 && (
                        <button
                          onClick={() => {
                            setSettlingParty(p);
                            setSettleAmount(balance);
                          }}
                          aria-label="Receive payment"
                          className="w-full inline-flex items-center justify-center min-h-11 sm:min-h-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors"
                        >
                          <IndianRupee className="w-4 h-4 mr-1.5" />
                          Receive Payment
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(p)}
                          aria-label="Edit booking"
                          className="flex-1 inline-flex items-center justify-center min-h-11 sm:min-h-0 px-3 py-2 border border-slate-300 hover:bg-white bg-white text-slate-700 font-semibold rounded-lg text-sm transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          aria-label="Delete booking"
                          className="flex-1 inline-flex items-center justify-center min-h-11 sm:min-h-0 px-3 py-2 border border-rose-100 lg:border-rose-200 hover:bg-rose-100 bg-rose-50 lg:bg-white text-rose-700 lg:text-rose-600 font-semibold rounded-lg text-sm transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Settle Payment Modal */}
      {settlingParty && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full max-h-[92dvh] overflow-y-auto">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Receive Party Payment</h3>
              <button
                onClick={() => setSettlingParty(null)}
                className="p-2 -mr-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSettlePayment} className="p-4 sm:p-5 space-y-4 text-sm">
              <div>
                <div className="font-bold text-slate-900 text-base">
                  {settlingParty.clientName || settlingParty.contactPerson}
                </div>
                <div className="text-slate-500 text-xs mt-0.5">
                  Booking ID: {settlingParty.partyId}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5 text-sm">
                  Amount to Collect (₹) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold text-slate-900 text-base"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingParty(null)}
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-0 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm text-sm"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Party Modal */}
      {isPartyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92dvh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingParty ? 'Edit Party Booking' : 'New Party / Catering Booking'}
              </h3>
              <button
                onClick={() => setIsPartyModalOpen(false)}
                className="p-2 -mr-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveParty}
              className="p-4 sm:p-6 space-y-5 text-sm flex-1 min-h-0 overflow-y-auto"
            >
              {/* ===== Client ===== */}
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Client Information
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Department Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Department of Physics"
                      value={partyForm.departmentName || ''}
                      onChange={(e) =>
                        setPartyForm({
                          ...partyForm,
                          departmentName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Client Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={partyForm.clientPhone || ''}
                      onChange={(e) =>
                        setPartyForm({ ...partyForm, clientPhone: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Event Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Amit's Birthday"
                      value={partyForm.partyName || ''}
                      onChange={(e) =>
                        setPartyForm({ ...partyForm, partyName: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Amit Verma"
                      value={partyForm.clientName || ''}
                      onChange={(e) =>
                        setPartyForm({ ...partyForm, clientName: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* ===== Event Details ===== */}
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Event Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Event Date
                    </label>
                    <input
                      type="date"
                      value={normalizeDate(partyForm.eventDate)}
                      onChange={(e) =>
                        setPartyForm({ ...partyForm, eventDate: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Event Time
                    </label>
                    <input
                      type="time"
                      value={partyForm.eventTime || ''}
                      onChange={(e) =>
                        setPartyForm({ ...partyForm, eventTime: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Party Type
                    </label>
                    <select
                      value={partyForm.partyType || ''}
                      onChange={(e) =>
                        setPartyForm({ ...partyForm, partyType: e.target.value as any })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                    >
                      <option value="">Select type…</option>
                      <option value="BIRTHDAY">Birthday</option>
                      <option value="FAREWELL">Farewell</option>
                      <option value="FESTIVAL">Festival Special</option>
                      <option value="CORPORATE">Corporate Meet</option>
                      <option value="OTHER">Other Gathering</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Meal Type *
                    </label>
                    <select
                      value={partyForm.mealType || 'VEG'}
                      onChange={(e) =>
                        setPartyForm({ ...partyForm, mealType: e.target.value as any })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="VEG">Veg</option>
                      <option value="NON_VEG">Non-Veg</option>
                      <option value="BOTH">Both</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ===== Billing ===== */}
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Billing
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Guests / People *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 40"
                      value={partyForm.numberOfPeople ?? ''}
                      onChange={(e) =>
                        setPartyForm({
                          ...partyForm,
                          numberOfPeople:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Thali Rate (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="e.g. 250"
                      value={partyForm.thaliRate ?? ''}
                      onChange={(e) =>
                        setPartyForm({
                          ...partyForm,
                          thaliRate:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Advance Received (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={partyForm.paidAmount ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 0 : Number(e.target.value);
                        setPartyForm({
                          ...partyForm,
                          paidAmount: v,
                          advanceAmount: v,
                        });
                      }}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-amber-950 text-base">
                    Total Estimated Bill
                  </div>
                  <div className="text-xs text-amber-800 mt-0.5">
                    {partyForm.numberOfPeople || 0} guests × ₹{partyForm.thaliRate || 0} per thali
                  </div>
                </div>
                <div className="text-2xl font-bold text-amber-950">
                  ₹{calculateBill(partyForm).toLocaleString()}
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Party Menu
                </div>
                <textarea
                  rows={3}
                  placeholder="e.g. Shahi Paneer, Dal Makhani, Gulab Jamun, Welcome Drinks"
                  value={partyForm.specialRequests || ''}
                  onChange={(e) =>
                    setPartyForm({ ...partyForm, specialRequests: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 pb-1 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsPartyModalOpen(false)}
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-0 px-5 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-0 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-sm"
                >
                  {editingParty ? 'Update Booking' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};