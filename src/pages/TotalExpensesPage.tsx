// src/pages/TotalExpensesPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  IndianRupee,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Flame,
  Milk,
  Carrot,
  ShoppingBag,
  Wrench,
  Zap,
  Calendar,
  X,
  User,
  Tag,
  CheckCircle2,
  Clock,
  FileText,
  Trash2,
  Edit2,
  Hash
} from 'lucide-react';
import api from '../api';
import type { Expense } from '../types';

interface TotalExpensesPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const CATEGORIES = [
  { id: 'VEGETABLES', label: 'Vegetables', icon: Carrot, color: 'emerald' },
  { id: 'GROCERY', label: 'Grocery', icon: ShoppingBag, color: 'blue' },
  { id: 'MILK_DAIRY', label: 'Milk & Dairy', icon: Milk, color: 'indigo' },
  { id: 'GAS_CYLINDER', label: 'Gas Cylinder', icon: Flame, color: 'amber' },
  { id: 'UTILITIES', label: 'Utilities (Water, Power)', icon: Zap, color: 'purple' },
  { id: 'MAINTENANCE', label: 'Maintenance & Repairs', icon: Wrench, color: 'rose' },
  { id: 'MISCELLANEOUS', label: 'Miscellaneous', icon: Layers, color: 'gray' },
];

// ✅ Predefined units for food items
const PREDEFINED_UNITS = [
  'kg',
  'g',
  'liter',
  'ml',
  'piece',
  'packet',
  'bottle',
  'dozen',
];

export const TotalExpensesPage: React.FC<TotalExpensesPageProps> = ({ searchTerm: globalSearchTerm, showToast }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  // ✅ Modal and Edit state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  // ✅ Filter states
  const [vendorFilter, setVendorFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');

  // ✅ Form with unit dropdown, payment status, and invoice/receipt/check number
  const [form, setForm] = useState({
    category: 'GROCERY',
    itemName: '',
    quantity: 1,
    unit: 'kg',
    rate: 0,
    vendorName: '',
    invoiceNumber: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    paymentStatus: 'PAID' as 'PAID' | 'UNPAID',
    remarks: '',
  });

  // ✅ Custom unit state
  const [customUnit, setCustomUnit] = useState<string>('');
  const [showCustomUnitInput, setShowCustomUnitInput] = useState<boolean>(false);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await api.expense.getAll();
      setExpenses(data || []);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch categorized expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Helper to check if expense is paid
  const isExpensePaid = (e: Expense): boolean => {
    const status = (e.paymentStatus || '').toUpperCase();
    return status === 'PAID';
  };

  // ✅ Handle unit change with custom support
  const handleUnitChange = (unit: string) => {
    if (unit === 'CUSTOM') {
      setShowCustomUnitInput(true);
    } else {
      setShowCustomUnitInput(false);
      setForm({ ...form, unit });
      setCustomUnit('');
    }
  };

  const handleCustomUnitBlur = () => {
    if (customUnit.trim()) {
      setForm({ ...form, unit: customUnit.trim() });
      setShowCustomUnitInput(false);
    }
  };

  const handleCustomUnitKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customUnit.trim()) {
      setForm({ ...form, unit: customUnit.trim() });
      setShowCustomUnitInput(false);
    }
  };

  // ✅ Open Add Modal
  const openAddModal = () => {
    resetForm();
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  // ✅ Open Edit Modal
  const startEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setForm({
      category: exp.category || 'GROCERY',
      itemName: exp.itemName || '',
      quantity: exp.quantity || 1,
      unit: exp.unit || 'kg',
      rate: exp.rate || 0,
      vendorName: exp.vendorName || '',
      invoiceNumber: exp.invoiceNumber || '',
      expenseDate: exp.expenseDate || new Date().toISOString().split('T')[0],
      paymentMethod: exp.paymentMethod || 'CASH',
      paymentStatus: isExpensePaid(exp) ? 'PAID' : 'UNPAID',
      remarks: exp.remarks || '',
    });
    setShowCustomUnitInput(false);
    setCustomUnit('');
    setIsModalOpen(true);
  };

  // ✅ Delete Expense
  const handleDelete = async (exp: Expense) => {
    if (!exp.id) return;
    const amount = exp.totalAmount || ((exp.quantity || 1) * (exp.rate || 0));
    if (confirm(`Are you sure you want to delete expense "${exp.itemName || 'Item'}" (₹${amount.toLocaleString()})?`)) {
      try {
        await api.expense.delete(exp.id);
        showToast('success', `Expense for "${exp.itemName}" deleted`);
        fetchExpenses();
      } catch (err: any) {
        showToast('error', err.message || 'Failed to delete expense');
      }
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemName || form.rate <= 0) {
      showToast('error', 'Please enter a valid item name and rate');
      return;
    }
    if (!form.unit) {
      showToast('error', 'Please select or enter a unit');
      return;
    }

    try {
      const totalAmount = (form.quantity || 1) * form.rate;

      const expenseData: Partial<Expense> = {
        itemName: form.itemName,
        quantity: form.quantity || 1,
        unit: form.unit,
        rate: form.rate,
        totalAmount: totalAmount,
        category: form.category,
        vendorName: form.vendorName || '',
        invoiceNumber: form.invoiceNumber.trim() || '',
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod as any,
        paymentStatus: form.paymentStatus,
        remarks: form.remarks || '',
      };

      if (editingExpense && editingExpense.id) {
        await api.expense.update(editingExpense.id, expenseData);
        showToast('success', `Expense for "${form.itemName}" updated!`);
      } else {
        await api.expense.create(expenseData as Expense);
        showToast('success', `Expense for "${form.itemName}" added!`);
      }

      setIsModalOpen(false);
      resetForm();
      fetchExpenses();
    } catch (err: any) {
      console.error('Expense save error:', err);
      showToast('error', err.message || 'Failed to save expense');
    }
  };

  const resetForm = () => {
    setForm({
      category: 'GROCERY',
      itemName: '',
      quantity: 1,
      unit: 'kg',
      rate: 0,
      vendorName: '',
      invoiceNumber: '',
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      remarks: '',
    });
    setShowCustomUnitInput(false);
    setCustomUnit('');
    setEditingExpense(null);
  };

  // ✅ Clear filters
  const clearFilters = () => {
    setVendorFilter('');
    setDateFrom('');
    setDateTo('');
    setPaymentFilter('ALL');
  };

  const hasActiveFilters = vendorFilter || dateFrom || dateTo || paymentFilter !== 'ALL';

  // ✅ Filtered expenses with vendor, date, category, and payment status filters
  const filtered = useMemo(() => {
    return expenses.filter(e => {
      // Category filter
      const catMatch = selectedCategory === 'ALL' || e.category?.toUpperCase() === selectedCategory.toUpperCase();
      
      // Global search filter (searches Item, Vendor, Category, and Invoice/Receipt No.)
      const searchMatch = !globalSearchTerm ||
        e.itemName?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
        e.vendorName?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
        e.category?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
        e.invoiceNumber?.toLowerCase().includes(globalSearchTerm.toLowerCase());
      
      // Vendor filter
      const vendorMatch = !vendorFilter ||
        e.vendorName?.toLowerCase().includes(vendorFilter.toLowerCase());
      
      // Date range filter
      let dateMatch = true;
      if (dateFrom && e.expenseDate) {
        if (e.expenseDate < dateFrom) dateMatch = false;
      }
      if (dateTo && e.expenseDate) {
        if (e.expenseDate > dateTo) dateMatch = false;
      }

      // Payment status filter (ALL, PAID, UNPAID)
      let paymentMatch = true;
      const isPaid = isExpensePaid(e);
      if (paymentFilter === 'PAID' && !isPaid) paymentMatch = false;
      if (paymentFilter === 'UNPAID' && isPaid) paymentMatch = false;
      
      return catMatch && searchMatch && vendorMatch && dateMatch && paymentMatch;
    });
  }, [expenses, selectedCategory, globalSearchTerm, vendorFilter, dateFrom, dateTo, paymentFilter]);

  // ✅ Summary Information: Calculated dynamically from expense records
  const dynamicSummary = useMemo(() => {
    let totalExpensesAmount = 0;
    let totalPaidAmount = 0;
    let totalUnpaidAmount = 0;
    let totalPaidCount = 0;
    let totalUnpaidCount = 0;

    filtered.forEach(e => {
      const amount = e.totalAmount || ((e.quantity || 1) * (e.rate || 0));
      totalExpensesAmount += amount;
      if (isExpensePaid(e)) {
        totalPaidAmount += amount;
        totalPaidCount++;
      } else {
        totalUnpaidAmount += amount;
        totalUnpaidCount++;
      }
    });

    return {
      totalExpensesAmount,
      totalExpensesCount: filtered.length,
      totalPaidAmount,
      totalPaidCount,
      totalUnpaidAmount,
      totalUnpaidCount,
    };
  }, [filtered]);

  // Calculate Category Breakdown
  const categoryTotals: Record<string, number> = {};
  CATEGORIES.forEach(c => {
    categoryTotals[c.id] = expenses
      .filter(e => e.category?.toUpperCase() === c.id)
      .reduce((sum, e) => sum + (e.totalAmount || (e.quantity || 1) * (e.rate || 0)), 0);
  });

  return (
    <div className="space-y-6">
      {/* Header & Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Total Categorized Mess Supplies & Expenses</h2>
          <p className="text-xs text-slate-500 mt-0.5">Track procurement costs, paid & unpaid statuses, and invoice/receipt numbers by category</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { api.clearCache(); fetchExpenses(); }}
            title="Refresh expenses"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item Expense</span>
          </button>
        </div>
      </div>

      {/* ✅ Dynamic Summary Information KPI Cards (Total Expenses, Total Paid, Total Unpaid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Expenses */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Expenses</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              ₹{dynamicSummary.totalExpensesAmount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {dynamicSummary.totalExpensesCount} expense {dynamicSummary.totalExpensesCount === 1 ? 'record' : 'records'}
            </div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs flex items-center justify-between bg-emerald-50/20">
          <div>
            <div className="text-xs text-emerald-700 font-medium">Total Paid</div>
            <div className="text-2xl font-bold text-emerald-700 mt-0.5">
              ₹{dynamicSummary.totalPaidAmount.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5">
              {dynamicSummary.totalPaidCount} bills settled
            </div>
          </div>
          <div className="p-2.5 bg-emerald-100/70 text-emerald-700 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Unpaid */}
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-xs flex items-center justify-between bg-rose-50/20">
          <div>
            <div className="text-xs text-rose-700 font-medium">Total Unpaid</div>
            <div className="text-2xl font-bold text-rose-700 mt-0.5">
              ₹{dynamicSummary.totalUnpaidAmount.toLocaleString()}
            </div>
            <div className="text-[11px] text-rose-600/80 mt-0.5">
              {dynamicSummary.totalUnpaidCount} bills pending
            </div>
          </div>
          <div className="p-2.5 bg-rose-100/70 text-rose-700 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ✅ Filters: Vendor, Date, and Paid / Unpaid Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Filters</span>
            {hasActiveFilters && (
              <span className="text-xs text-blue-600 font-medium">(Active)</span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Search by Vendor</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor name..."
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Status</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'ALL' | 'PAID' | 'UNPAID')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid Only</option>
              <option value="UNPAID">Unpaid Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Totals Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const total = categoryTotals[cat.id] || 0;
          const isSelected = selectedCategory === cat.id;
          return (
            <div
              key={cat.id}
              onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 line-clamp-1">{cat.label}</span>
                <Icon className="w-4 h-4 text-blue-600 shrink-0 ml-1" />
              </div>
              <div className="text-lg font-bold text-slate-900 mt-2">₹{total.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {expenses.filter(e => e.category?.toUpperCase() === cat.id).length} entries
              </div>
            </div>
          );
        })}
      </div>

      {/* Expense List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">Showing: {filtered.length} entries</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Total: <strong className="text-slate-900">₹{dynamicSummary.totalExpensesAmount.toLocaleString()}</strong>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading categorized expenses...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No expenses found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Qty / Unit</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Invoice / Receipt No.</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map(item => {
                  const paid = isExpensePaid(item);
                  const amount = item.totalAmount || ((item.quantity || 1) * (item.rate || 0));
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-blue-700">
                        <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-[11px]">
                          {item.category || 'GENERAL'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.itemName}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {item.quantity || 1} {item.unit || ''}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        ₹{item.rate || 0}/{item.unit || 'unit'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.vendorName || '-'}</td>
                      
                      {/* ✅ Invoice / Receipt / Cheque No. Display */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.invoiceNumber ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            {item.invoiceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500">{item.expenseDate || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {item.paymentMethod || 'CASH'}
                        </span>
                      </td>
                      {/* ✅ Payment Status Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {paid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Clock className="w-3 h-3 text-rose-600" />
                            Unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 text-right whitespace-nowrap">
                        ₹{amount.toLocaleString()}
                      </td>
                      {/* ✅ Actions (Edit & Delete) */}
                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-800 rounded transition-colors cursor-pointer"
                          title="Delete Expense"
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
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingExpense ? 'Edit Categorized Mess Expense' : 'Add Categorized Mess Expense'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              {/* Category & Item Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    required
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tomatoes, LPG Cylinder, Milk"
                    value={form.itemName}
                    onChange={e => setForm({ ...form, itemName: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quantity, Unit, Rate */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.quantity === 0 ? '' : form.quantity}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setForm({ ...form, quantity: val });
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        e.target.value = '';
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') {
                        setForm({ ...form, quantity: 0 });
                      }
                    }}
                    placeholder="0"
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit *</label>
                  {!showCustomUnitInput ? (
                    <select
                      value={form.unit || 'kg'}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      required
                    >
                      {PREDEFINED_UNITS.map(unit => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                      <option value="CUSTOM">✏️ Type Custom...</option>
                    </select>
                  ) : (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Enter unit..."
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        onBlur={handleCustomUnitBlur}
                        onKeyPress={handleCustomUnitKeyPress}
                        className="flex-1 p-2 border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-blue-50 text-xs"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customUnit.trim()) {
                            setForm({ ...form, unit: customUnit.trim() });
                            setShowCustomUnitInput(false);
                          }
                        }}
                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rate (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={form.rate === 0 ? '' : form.rate}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setForm({ ...form, rate: val });
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        e.target.value = '';
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') {
                        setForm({ ...form, rate: 0 });
                      }
                    }}
                    placeholder="0"
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Show calculated total */}
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <span className="font-semibold text-blue-900 text-xs">Total Calculated Amount:</span>
                <span className="text-sm font-bold text-blue-900">
                  ₹{((form.quantity || 1) * (form.rate || 0)).toLocaleString()}
                </span>
              </div>

              {/* ✅ Payment Status Selection (Paid vs Unpaid) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Status *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paymentStatus: 'PAID' })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                      form.paymentStatus === 'PAID'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Paid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paymentStatus: 'UNPAID' })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                      form.paymentStatus === 'UNPAID'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Unpaid</span>
                  </button>
                </div>
              </div>

              {/* ✅ Invoice / Receipt / Cheque No. Input */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Invoice / Receipt / Cheque No.</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. INV-2024-88, REC-102, CHQ-4521"
                    value={form.invoiceNumber}
                    onChange={e => setForm({ ...form, invoiceNumber: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Vendor & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vendor / Store Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Local Mandi, Amul Dairy"
                    value={form.vendorName}
                    onChange={e => setForm({ ...form, vendorName: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.expenseDate}
                    onChange={e => setForm({ ...form, expenseDate: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI / GooglePay / PhonePe</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER / NEFT</option>
                  <option value="CHEQUE">CHEQUE</option>
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="Any additional notes..."
                  value={form.remarks}
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TotalExpensesPage;