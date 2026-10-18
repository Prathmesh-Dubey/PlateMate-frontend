// src/pages/ExpensesPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Filter,
  Trash2,
  Edit2,
  IndianRupee,
  Calendar,
  Search,
  Tag,
  CreditCard,
  X,
  ChevronDown,
} from 'lucide-react';
import api from '../api';
import type { Expense, ExpenseCategory, PaymentMethod } from '../types';

interface ExpensesPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const expenseCategories: ExpenseCategory[] = [
  'VEGETABLES',
  'GROCERY',
  'MILK_DAIRY',
  'GAS_CYLINDER',
  'UTILITIES',
  'MAINTENANCE',
  'MISCELLANEOUS',
];

// ✅ Only 8 most used units for food
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

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ searchTerm: globalSearchTerm, showToast }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [localSearchTerm, setLocalSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    expenseDate: new Date().toISOString().split('T')[0],
    category: 'VEGETABLES',
    itemName: '',
    quantity: 1,
    unit: 'kg',
    rate: 0,
    vendorName: '',
    invoiceNumber: '',
    paymentMethod: 'CASH',
    remarks: '',
  });

  // ✅ Custom unit state
  const [customUnit, setCustomUnit] = useState<string>('');
  const [showCustomUnitInput, setShowCustomUnitInput] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      // One request; the summary boxes are calculated from this list (see filteredSummary)
      const list = await api.expense.getAll().catch(() => []);
      setExpenses(Array.isArray(list) ? list : []);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load expense records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ✅ Handle unit selection
  const handleUnitChange = (unit: string) => {
    if (unit === 'CUSTOM') {
      setShowCustomUnitInput(true);
    } else {
      setShowCustomUnitInput(false);
      setFormData({ ...formData, unit });
      setCustomUnit('');
    }
  };

  const handleCustomUnitBlur = () => {
    if (customUnit.trim()) {
      setFormData({ ...formData, unit: customUnit.trim() });
      setShowCustomUnitInput(false);
    }
  };

  const handleCustomUnitKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customUnit.trim()) {
      setFormData({ ...formData, unit: customUnit.trim() });
      setShowCustomUnitInput(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName || !formData.rate) {
      showToast('error', 'Item name and rate are required');
      return;
    }
    if (!formData.unit) {
      showToast('error', 'Unit is required');
      return;
    }

    try {
      if (editingExpense && editingExpense.id) {
        await api.expense.update(editingExpense.id, formData);
        showToast('success', 'Expense updated successfully');
      } else {
        await api.expense.create(formData as Expense);
        showToast('success', 'New expense logged successfully');
      }
      setIsModalOpen(false);
      setEditingExpense(null);
      resetForm();
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save expense');
    }
  };

  const handleDelete = async (exp: Expense) => {
    if (!exp.id) return;
    if (confirm(`Delete expense "${exp.itemName || 'Item'}" (₹${(exp.quantity || 1) * (exp.rate || 0)})?`)) {
      try {
        await api.expense.delete(exp.id);
        showToast('success', 'Expense deleted');
        loadData();
      } catch (err: any) {
        showToast('error', err.message || 'Delete failed');
      }
    }
  };

  const startEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setFormData({ ...exp });
    setIsModalOpen(true);
    setShowCustomUnitInput(false);
    setCustomUnit('');
  };

  const resetForm = () => {
    setFormData({
      expenseDate: new Date().toISOString().split('T')[0],
      category: 'VEGETABLES',
      itemName: '',
      quantity: 1,
      unit: 'kg',
      rate: 0,
      vendorName: '',
      invoiceNumber: '',
      paymentMethod: 'CASH',
      remarks: '',
    });
    setShowCustomUnitInput(false);
    setCustomUnit('');
  };

  const safeExpenses = Array.isArray(expenses) ? expenses : [];

  const combinedSearchTerm = globalSearchTerm || localSearchTerm;

  const filtered = useMemo(() => {
    return safeExpenses.filter(e => {
      if (!e) return false;
      const cat = e.category || 'MISCELLANEOUS';
      if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false;
      if (combinedSearchTerm) {
        const q = combinedSearchTerm.toLowerCase();
        const match = (
          (e.itemName || '').toLowerCase().includes(q) ||
          (e.vendorName && e.vendorName.toLowerCase().includes(q)) ||
          (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(q))
        );
        if (!match) return false;
      }
      if (dateFrom && e.expenseDate && e.expenseDate < dateFrom) return false;
      if (dateTo && e.expenseDate && e.expenseDate > dateTo) return false;
      return true;
    });
  }, [safeExpenses, categoryFilter, combinedSearchTerm, dateFrom, dateTo]);

  const filteredSummary = useMemo(() => {
    const total = filtered.reduce((sum, e) => sum + ((e.quantity || 1) * (e.rate || 0)), 0);
    const count = filtered.length;
    const categoryWise: Record<string, number> = {};
    filtered.forEach(e => {
      const cat = e.category || 'MISCELLANEOUS';
      categoryWise[cat] = (categoryWise[cat] || 0) + ((e.quantity || 1) * (e.rate || 0));
    });
    return { total, count, categoryWise };
  }, [filtered]);

  const clearFilters = () => {
    setCategoryFilter('ALL');
    setLocalSearchTerm('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = categoryFilter !== 'ALL' || localSearchTerm || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Day-to-day Expenses</h2>
          <p className="text-xs text-slate-500 mt-0.5">Quick daily & weekly expense entry</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingExpense(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Log Daily Expense</span>
        </button>
      </div>

      {/* ✅ Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search expenses by item, vendor, or invoice number..."
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
      </div>

      {/* ✅ Always Visible Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
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
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="ALL">All Categories</option>
              {expenseCategories.map(cat => (
                <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Mess Expenditure</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">₹{filteredSummary.total.toLocaleString()}</div>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Purchase Invoices</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{filteredSummary.count} bills</div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Average Spend per Bill</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              ₹{filteredSummary.count ? Math.round(filteredSummary.total / filteredSummary.count).toLocaleString() : 0}
            </div>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Tag className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Category-wise breakdown */}
      {Object.keys(filteredSummary.categoryWise).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category-wise Breakdown</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(filteredSummary.categoryWise).map(([category, amount]) => (
              <div key={category} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs font-medium text-slate-600">{category.replace('_', ' ')}</span>
                <span className="text-xs font-bold text-slate-900">₹{amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Item & Category</th>
                <th className="py-3 px-4">Qty & Rate</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Vendor & Invoice</th>
                <th className="py-3 px-4">Payment Mode</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {safeExpenses.length === 0 ? (
                      <div className="space-y-2">
                        <Receipt className="w-10 h-10 mx-auto text-slate-300" />
                        <p className="text-sm font-semibold">No expenses recorded yet.</p>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold">No expenses match your filters.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(exp => (
                  <tr key={exp.id || Math.random()} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center font-medium text-slate-800">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {exp.expenseDate || 'N/A'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{exp.itemName || 'Expense Item'}</div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {(exp.category || 'MISCELLANEOUS').replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {exp.quantity || 1} {exp.unit || 'units'} @ ₹{exp.rate || 0}/{exp.unit || 'unit'}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      ₹{((exp.quantity || 1) * (exp.rate || 0)).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{exp.vendorName || 'Local Market'}</div>
                      <div className="text-[11px] text-slate-400">{exp.invoiceNumber || 'No invoice #'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        <CreditCard className="w-3 h-3 mr-1 text-slate-400" />
                        {exp.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => startEdit(exp)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(exp)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-800 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {filtered.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Showing {filtered.length} of {safeExpenses.length} expenses
            </span>
            <span className="font-semibold text-slate-700">
              Total: ₹{filteredSummary.total.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingExpense ? 'Edit Mess Expense' : 'Log Mess Expense'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate || ''}
                    onChange={e => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category *</label>
                  <select
                    value={formData.category || 'VEGETABLES'}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Potatoes, Tomatoes, Basmati Rice, Amul Milk"
                  value={formData.itemName || ''}
                  onChange={e => setFormData({ ...formData, itemName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.quantity === 0 ? '' : formData.quantity}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setFormData({ ...formData, quantity: val });
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        e.target.value = '';
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') {
                        setFormData({ ...formData, quantity: 0 });
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit *</label>
                  {!showCustomUnitInput ? (
                    <select
                      value={formData.unit || 'kg'}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      required
                    >
                      {PREDEFINED_UNITS.map(unit => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                      <option value="CUSTOM">✏️ Type Custom Unit...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter unit..."
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        onBlur={handleCustomUnitBlur}
                        onKeyPress={handleCustomUnitKeyPress}
                        className="flex-1 px-3 py-2 border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-blue-50"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customUnit.trim()) {
                            setFormData({ ...formData, unit: customUnit.trim() });
                            setShowCustomUnitInput(false);
                          }
                        }}
                        className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomUnitInput(false);
                          setCustomUnit('');
                        }}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {formData.unit && !showCustomUnitInput && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Selected:</span>
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {formData.unit}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Rate (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formData.rate === 0 ? '' : formData.rate}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setFormData({ ...formData, rate: val });
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        e.target.value = '';
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') {
                        setFormData({ ...formData, rate: 0 });
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Calculation banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <span className="font-semibold text-blue-900">Total Calculated Cost:</span>
                <span className="text-base font-bold text-blue-900">
                  ₹{((formData.quantity || 1) * (formData.rate || 0)).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vendor / Shop Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sabzi Mandi Vendor, Kirana Store"
                    value={formData.vendorName || ''}
                    onChange={e => setFormData({ ...formData, vendorName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Invoice / Receipt No.</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2024-88"
                    value={formData.invoiceNumber || ''}
                    onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod || 'CASH'}
                  onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI / GooglePay / PhonePe</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER / NEFT</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                >
                  {editingExpense ? 'Save Changes' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};