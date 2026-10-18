// src/pages/StockPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  AlertTriangle,
  History,
  TrendingDown,
  TrendingUp,
  X,
  Edit2,
  Trash2,
  IndianRupee,
  Search,
  Calendar,
  CalendarClock,
  Filter,
  ChevronDown,
  Bell,
  CheckCircle
} from 'lucide-react';
import api from '../api';
import type { StockItem, StockCategory, StockTransaction } from '../types';

interface StockPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

// Extended categories
const stockCategories: StockCategory[] = [
  'PULSES',
  'GRAINS',
  'OILS',
  'SPICES',
  'DAIRY',
  'VEGETABLES',
  'FRUITS',
  'MEAT',
  'SEAFOOD',
  'BEVERAGES',
  'SNACKS',
  'FROZEN',
  'BAKERY',
  'OTHERS',
];

// Predefined units
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

// Items expiring within this many days are flagged as "expiring soon"
const EXPIRY_WARN_DAYS = 7;

type ExpiryState = 'NONE' | 'OK' | 'SOON' | 'EXPIRED';

interface ExpiryInfo {
  state: ExpiryState;
  days: number | null; // days until expiry (negative once expired)
}

const getExpiryInfo = (expiryDate?: string): ExpiryInfo => {
  if (!expiryDate) return { state: 'NONE', days: null };
  const [y, m, d] = expiryDate.split('-').map(Number);
  if (!y || !m || !d) return { state: 'NONE', days: null };
  const expiry = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { state: 'EXPIRED', days };
  if (days <= EXPIRY_WARN_DAYS) return { state: 'SOON', days };
  return { state: 'OK', days };
};

const formatExpiryDate = (iso?: string): string => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const describeExpiry = ({ state, days }: ExpiryInfo): string => {
  if (state === 'NONE' || days === null) return '';
  if (state === 'EXPIRED') return days === -1 ? 'Expired yesterday' : `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `In ${days} days`;
};

const ExpiryBadge: React.FC<{ info: ExpiryInfo }> = ({ info }) => {
  if (info.state === 'EXPIRED') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
        <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Expired
      </span>
    );
  }
  if (info.state === 'SOON') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
        <CalendarClock className="w-3.5 h-3.5 mr-1" /> Expiring Soon
      </span>
    );
  }
  return null;
};

const emptyItemForm = (): Partial<StockItem> => ({
  itemName: '',
  category: 'GRAINS',
  currentStock: 0,
  unit: 'kg',
  minimumStockLevel: 10,
  unitPrice: 50,
  expiryDate: '',
});

export const StockPage: React.FC<StockPageProps> = ({ searchTerm: globalSearchTerm, showToast }) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'TRANSACTIONS' | 'LOW_STOCK' | 'EXPIRY'>('ITEMS');
  const [loading, setLoading] = useState(true);
  const [localSearchTerm, setLocalSearchTerm] = useState<string>('');

  // Transaction Filters
  const [txSearchTerm, setTxSearchTerm] = useState<string>('');
  const [txDateFrom, setTxDateFrom] = useState<string>('');
  const [txDateTo, setTxDateTo] = useState<string>('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [itemForm, setItemForm] = useState<Partial<StockItem>>(emptyItemForm());

  const [customUnit, setCustomUnit] = useState<string>('');
  const [showCustomUnitInput, setShowCustomUnitInput] = useState<boolean>(false);

  // Adjust Stock Modal
  const [adjustModalItem, setAdjustModalItem] = useState<StockItem | null>(null);
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemList, txList] = await Promise.all([
        api.stock.item.getAll().catch(() => []),
        api.stock.transaction.getAll().catch(() => []),
      ]);
      setItems(Array.isArray(itemList) ? itemList : []);
      setTransactions(Array.isArray(txList) ? txList : []);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (txTypeFilter !== 'ALL' && tx.transactionType !== txTypeFilter) {
        return false;
      }
      if (txSearchTerm) {
        const searchLower = txSearchTerm.toLowerCase();
        const itemName = tx.stockItemName || (tx as any).itemName || '';
        if (!itemName.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      if (txDateFrom && tx.transactionDate) {
        const txDate = new Date(tx.transactionDate);
        const fromDate = new Date(txDateFrom);
        if (txDate < fromDate) return false;
      }
      if (txDateTo && tx.transactionDate) {
        const txDate = new Date(tx.transactionDate);
        const toDate = new Date(txDateTo);
        toDate.setHours(23, 59, 59);
        if (txDate > toDate) return false;
      }
      return true;
    });
  }, [transactions, txSearchTerm, txDateFrom, txDateTo, txTypeFilter]);

  const clearTxFilters = () => {
    setTxSearchTerm('');
    setTxDateFrom('');
    setTxDateTo('');
    setTxTypeFilter('ALL');
  };

  const handleUnitChange = (unit: string) => {
    if (unit === 'CUSTOM') {
      setShowCustomUnitInput(true);
    } else {
      setShowCustomUnitInput(false);
      setItemForm({ ...itemForm, unit });
      setCustomUnit('');
    }
  };

  const handleCustomUnitBlur = () => {
    if (customUnit.trim()) {
      setItemForm({ ...itemForm, unit: customUnit.trim() });
      setShowCustomUnitInput(false);
    }
  };

  const handleCustomUnitKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customUnit.trim()) {
      setItemForm({ ...itemForm, unit: customUnit.trim() });
      setShowCustomUnitInput(false);
    }
  };

  const resetItemForm = () => {
    setItemForm(emptyItemForm());
    setShowCustomUnitInput(false);
    setCustomUnit('');
  };

  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setEditingItem(null);
    setShowCustomUnitInput(false);
    setCustomUnit('');
  };

  const openEditModal = (item: StockItem) => {
    setEditingItem(item);
    setItemForm({ ...item, expiryDate: item.expiryDate || '' });
    setIsItemModalOpen(true);
  };

  const openAdjustModal = (item: StockItem, type: 'ADD' | 'DEDUCT') => {
    setAdjustModalItem(item);
    setAdjustType(type);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.itemName) {
      showToast('error', 'Item name is required');
      return;
    }
    if (!itemForm.unit) {
      showToast('error', 'Unit is required');
      return;
    }

    // An empty expiry date is omitted, which clears it on the server.
    const payload = { ...itemForm, expiryDate: itemForm.expiryDate || undefined } as StockItem;

    try {
      if (editingItem && editingItem.id) {
        await api.stock.item.update(editingItem.id, payload);
        showToast('success', 'Stock item updated');
      } else {
        await api.stock.item.create(payload);
        showToast('success', 'New stock item added');
      }

      closeItemModal();
      resetItemForm();
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save stock item');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalItem || !adjustModalItem.id || adjustQty <= 0) return;

    try {
      if (adjustType === 'ADD') {
        await api.stock.item.addStock(adjustModalItem.id, adjustQty, 'PROCUREMENT', adjustNotes);
        showToast('success', `Added ${adjustQty} ${adjustModalItem.unit} to ${adjustModalItem.itemName}`);
      } else {
        await api.stock.item.deductStock(adjustModalItem.id, adjustQty, 'KITCHEN_USAGE', adjustNotes);
        showToast('info', `Deducted ${adjustQty} ${adjustModalItem.unit} from ${adjustModalItem.itemName}`);
      }
      setAdjustModalItem(null);
      setAdjustQty(10);
      setAdjustNotes('');
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to adjust stock level');
    }
  };

  const handleDeleteItem = async (item: StockItem) => {
    if (!item.id) return;
    if (window.confirm(`Are you sure you want to delete "${item.itemName}"?`)) {
      try {
        await api.stock.item.delete(item.id);
        showToast('info', `Deleted stock item ${item.itemName}`);
        loadData();
      } catch (err: any) {
        showToast('error', err.message || 'Failed to delete stock item');
      }
    }
  };

  // Combined search term (global + local)
  const combinedSearchTerm = globalSearchTerm || localSearchTerm;

  const safeItems = Array.isArray(items) ? items : [];

  const matchesSearch = (item: StockItem) => {
    if (!combinedSearchTerm) return true;
    const q = combinedSearchTerm.toLowerCase();
    return (
      (item.itemName || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  };

  // Filter items
  const filteredItems = safeItems.filter(item => {
    if (!item) return false;
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
    return matchesSearch(item);
  });

  // Low stock items
  const lowStockItems = safeItems.filter(i => i && i.currentStock <= i.minimumStockLevel);
  const totalValue = safeItems.reduce((acc, i) => acc + ((i?.currentStock || 0) * (i?.unitPrice || 0)), 0);
  const lowStockCount = lowStockItems.length;

  // Expiry alerts: expired + expiring soon, soonest first
  const expiryAlertItems = safeItems
    .filter(Boolean)
    .map(item => ({ item, info: getExpiryInfo(item.expiryDate) }))
    .filter(({ info }) => info.state === 'EXPIRED' || info.state === 'SOON')
    .sort((a, b) => (a.info.days ?? 0) - (b.info.days ?? 0));
  const expiredCount = expiryAlertItems.filter(e => e.info.state === 'EXPIRED').length;
  const expiringSoonCount = expiryAlertItems.length - expiredCount;
  const expiryAlertCount = expiryAlertItems.length;

  const filteredExpiryAlerts = expiryAlertItems.filter(({ item }) => matchesSearch(item));
  const filteredLowStock = lowStockItems.filter(matchesSearch);

  const inputClass =
    'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:ring-2 focus:ring-amber-500 focus:outline-none';
  const labelClass = 'block text-slate-700 text-sm font-semibold mb-1.5';
  const thClass = 'py-3.5 px-4 text-sm';
  const tdClass = 'py-4 px-4';

  const renderStatusCell = (item: StockItem) => {
    const isLow = item.currentStock <= item.minimumStockLevel;
    const expiry = getExpiryInfo(item.expiryDate);
    const hasExpiryIssue = expiry.state === 'EXPIRED' || expiry.state === 'SOON';
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {isLow && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Low Stock
          </span>
        )}
        <ExpiryBadge info={expiry} />
        {!isLow && !hasExpiryIssue && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700">
            Healthy
          </span>
        )}
      </div>
    );
  };

  const renderExpiryCell = (item: StockItem) => {
    const info = getExpiryInfo(item.expiryDate);
    if (info.state === 'NONE') return <span className="text-slate-400">-</span>;
    const color =
      info.state === 'EXPIRED' ? 'text-rose-600' : info.state === 'SOON' ? 'text-orange-600' : 'text-slate-800';
    return (
      <div>
        <div className={`font-semibold ${color}`}>{formatExpiryDate(item.expiryDate)}</div>
        <div className={`text-sm ${info.state === 'OK' ? 'text-slate-500' : color}`}>{describeExpiry(info)}</div>
      </div>
    );
  };

  const renderActionButtons = (item: StockItem, labels: { add: string; use: string }) => (
    <td className={`${tdClass} text-right whitespace-nowrap`}>
      <div className="inline-flex items-center gap-2">
        <button
          onClick={() => openAdjustModal(item, 'ADD')}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-colors"
        >
          {labels.add}
        </button>
        <button
          onClick={() => openAdjustModal(item, 'DEDUCT')}
          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-sm transition-colors"
        >
          {labels.use}
        </button>
        <button
          onClick={() => openEditModal(item)}
          className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg"
          title="Edit item"
        >
          <Edit2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => handleDeleteItem(item)}
          className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg"
          title="Delete item"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </td>
  );

  const tabButton = (
    tab: typeof activeTab,
    activeClass: string,
    content: React.ReactNode
  ) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? activeClass : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
    >
      {content}
    </button>
  );

  const countBadge = (count: number, color: string) =>
    count > 0 ? (
      <span className={`${color} text-white text-xs px-2 py-0.5 rounded-full`}>{count}</span>
    ) : null;

  return (
    <div className="space-y-6 text-base">
      {/* Top Header & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500 font-medium">Total Inventory Items</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{safeItems.length} Items</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500 font-medium">Est. Total Pantry Value</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">₹{totalValue.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        <button
          onClick={() => setActiveTab('LOW_STOCK')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-left hover:border-rose-300 transition-colors"
        >
          <div>
            <div className="text-sm text-slate-500 font-medium">Low Stock Alerts</div>
            <div className={`text-3xl font-bold mt-1 ${lowStockCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {lowStockCount} Alert{lowStockCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab('EXPIRY')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-left hover:border-orange-300 transition-colors"
        >
          <div>
            <div className="text-sm text-slate-500 font-medium">Expiry Alerts</div>
            <div className={`text-3xl font-bold mt-1 ${expiryAlertCount > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
              {expiryAlertCount} Alert{expiryAlertCount === 1 ? '' : 's'}
            </div>
            {expiryAlertCount > 0 && (
              <div className="text-sm text-slate-500 mt-0.5">
                {expiredCount} expired · {expiringSoonCount} expiring soon
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${expiryAlertCount > 0 ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>
            <CalendarClock className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* Expiry banner */}
      {expiryAlertCount > 0 && activeTab !== 'EXPIRY' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-6 h-6 shrink-0" />
            <span className="text-base font-semibold">
              {expiredCount > 0 && `${expiredCount} item${expiredCount === 1 ? ' has' : 's have'} expired`}
              {expiredCount > 0 && expiringSoonCount > 0 && ' and '}
              {expiringSoonCount > 0 &&
                `${expiringSoonCount} item${expiringSoonCount === 1 ? ' expires' : 's expire'} within ${EXPIRY_WARN_DAYS} days`}
              .
            </span>
          </div>
          <button
            onClick={() => setActiveTab('EXPIRY')}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold"
          >
            View Expiry Alerts
          </button>
        </div>
      )}

      {/* Tabs & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center flex-wrap gap-2">
          {tabButton('ITEMS', 'bg-slate-900 text-white shadow-xs', <>Pantry Inventory ({safeItems.length})</>)}
          {tabButton(
            'LOW_STOCK',
            'bg-rose-600 text-white shadow-xs',
            <>
              <Bell className="w-4 h-4" />
              <span>Low Stock Alerts</span>
              {countBadge(lowStockCount, 'bg-rose-500')}
            </>
          )}
          {tabButton(
            'EXPIRY',
            'bg-orange-600 text-white shadow-xs',
            <>
              <CalendarClock className="w-4 h-4" />
              <span>Expiry Alerts</span>
              {countBadge(expiryAlertCount, 'bg-orange-500')}
            </>
          )}
          {tabButton(
            'TRANSACTIONS',
            'bg-slate-900 text-white shadow-xs',
            <>
              <History className="w-4 h-4" />
              <span>Audit Logs ({filteredTransactions.length})</span>
            </>
          )}
        </div>

        <button
          onClick={() => {
            resetItemForm();
            setEditingItem(null);
            setIsItemModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded-lg text-sm shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Stock Item</span>
        </button>
      </div>

      {/* Search Bar for Items */}
      {activeTab !== 'TRANSACTIONS' && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search stock items by name or category..."
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-base focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
          />
        </div>
      )}

      {activeTab === 'LOW_STOCK' ? (
        /* Low Stock Alerts Tab */
        filteredLowStock.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">All Stock Levels Healthy!</h3>
            <p className="text-base text-slate-500 mt-1">No items are currently below their minimum stock threshold.</p>
          </div>
        ) : (
          <div className="bg-white border border-rose-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-base">
                <thead>
                  <tr className="bg-rose-50 border-b border-rose-200 text-rose-700 font-semibold uppercase tracking-wider">
                    <th className={thClass}>Item Name</th>
                    <th className={thClass}>Category</th>
                    <th className={thClass}>Available</th>
                    <th className={thClass}>Min. Threshold</th>
                    <th className={thClass}>Expiry</th>
                    <th className={`${thClass} text-right`}>Stock Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLowStock.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className={`${tdClass} font-semibold text-slate-900 text-lg`}>{item.itemName}</td>
                      <td className={tdClass}>
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                      </td>
                      <td className={`${tdClass} font-bold text-rose-600 text-lg`}>
                        {item.currentStock} {item.unit}
                      </td>
                      <td className={`${tdClass} text-slate-600`}>
                        {item.minimumStockLevel} {item.unit}
                      </td>
                      <td className={tdClass}>{renderExpiryCell(item)}</td>
                      {renderActionButtons(item, { add: '+ Restock Now', use: '- Use' })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'EXPIRY' ? (
        /* Expiry Alerts Tab */
        filteredExpiryAlerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">Nothing Expiring Soon</h3>
            <p className="text-base text-slate-500 mt-1">
              No items have expired or will expire within {EXPIRY_WARN_DAYS} days. Set an expiry date on an item to track it here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-orange-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-base">
                <thead>
                  <tr className="bg-orange-50 border-b border-orange-200 text-orange-800 font-semibold uppercase tracking-wider">
                    <th className={thClass}>Item Name</th>
                    <th className={thClass}>Category</th>
                    <th className={thClass}>Current Stock</th>
                    <th className={thClass}>Expiry Date</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}>Stock Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredExpiryAlerts.map(({ item, info }) => (
                    <tr
                      key={item.id}
                      className={`transition-colors ${info.state === 'EXPIRED' ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-orange-50/50'}`}
                    >
                      <td className={`${tdClass} font-semibold text-slate-900 text-lg`}>{item.itemName}</td>
                      <td className={tdClass}>
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                      </td>
                      <td className={`${tdClass} font-bold text-slate-900 text-lg`}>
                        {item.currentStock} {item.unit}
                      </td>
                      <td className={tdClass}>{renderExpiryCell(item)}</td>
                      <td className={tdClass}>
                        <ExpiryBadge info={info} />
                      </td>
                      {renderActionButtons(item, { add: '+ Add', use: '- Use' })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'TRANSACTIONS' ? (
        /* Transactions Audit Tab with Filters */
        <div className="space-y-4">
          {/* Transaction Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-base font-semibold text-slate-700 hover:text-slate-900"
              >
                <Filter className="w-5 h-5" />
                Filters
                <ChevronDown className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              {(txSearchTerm || txDateFrom || txDateTo || txTypeFilter !== 'ALL') && (
                <button
                  onClick={clearTxFilters}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear All Filters
                </button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className={labelClass}>Search Item</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by item name..."
                      value={txSearchTerm}
                      onChange={(e) => setTxSearchTerm(e.target.value)}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>From Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={txDateFrom}
                      onChange={(e) => setTxDateFrom(e.target.value)}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>To Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={txDateTo}
                      onChange={(e) => setTxDateTo(e.target.value)}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Transaction Type</label>
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="ALL">All Types</option>
                    <option value="PURCHASE">Purchase</option>
                    <option value="USAGE">Usage</option>
                    <option value="RETURN">Return</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Transactions Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-base">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Item Name</th>
                    <th className={thClass}>Action</th>
                    <th className={thClass}>Quantity</th>
                    <th className={thClass}>Cost (₹)</th>
                    <th className={thClass}>Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        {transactions.length === 0 ? (
                          <div className="space-y-2">
                            <History className="w-12 h-12 mx-auto text-slate-300" />
                            <p className="text-base font-semibold">No transactions recorded yet.</p>
                          </div>
                        ) : (
                          <p className="text-base font-semibold">No transactions match your filters.</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx, index) => {
                      let typeColor = 'bg-gray-50 text-gray-700';
                      let typeIcon = null;

                      if (tx.transactionType === 'PURCHASE') {
                        typeColor = 'bg-emerald-50 text-emerald-700';
                        typeIcon = <TrendingUp className="w-3.5 h-3.5 mr-1" />;
                      } else if (tx.transactionType === 'USAGE' || (tx.transactionType as string) === 'CONSUME') {
                        typeColor = 'bg-amber-50 text-amber-700';
                        typeIcon = <TrendingDown className="w-3.5 h-3.5 mr-1" />;
                      } else if (tx.transactionType === 'RETURN') {
                        typeColor = 'bg-blue-50 text-blue-700';
                        typeIcon = <TrendingUp className="w-3.5 h-3.5 mr-1" />;
                      } else {
                        typeColor = 'bg-purple-50 text-purple-700';
                      }

                      return (
                        <tr key={tx.id || index} className="hover:bg-slate-50/70 transition-colors">
                          <td className={`${tdClass} font-mono text-sm text-slate-500`}>
                            {tx.transactionDate || '-'}
                          </td>
                          <td className={`${tdClass} font-semibold text-slate-900 text-lg`}>
                            {tx.stockItemName || (tx as any).itemName || 'Unknown Item'}
                          </td>
                          <td className={tdClass}>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${typeColor}`}>
                              {typeIcon} {tx.transactionType || 'UNKNOWN'}
                            </span>
                          </td>
                          <td className={`${tdClass} font-bold text-slate-900`}>
                            {tx.quantity || 0} {tx.unit || ''}
                          </td>
                          <td className={`${tdClass} text-slate-800 font-medium`}>
                            ₹{(tx.totalAmount || 0).toLocaleString()}
                          </td>
                          <td className={`${tdClass} text-slate-500 text-sm truncate max-w-[260px]`}>
                            {tx.remarks || tx.referenceNumber || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length > 0 && (
              <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Showing {filteredTransactions.length} of {transactions.length} transactions
                </span>
                <span className="font-semibold text-slate-700 text-base">
                  Total Value: ₹{filteredTransactions.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ITEMS TAB - list view only */
        <>
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-all ${categoryFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
            >
              All Categories
            </button>
            {stockCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-all ${categoryFilter === cat
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-base">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className={thClass}>Item Name</th>
                    <th className={thClass}>Category</th>
                    <th className={thClass}>Current Stock</th>
                    <th className={thClass}>Min. Threshold</th>
                    <th className={thClass}>Unit Price</th>
                    <th className={thClass}>Est. Value (₹)</th>
                    <th className={thClass}>Expiry Date</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}>Stock Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading && safeItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 text-base">
                        Loading inventory...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Boxes className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                        <p className="text-base font-semibold">No stock items match your filter criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => {
                      const isLow = item.currentStock <= item.minimumStockLevel;
                      const expiry = getExpiryInfo(item.expiryDate);
                      const rowTint =
                        expiry.state === 'EXPIRED'
                          ? 'bg-rose-50/60 hover:bg-rose-50'
                          : expiry.state === 'SOON'
                            ? 'bg-orange-50/50 hover:bg-orange-50'
                            : 'hover:bg-slate-50/70';

                      return (
                        <tr key={item.id || item.itemName} className={`transition-colors ${rowTint}`}>
                          <td className={`${tdClass} font-semibold text-slate-900 text-lg`}>
                            {item.itemName}
                          </td>
                          <td className={tdClass}>
                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600">
                              {item.category}
                            </span>
                          </td>
                          <td className={`${tdClass} font-bold text-lg ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                            {item.currentStock} {item.unit}
                          </td>
                          <td className={`${tdClass} text-slate-600`}>
                            {item.minimumStockLevel} {item.unit}
                          </td>
                          <td className={`${tdClass} text-slate-700`}>
                            ₹{item.unitPrice || 0}/{item.unit || 'kg'}
                          </td>
                          <td className={`${tdClass} font-semibold text-slate-800`}>
                            ₹{((item.currentStock || 0) * (item.unitPrice || 0)).toLocaleString()}
                          </td>
                          <td className={tdClass}>{renderExpiryCell(item)}</td>
                          <td className={tdClass}>{renderStatusCell(item)}</td>
                          {renderActionButtons(item, { add: '+ Add', use: '- Use' })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Adjust Stock Modal */}
      {adjustModalItem && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-lg">
                {adjustType === 'ADD' ? 'Add Stock (Procurement)' : 'Deduct Stock (Kitchen Use)'}
              </h3>
              <button onClick={() => setAdjustModalItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="p-6 space-y-4">
              <div>
                <div className="font-bold text-slate-900 text-lg">{adjustModalItem.itemName}</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  Current Stock: <strong>{adjustModalItem.currentStock} {adjustModalItem.unit}</strong>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Quantity ({adjustModalItem.unit}) *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={adjustQty}
                  onChange={e => setAdjustQty(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Reason / Notes</label>
                <input
                  type="text"
                  placeholder={adjustType === 'ADD' ? 'Weekly purchase from wholesaler' : 'Lunch preparation consumption'}
                  value={adjustNotes}
                  onChange={e => setAdjustNotes(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalItem(null)}
                  className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 font-bold rounded-lg text-white text-base shadow-xs transition-colors ${adjustType === 'ADD' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                >
                  Confirm {adjustType === 'ADD' ? 'Addition' : 'Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingItem ? 'Edit Pantry Item' : 'Add New Pantry Item'}
              </h3>
              <button onClick={closeItemModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arhar Dal, Atta, Mustard Oil"
                  value={itemForm.itemName || ''}
                  onChange={e => setItemForm({ ...itemForm, itemName: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={itemForm.category || 'GRAINS'}
                    onChange={e => setItemForm({ ...itemForm, category: e.target.value as any })}
                    className={`${inputClass} bg-white`}
                  >
                    {stockCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Unit *</label>
                  {!showCustomUnitInput ? (
                    <select
                      value={itemForm.unit || 'kg'}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      className={`${inputClass} bg-white`}
                      required
                    >
                      {PREDEFINED_UNITS.map(unit => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                      {itemForm.unit && !PREDEFINED_UNITS.includes(itemForm.unit) && (
                        <option value={itemForm.unit}>{itemForm.unit}</option>
                      )}
                      <option value="CUSTOM">+ Add Custom Unit...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter unit name..."
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        onBlur={handleCustomUnitBlur}
                        onKeyDown={handleCustomUnitKeyPress}
                        className="flex-1 min-w-0 px-3 py-2.5 border border-amber-400 rounded-lg text-base focus:ring-2 focus:ring-amber-500 focus:outline-none bg-amber-50"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomUnitInput(false);
                          setCustomUnit('');
                        }}
                        className="px-3 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>{editingItem ? 'Current Stock' : 'Initial Stock'}</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={itemForm.currentStock === 0 ? '' : itemForm.currentStock}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setItemForm({ ...itemForm, currentStock: val });
                    }}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Min. Alert Qty</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={itemForm.minimumStockLevel === 0 ? '' : itemForm.minimumStockLevel}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setItemForm({ ...itemForm, minimumStockLevel: val });
                    }}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Unit Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={itemForm.unitPrice === 0 ? '' : itemForm.unitPrice}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setItemForm({ ...itemForm, unitPrice: val });
                    }}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={itemForm.expiryDate || ''}
                  onChange={e => setItemForm({ ...itemForm, expiryDate: e.target.value })}
                  className={inputClass}
                />
                <p className="text-sm text-slate-500 mt-1.5">
                  You'll get an alert when this date is within {EXPIRY_WARN_DAYS} days, and again once it has passed.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeItemModal}
                  className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-xs text-base"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
