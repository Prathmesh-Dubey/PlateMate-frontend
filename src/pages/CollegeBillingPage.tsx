// src/pages/CollegeBillingPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Building2,
  IndianRupee,
  Calendar,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  X,
  CreditCard,
  Percent,
  Users,
  Utensils,
  Calculator,
  ChevronRight,
  TrendingUp,
  Receipt,
  FileText,
  SlidersHorizontal,
  StickyNote
} from 'lucide-react';
import api from '../api';
import { Fact, DetailSheet } from '../components/DetailSheet';
import type { CollegeBilling, CollegeBillingRequest, CollegeBillingSummary, CollegeBillingPaymentStatus } from '../types';

interface CollegeBillingPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const CollegeBillingPage: React.FC<CollegeBillingPageProps> = ({ searchTerm: globalSearchTerm, showToast }) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailId, setDetailId] = useState<CollegeBilling['id'] | null>(null);
  const [records, setRecords] = useState<CollegeBilling[]>([]);
  const [collegesList, setCollegesList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States
  const [selectedCollege, setSelectedCollege] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isQuickPayModalOpen, setIsQuickPayModalOpen] = useState<boolean>(false);

  const [editingRecord, setEditingRecord] = useState<CollegeBilling | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<CollegeBilling | null>(null);
  const [quickPayRecord, setQuickPayRecord] = useState<CollegeBilling | null>(null);

  // Form State
  const [form, setForm] = useState<{
    college: string;
    isCustomCollege: boolean;
    customCollegeName: string;
    billingDate: string;
    month: number;
    year: number;
    totalBillableAmount: string;
    amountReceived: string;
    totalStudentAttendance: string;
    totalThalisServed: string;
    ratePerThali: string;
    remarks: string;
  }>({
    college: '',
    isCustomCollege: false,
    customCollegeName: '',
    billingDate: new Date().toISOString().split('T')[0],
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    totalBillableAmount: '',
    amountReceived: '0',
    totalStudentAttendance: '',
    totalThalisServed: '',
    ratePerThali: '',
    remarks: '',
  });

  // Quick Pay State
  const [quickPayAmount, setQuickPayAmount] = useState<string>('');

  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Load Data
  // All records are loaded once (2 requests total, both cached). College / month / year
  // filters, the summary boxes and the table are all calculated from this list in the
  // browser, so changing a filter never hits the backend.
  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, colleges] = await Promise.all([
        api.collegeBilling.getAll(),
        api.collegeBilling.getColleges(),
      ]);

      setRecords(data || []);
      setCollegesList(colleges || []);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to load college billing records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Records inside the selected college / month / year scope
  const scopedRecords = useMemo(
    () =>
      records.filter(
        (r) =>
          (selectedCollege === 'ALL' || r.college === selectedCollege) &&
          (selectedMonth === 'ALL' || r.month === Number(selectedMonth)) &&
          (selectedYear === 'ALL' || r.year === Number(selectedYear))
      ),
    [records, selectedCollege, selectedMonth, selectedYear]
  );

  // Summary boxes: calculated from the scoped records above
  const summary: CollegeBillingSummary = useMemo(() => {
    let totalBillableAmount = 0;
    let totalAmountReceived = 0;
    let paidCount = 0;
    let partiallyPaidCount = 0;
    let unpaidCount = 0;
    scopedRecords.forEach((r) => {
      totalBillableAmount += Number(r.totalBillableAmount) || 0;
      totalAmountReceived += Number(r.amountReceived) || 0;
      if (r.status === 'PAID') paidCount += 1;
      else if (r.status === 'PARTIALLY_PAID') partiallyPaidCount += 1;
      else unpaidCount += 1;
    });
    return {
      totalBillableAmount,
      totalAmountReceived,
      totalOutstandingBalance: Math.max(0, totalBillableAmount - totalAmountReceived),
      totalRecords: scopedRecords.length,
      paidCount,
      partiallyPaidCount,
      unpaidCount,
    };
  }, [scopedRecords]);

  // Client-side search and status filtering
  const filteredRecords = useMemo(() => {
    return scopedRecords.filter(item => {
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      // Search term
      const query = globalSearchTerm.trim().toLowerCase();
      if (!query) return true;

      const collegeMatch = (item.college || '').toLowerCase().includes(query);
      const monthMatch = (item.monthName || MONTH_NAMES[item.month - 1] || '').toLowerCase().includes(query);
      const yearMatch = (item.year || '').toString().includes(query);
      const remarksMatch = (item.remarks || '').toLowerCase().includes(query);
      const billableMatch = (item.totalBillableAmount || '').toString().includes(query);
      const statusMatch = (item.status || '').toLowerCase().includes(query);

      return collegeMatch || monthMatch || yearMatch || remarksMatch || billableMatch || statusMatch;
    });
  }, [scopedRecords, globalSearchTerm, statusFilter]);

  // Derived calculations for Form
  const formBillable = parseFloat(form.totalBillableAmount) || 0;
  const formReceived = parseFloat(form.amountReceived) || 0;
  const formOutstanding = Math.max(0, formBillable - formReceived);

  const formAutoStatus: CollegeBillingPaymentStatus = useMemo(() => {
    if (formReceived <= 0) return 'UNPAID';
    if (formReceived < formBillable) return 'PARTIALLY_PAID';
    return 'PAID';
  }, [formBillable, formReceived]);

  // Handle open Add Modal
  const openAddModal = () => {
    setEditingRecord(null);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setForm({
      college: collegesList.length > 0 ? collegesList[0] : '',
      isCustomCollege: collegesList.length === 0,
      customCollegeName: '',
      billingDate: todayStr,
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      totalBillableAmount: '',
      amountReceived: '0',
      totalStudentAttendance: '',
      totalThalisServed: '',
      ratePerThali: '',
      remarks: '',
    });
    setIsFormModalOpen(true);
  };

  // Handle open Edit Modal
  const openEditModal = (rec: CollegeBilling) => {
    setEditingRecord(rec);
    const inList = collegesList.includes(rec.college);
    const dateStr = rec.billingDate
      ? rec.billingDate.split('T')[0]
      : (rec.createdAt ? rec.createdAt.split('T')[0] : `${rec.year}-${String(rec.month).padStart(2, '0')}-01`);

    setForm({
      college: inList ? rec.college : '__CUSTOM__',
      isCustomCollege: !inList,
      customCollegeName: inList ? '' : rec.college,
      billingDate: dateStr,
      month: rec.month,
      year: rec.year,
      totalBillableAmount: rec.totalBillableAmount.toString(),
      amountReceived: rec.amountReceived.toString(),
      totalStudentAttendance: rec.totalStudentAttendance != null ? rec.totalStudentAttendance.toString() : '',
      totalThalisServed: rec.totalThalisServed != null ? rec.totalThalisServed.toString() : '',
      ratePerThali: rec.ratePerThali != null ? rec.ratePerThali.toString() : '',
      remarks: rec.remarks || '',
    });
    setIsFormModalOpen(true);
  };

  // Handle Save Form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const collegeName = form.isCustomCollege
      ? form.customCollegeName.trim()
      : (form.college === '__CUSTOM__' ? form.customCollegeName.trim() : form.college.trim());

    if (!collegeName) {
      showToast('error', 'College name is required');
      return;
    }

    if (formBillable < 0) {
      showToast('error', 'Total Billable Amount cannot be negative');
      return;
    }

    if (formReceived < 0) {
      showToast('error', 'Amount Received cannot be negative');
      return;
    }

    const payload: CollegeBillingRequest = {
      college: collegeName,
      billingDate: form.billingDate || undefined,
      month: Number(form.month),
      year: Number(form.year),
      totalBillableAmount: formBillable,
      amountReceived: formReceived,
      totalStudentAttendance: form.totalStudentAttendance ? parseInt(form.totalStudentAttendance, 10) : undefined,
      totalThalisServed: form.totalThalisServed ? parseInt(form.totalThalisServed, 10) : undefined,
      ratePerThali: form.ratePerThali ? parseFloat(form.ratePerThali) : undefined,
      remarks: form.remarks ? form.remarks.trim() : undefined,
    };

    try {
      setFormSubmitting(true);
      if (editingRecord?.id) {
        await api.collegeBilling.update(editingRecord.id, payload);
        showToast('success', `Billing updated for ${collegeName} (${MONTH_NAMES[form.month - 1]} ${form.year})`);
      } else {
        await api.collegeBilling.create(payload);
        showToast('success', `Billing created for ${collegeName} (${MONTH_NAMES[form.month - 1]} ${form.year})`);
      }
      setIsFormModalOpen(false);
      await fetchData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save billing record');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Helper to auto-calculate billable from thalis * rate
  const handleCalculateFromThalis = () => {
    const thalis = parseInt(form.totalThalisServed, 10) || 0;
    const rate = parseFloat(form.ratePerThali) || 0;
    if (thalis > 0 && rate > 0) {
      const calc = Math.round(thalis * rate * 100) / 100;
      setForm(prev => ({ ...prev, totalBillableAmount: calc.toString() }));
      showToast('info', `Billable Amount set to ₹${calc.toLocaleString('en-IN')} (${thalis} thalis × ₹${rate})`);
    } else {
      showToast('error', 'Please enter valid numbers for Total Thalis Served and Rate per Thali first');
    }
  };

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!deletingRecord?.id) return;
    try {
      await api.collegeBilling.delete(deletingRecord.id);
      showToast('success', `Billing for ${deletingRecord.college} deleted successfully`);
      setIsDeleteModalOpen(false);
      setDeletingRecord(null);
      await fetchData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete billing record');
    }
  };

  // Quick Pay Submit
  const handleQuickPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayRecord?.id) return;

    const additionalAmount = parseFloat(quickPayAmount) || 0;
    if (additionalAmount <= 0) {
      showToast('error', 'Please enter a positive payment amount');
      return;
    }

    const newReceived = (quickPayRecord.amountReceived || 0) + additionalAmount;
    const payload: CollegeBillingRequest = {
      college: quickPayRecord.college,
      billingDate: quickPayRecord.billingDate,
      month: quickPayRecord.month,
      year: quickPayRecord.year,
      totalBillableAmount: quickPayRecord.totalBillableAmount,
      amountReceived: newReceived,
      totalStudentAttendance: quickPayRecord.totalStudentAttendance,
      totalThalisServed: quickPayRecord.totalThalisServed,
      ratePerThali: quickPayRecord.ratePerThali,
      remarks: quickPayRecord.remarks ? `${quickPayRecord.remarks} | Added payment: ₹${additionalAmount}` : `Added payment: ₹${additionalAmount}`,
    };

    try {
      setFormSubmitting(true);
      await api.collegeBilling.update(quickPayRecord.id, payload);
      showToast('success', `Payment of ₹${additionalAmount.toLocaleString('en-IN')} applied. New status: ${newReceived >= quickPayRecord.totalBillableAmount ? 'PAID' : 'PARTIALLY_PAID'}`);
      setIsQuickPayModalOpen(false);
      setQuickPayRecord(null);
      setQuickPayAmount('');
      await fetchData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to record payment');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Format currency in Indian format
  const formatINR = (val: number | undefined | null): string => {
    if (val == null) return '₹0';
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Status Badge Component
  const renderStatusBadge = (status: CollegeBillingPaymentStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            PAID
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            PARTIALLY PAID
          </span>
        );
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            UNPAID
          </span>
        );
    }
  };

  // Collection percentage
  const collectionPct = summary && summary.totalBillableAmount > 0
    ? Math.min(100, Math.round((summary.totalAmountReceived / summary.totalBillableAmount) * 100))
    : 0;

  const activeFilterCount =
    (selectedCollege !== 'ALL' ? 1 : 0) +
    (selectedMonth !== 'ALL' ? 1 : 0) +
    (selectedYear !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0);
  const clearAllFilters = () => {
    setSelectedCollege('ALL');
    setSelectedMonth('ALL');
    setSelectedYear('ALL');
    setStatusFilter('ALL');
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Top Filter & Action Bar */}
      <div className="bg-white p-3 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">College Monthly Billing</h2>
          </div>
          <p className="hidden sm:block text-xs text-slate-500 mt-0.5">
            Track monthly billable receivables, partial & full payments, and outstanding balances by college
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Phone: filters toggle */}
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            aria-expanded={filtersOpen}
            className="order-1 flex-1 sm:hidden h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold inline-flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {filtersOpen && activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="order-5 w-full sm:hidden text-xs font-semibold text-rose-600 py-1"
            >
              Clear all
            </button>
          )}
          {/* College Filter */}
          <div className={`${filtersOpen ? 'flex' : 'hidden'} order-4 sm:order-none w-[calc(50%-0.25rem)] sm:w-auto sm:flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5 min-w-0`}>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600">College:</span>
            <select
              value={selectedCollege}
              onChange={e => setSelectedCollege(e.target.value)}
              className="w-full sm:w-auto min-h-10 sm:min-h-0 px-3 py-2 sm:py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none sm:max-w-[160px] truncate"
            >
              <option value="ALL">All Colleges</option>
              {collegesList.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className={`${filtersOpen ? 'flex' : 'hidden'} order-4 sm:order-none w-[calc(50%-0.25rem)] sm:w-auto sm:flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5 min-w-0`}>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600">Month:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full sm:w-auto min-h-10 sm:min-h-0 px-3 py-2 sm:py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Months</option>
              {MONTH_NAMES.map((mName, idx) => (
                <option key={idx + 1} value={(idx + 1).toString()}>
                  {mName}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className={`${filtersOpen ? 'flex' : 'hidden'} order-4 sm:order-none w-[calc(50%-0.25rem)] sm:w-auto sm:flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5 min-w-0`}>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600">Year:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full sm:w-auto min-h-10 sm:min-h-0 px-3 py-2 sm:py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Years</option>
              {[2024, 2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y.toString()}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className={`${filtersOpen ? 'flex' : 'hidden'} order-4 sm:order-none w-[calc(50%-0.25rem)] sm:w-auto sm:flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5 min-w-0`}>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto min-h-10 sm:min-h-0 px-3 py-2 sm:py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => { api.clearCache(); fetchData(); }}
            disabled={loading}
            className="order-2 sm:order-none flex items-center justify-center h-10 w-10 sm:h-auto sm:w-auto sm:min-h-0 p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh Records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Add Monthly Bill CTA */}
          <button
            onClick={openAddModal}
            className="order-3 sm:order-none justify-center h-10 sm:h-auto sm:min-h-0 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg flex items-center space-x-1.5 shadow-sm transition-all shadow-blue-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span><span className="sm:hidden">Add Bill</span><span className="hidden sm:inline">Add Monthly Bill</span></span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-5">
        {/* Total Billable Amount */}
        <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 gap-1">
            <span className="truncate">Total Billable Amount</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-2xl leading-tight font-bold break-words text-slate-900 mt-0.5 sm:mt-2">
            {formatINR(summary?.totalBillableAmount)}
          </div>
          <div className="hidden sm:flex mt-2 pt-2 border-t border-slate-100 flex-wrap items-center justify-between gap-x-2 text-[11px] text-slate-500">
            <span>{summary?.totalRecords || 0} monthly bills</span>
            <span className="font-semibold text-blue-600">Total Billed</span>
          </div>
        </div>

        {/* Amount Received */}
        <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 gap-1">
            <span>Amount Received</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-2xl leading-tight font-bold break-words text-emerald-600 mt-2">
            {formatINR(summary?.totalAmountReceived)}
          </div>
          <div className="hidden sm:flex mt-2 pt-2 border-t border-slate-100 flex-wrap items-center justify-between gap-x-2 text-[11px] text-slate-500">
            <span>{summary?.paidCount || 0} fully paid bills</span>
            <span className="text-emerald-700 font-semibold">{collectionPct}% collected</span>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 gap-1">
            <span>Outstanding Balance</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-2xl leading-tight font-bold break-words text-rose-600 mt-2">
            {formatINR(summary?.totalOutstandingBalance)}
          </div>
          <div className="hidden sm:flex mt-2 pt-2 border-t border-slate-100 flex-wrap items-center justify-between gap-x-2 text-[11px] text-slate-500">
            <span>{summary?.unpaidCount || 0} unpaid · {summary?.partiallyPaidCount || 0} partial</span>
            <span className="text-rose-600 font-semibold">Pending</span>
          </div>
        </div>

        {/* Collection Rate & Overview */}
        <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 gap-1">
            <span>Recovery Rate</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg sm:text-2xl leading-tight font-bold break-words text-slate-900 mt-2 flex items-baseline gap-2">
            <span>{collectionPct}%</span>
            <span className="text-xs font-normal text-slate-500">recovery</span>
          </div>
          <div className="mt-1.5 sm:mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* College Billing Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">
              Showing: {filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}
            </span>
            {selectedCollege !== 'ALL' && (
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-[10px]">
                {selectedCollege}
              </span>
            )}
            {selectedMonth !== 'ALL' && (
              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold text-[10px]">
                {MONTH_NAMES[Number(selectedMonth) - 1]}
              </span>
            )}
            {selectedYear !== 'ALL' && (
              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold text-[10px]">
                {selectedYear}
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <div>
              Total Billed: <strong className="text-slate-900">{formatINR(summary?.totalBillableAmount)}</strong>
            </div>
            <div>
              Outstanding: <strong className="text-rose-600">{formatINR(summary?.totalOutstandingBalance)}</strong>
            </div>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading college billing records...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 sm:p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <Building2 className="w-10 h-10 text-slate-300 stroke-1" />
            <div>
              <p className="font-semibold text-slate-700 text-sm">No billing records found</p>
              <p className="text-slate-400 mt-1">
                {globalSearchTerm
                  ? `No records matching "${globalSearchTerm}"`
                  : 'Start by creating your first monthly billing record for a college.'}
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="mt-2 min-h-10 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Monthly Bill</span>
            </button>
          </div>
        ) : (
          <>
          {/* Phone: compact list rows (tap a row for full details) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredRecords.map(item => {
              const monthName = item.monthName || MONTH_NAMES[item.month - 1];
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setDetailId(item.id)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2 active:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold text-slate-900 truncate">{item.college}</span>
                      <span className="text-sm font-bold tabular-nums text-slate-900 shrink-0">{formatINR(item.totalBillableAmount)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {renderStatusBadge(item.status)}
                      <Fact icon={Calendar} label="Billing month">{monthName} {item.year}</Fact>
                      {item.outstandingBalance > 0 && (
                        <Fact icon={AlertTriangle} label="Outstanding" tone="bad">{formatINR(item.outstandingBalance)}</Fact>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          {(() => {
            const d = detailId != null ? records.find(x => x.id === detailId) : undefined;
            if (!d) return null;
            const monthName = d.monthName || MONTH_NAMES[d.month - 1];
            const displayDate = d.billingDate
              ? new Date(d.billingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : '';
            return (
              <DetailSheet
                open
                onClose={() => setDetailId(null)}
                title={d.college}
                subtitle={`${monthName} ${d.year}`}
                badges={renderStatusBadge(d.status)}
                headline={formatINR(d.totalBillableAmount)}
                fields={[
                  { icon: Receipt, label: 'Billed', value: formatINR(d.totalBillableAmount) },
                  { icon: CheckCircle2, label: 'Received', value: formatINR(d.amountReceived), tone: 'good' },
                  { icon: AlertTriangle, label: 'Outstanding', value: formatINR(d.outstandingBalance), tone: d.outstandingBalance > 0 ? 'bad' : 'default' },
                  ...(displayDate ? [{ icon: Calendar, label: 'Billing date', value: displayDate }] : []),
                  ...(d.totalThalisServed != null && d.totalThalisServed > 0
                    ? [{ icon: Utensils, label: 'Thalis served', value: d.totalThalisServed.toLocaleString('en-IN') }]
                    : []),
                  ...(d.ratePerThali != null && d.ratePerThali > 0
                    ? [{ icon: IndianRupee, label: 'Rate per thali', value: `₹${d.ratePerThali}` }]
                    : []),
                  ...(d.totalStudentAttendance != null && d.totalStudentAttendance > 0
                    ? [{ icon: Users, label: 'Student attendance', value: d.totalStudentAttendance.toLocaleString('en-IN') }]
                    : []),
                  ...(d.remarks ? [{ icon: StickyNote, label: 'Remarks', value: d.remarks, wide: true }] : []),
                ]}
                actions={[
                  ...(d.status !== 'PAID'
                    ? [{
                        label: 'Pay',
                        icon: Plus,
                        tone: 'primary' as const,
                        onClick: () => {
                          setDetailId(null);
                          setQuickPayRecord(d);
                          setQuickPayAmount(d.outstandingBalance > 0 ? d.outstandingBalance.toString() : '');
                          setIsQuickPayModalOpen(true);
                        },
                      }]
                    : []),
                  { label: 'Edit', icon: Edit2, onClick: () => { setDetailId(null); openEditModal(d); } },
                  {
                    label: 'Delete',
                    icon: Trash2,
                    tone: 'danger' as const,
                    onClick: () => {
                      setDetailId(null);
                      setDeletingRecord(d);
                      setIsDeleteModalOpen(true);
                    },
                  },
                ]}
              />
            );
          })()}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">College</th>
                  <th className="px-4 py-3">Billing Date & Month</th>
                  <th className="px-4 py-3">Attendance / Thalis</th>
                  <th className="px-4 py-3 text-right">Billable Amount</th>
                  <th className="px-4 py-3 text-right">Amount Received</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRecords.map(item => {
                  const monthName = item.monthName || MONTH_NAMES[item.month - 1];
                  const hasOptionalStats = (item.totalThalisServed != null && item.totalThalisServed > 0) ||
                                           (item.totalStudentAttendance != null && item.totalStudentAttendance > 0);

                  const displayDate = item.billingDate
                    ? new Date(item.billingDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : `${monthName} ${item.year}`;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* College Name */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                            {item.college.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 text-sm block">
                              {item.college}
                            </span>
                            {item.remarks && (
                              <span className="text-[11px] text-slate-400 line-clamp-1 font-normal">
                                {item.remarks}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Billing Date & Month */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{displayDate}</span>
                        </div>
                        <span className="block text-[10px] text-slate-400 pl-5">
                          {monthName} {item.year}
                        </span>
                      </td>

                      {/* Optional Attendance / Thalis */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {hasOptionalStats ? (
                          <div className="text-[11px] space-y-0.5">
                            {item.totalThalisServed != null && item.totalThalisServed > 0 && (
                              <div className="flex items-center gap-1 text-slate-600">
                                <Utensils className="w-3.5 h-3.5 text-amber-500" />
                                <span>{item.totalThalisServed.toLocaleString('en-IN')} thalis</span>
                                {item.ratePerThali != null && item.ratePerThali > 0 && (
                                  <span className="text-slate-400">@ ₹{item.ratePerThali}</span>
                                )}
                              </div>
                            )}
                            {item.totalStudentAttendance != null && item.totalStudentAttendance > 0 && (
                              <div className="flex items-center gap-1 text-slate-500">
                                <Users className="w-3.5 h-3.5 text-blue-500" />
                                <span>{item.totalStudentAttendance.toLocaleString('en-IN')} student att.</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not specified</span>
                        )}
                      </td>

                      {/* Billable Amount */}
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(item.totalBillableAmount)}
                      </td>

                      {/* Amount Received */}
                      <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {formatINR(item.amountReceived)}
                      </td>

                      {/* Outstanding Balance */}
                      <td className="px-4 py-3.5 text-right font-bold whitespace-nowrap">
                        <span className={item.outstandingBalance > 0 ? 'text-rose-600' : 'text-slate-400'}>
                          {formatINR(item.outstandingBalance)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(item.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Quick Pay Button if not fully paid */}
                          {item.status !== 'PAID' && (
                            <button
                              onClick={() => {
                                setQuickPayRecord(item);
                                setQuickPayAmount(item.outstandingBalance > 0 ? item.outstandingBalance.toString() : '');
                                setIsQuickPayModalOpen(true);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors mr-1"
                              title="Record payment"
                            >
                              + Pay
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Edit Bill"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              setDeletingRecord(item);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete Bill"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ADD / EDIT BILLING MODAL                                                */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92dvh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingRecord ? 'Edit College Monthly Bill' : 'New College Monthly Bill'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingRecord ? 'Update billing receivable and payment status' : 'Create monthly receivable record for mess food services'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-2.5 sm:p-1.5 shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* College Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  College <span className="text-rose-500">*</span>
                </label>
                {!form.isCustomCollege ? (
                  <div className="space-y-2">
                    <select
                      value={form.college}
                      onChange={e => {
                        if (e.target.value === '__NEW__') {
                          setForm(prev => ({ ...prev, isCustomCollege: true, customCollegeName: '' }));
                        } else {
                          setForm(prev => ({ ...prev, college: e.target.value }));
                        }
                      }}
                      className="w-full min-h-10 px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    >
                      <option value="" disabled>Select College</option>
                      {collegesList.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__NEW__" className="text-blue-600 font-bold">
                        + Add New College
                      </option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, isCustomCollege: true, customCollegeName: '' }))}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                    >
                      + Type a new college name instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="e.g. Government Engineering College, Pune"
                      value={form.customCollegeName}
                      onChange={e => setForm(prev => ({ ...prev, customCollegeName: e.target.value }))}
                      className="w-full min-h-10 px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                      autoFocus
                    />
                    {collegesList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, isCustomCollege: false, college: collegesList[0] }))}
                        className="text-xs text-slate-500 hover:text-slate-700 underline"
                      >
                        ← Pick from existing colleges
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Date & Billing Period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Billing / Entry Date <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="date"
                    value={form.billingDate}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) {
                        const parts = val.split('-');
                        if (parts.length === 3) {
                          setForm(prev => ({
                            ...prev,
                            billingDate: val,
                            year: Number(parts[0]),
                            month: Number(parts[1])
                          }));
                        } else {
                          setForm(prev => ({ ...prev, billingDate: val }));
                        }
                      } else {
                        setForm(prev => ({ ...prev, billingDate: val }));
                      }
                    }}
                    className="w-full min-h-10 px-3.5 py-2 text-sm font-semibold text-slate-900 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Date of that month when the entry is filled
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Billing Period (Month & Year)
                  </label>
                  <div className="px-3.5 py-2 rounded-lg bg-blue-50/70 border border-blue-200/80 flex items-center justify-between min-h-[38px]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-[11px]">
                        {form.month}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-blue-900 block leading-tight">
                          {MONTH_NAMES[form.month - 1]} {form.year}
                        </span>
                        <span className="text-[10px] text-blue-600">Month #{form.month}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                      Auto-synced
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Automatically set from selected date
                  </span>
                </div>
              </div>

              {/* Optional Section: Attendance, Thalis & Rate */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-amber-500" />
                    Attendance & Thali Metrics (Optional)
                  </span>
                  <span className="text-[10px] text-slate-400">Not mandatory for billing</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Student Attendance
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 450"
                      value={form.totalStudentAttendance}
                      onChange={e => setForm(prev => ({ ...prev, totalStudentAttendance: e.target.value }))}
                      className="w-full min-h-10 sm:min-h-0 px-3 py-2 sm:py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Total Thalis Served
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 12000"
                      value={form.totalThalisServed}
                      onChange={e => setForm(prev => ({ ...prev, totalThalisServed: e.target.value }))}
                      className="w-full min-h-10 sm:min-h-0 px-3 py-2 sm:py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Rate per Thali (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 65"
                      value={form.ratePerThali}
                      onChange={e => setForm(prev => ({ ...prev, ratePerThali: e.target.value }))}
                      className="w-full min-h-10 sm:min-h-0 px-3 py-2 sm:py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {form.totalThalisServed && form.ratePerThali && (
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500">
                      Thalis × Rate = ₹{((parseInt(form.totalThalisServed, 10) || 0) * (parseFloat(form.ratePerThali) || 0)).toLocaleString('en-IN')}
                    </span>
                    <button
                      type="button"
                      onClick={handleCalculateFromThalis}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 px-2.5 py-2 sm:py-0.5 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Calculator className="w-3 h-3" />
                      Fill as Total Billable
                    </button>
                  </div>
                )}
              </div>

              {/* Financial Inputs: Billable Amount & Amount Received */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Total Billable Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 1000000"
                      value={form.totalBillableAmount}
                      onChange={e => setForm(prev => ({ ...prev, totalBillableAmount: e.target.value }))}
                      className="w-full pl-9 pr-3.5 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Independently entered monthly bill
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Amount Received (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={form.amountReceived}
                      onChange={e => setForm(prev => ({ ...prev, amountReceived: e.target.value }))}
                      className="w-full pl-9 pr-3.5 py-2 text-sm font-semibold text-emerald-700 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Supports partial or full payments
                  </span>
                </div>
              </div>

              {/* Live Status & Outstanding Preview Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Calculated Outstanding Balance
                  </span>
                  <div className="text-lg font-bold text-slate-900">
                    ₹{formOutstanding.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Auto-computed Status
                  </span>
                  {renderStatusBadge(formAutoStatus)}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Invoice #COL-2026-01. Cheque payment cleared."
                  value={form.remarks}
                  onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="flex-1 sm:flex-none min-h-10 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 sm:flex-none justify-center min-h-10 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 active:scale-95 flex items-center gap-1.5"
                >
                  {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingRecord ? 'Update Billing Record' : 'Save Billing Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QUICK PAYMENT MODAL                                                    */}
      {/* ========================================================================= */}
      {isQuickPayModalOpen && quickPayRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Record Payment</h3>
              </div>
              <button
                onClick={() => setIsQuickPayModalOpen(false)}
                className="p-2.5 sm:p-1.5 shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickPaySubmit} className="p-4 sm:p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <div className="text-xs font-semibold text-slate-700">{quickPayRecord.college}</div>
                <div className="text-[11px] text-slate-500">
                  {quickPayRecord.monthName || MONTH_NAMES[quickPayRecord.month - 1]} {quickPayRecord.year} Bill
                </div>
                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-200 mt-2">
                  <span className="text-slate-500">Outstanding:</span>
                  <span className="font-bold text-rose-600">{formatINR(quickPayRecord.outstandingBalance)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Amount to Add (₹)
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="Enter amount"
                    value={quickPayAmount}
                    onChange={e => setQuickPayAmount(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-sm font-bold text-emerald-700 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                    autoFocus
                  />
                </div>
                {quickPayRecord.outstandingBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuickPayAmount(quickPayRecord.outstandingBalance.toString())}
                    className="text-[11px] text-blue-600 hover:underline mt-1 inline-block"
                  >
                    Pay Full Outstanding (₹{quickPayRecord.outstandingBalance.toLocaleString('en-IN')})
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsQuickPayModalOpen(false)}
                  className="flex-1 sm:flex-none min-h-10 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 sm:flex-none justify-center min-h-10 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                >
                  {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DELETE CONFIRMATION MODAL                                              */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Delete Billing Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete the bill for <strong className="text-slate-800">{deletingRecord.college}</strong> for <strong className="text-slate-800">{deletingRecord.monthName || MONTH_NAMES[deletingRecord.month - 1]} {deletingRecord.year}</strong>?
              </p>
              <p className="text-[11px] text-rose-500 font-semibold mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingRecord(null);
                }}
                className="flex-1 sm:flex-none min-h-10 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 sm:flex-none min-h-10 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeBillingPage;
