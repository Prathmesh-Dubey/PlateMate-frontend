// src/pages/StaffPage.tsx - COMPLETE FIXED WITH ALL ADVANCE CALCULATIONS + DOUBLE PAYMENT FIX

import React, { useEffect, useState, useMemo } from 'react';
import {
  UserCog,
  UserPlus,
  IndianRupee,
  Calendar,
  CreditCard,
  HandCoins,
  Phone,
  Search,
  X,
  Edit2,
  Trash2,
  Filter,
  User,
  LayoutGrid,
  List,
  CheckCircle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import api from '../api';
import type { Staff, StaffPayment, StaffAdvance, StaffPosition } from '../types';
import { Avatar } from '../components/Avatar';
import { ProfileImageUploader } from '../components/ProfileImageUploader';

interface StaffPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const positions: StaffPosition[] = [
  'HEAD_COOK',
  'ASSISTANT_COOK',
  'KITCHEN_HELPER',
  'CLEANER',
  'MESS_MANAGER',
  'OTHER',
];

const avatarColors = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
];

export const StaffPage: React.FC<StaffPageProps> = ({ searchTerm: globalSearchTerm, showToast }) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<StaffPayment[]>([]);
  const [advances, setAdvances] = useState<StaffAdvance[]>([]);
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'PAYMENTS' | 'ADVANCES'>('ROSTER');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');

  // Filter states
  const [staffSearchTerm, setStaffSearchTerm] = useState<string>('');
  const [paymentSearchTerm, setPaymentSearchTerm] = useState<string>('');
  const [paymentDateFrom, setPaymentDateFrom] = useState<string>('');
  const [paymentDateTo, setPaymentDateTo] = useState<string>('');
  const [advanceSearchTerm, setAdvanceSearchTerm] = useState<string>('');
  const [advanceDateFrom, setAdvanceDateFrom] = useState<string>('');
  const [advanceDateTo, setAdvanceDateTo] = useState<string>('');

  // Modals
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState<Partial<Staff>>({
    fullName: '',
    phoneNumber: '',
    position: 'KITCHEN_HELPER',
    baseSalary: 12000,
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: 'FULL_TIME',
    status: 'ACTIVE',
  });
  const [pendingStaffImage, setPendingStaffImage] = useState<{ file?: File; url?: string; preview?: string } | null>(null);

  // Salary Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedStaffAdvances, setSelectedStaffAdvances] = useState<StaffAdvance[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: 12000,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMonth: new Date().toLocaleString('default', { month: 'long' }),
    paymentYear: new Date().getFullYear(),
    paymentMonthNumber: new Date().getMonth() + 1,
    paymentMethod: 'CASH' as const,
    remarks: 'Monthly salary disbursed',
    deductAdvance: true,
    advanceDeduction: 0,
    netPayable: 0,
  });

  // ✅ NEW: Submission guards to prevent double payments
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Advance Modal
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    amount: 5000,
    advanceDate: new Date().toISOString().split('T')[0],
    reason: 'Medical emergency',
    installmentMonths: 2,
    monthlyDeduction: 2500,
    remarks: '',
  });

  // Advance Status Edit Modal
  const [isAdvanceStatusModalOpen, setIsAdvanceStatusModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<StaffAdvance | null>(null);
  const [advanceStatusForm, setAdvanceStatusForm] = useState({
    status: 'APPROVED' as 'PENDING' | 'APPROVED' | 'REPAID' | 'REJECTED',
    repaymentAmount: 0,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sList, pList, aList] = await Promise.all([
        api.staff.profile.getAll(),
        api.staff.payment.getAll(),
        api.staff.advance.getAll(),
      ]);
      setStaffList(Array.isArray(sList) ? sList : []);
      setPayments(Array.isArray(pList) ? pList : []);
      setAdvances(Array.isArray(aList) ? aList : []);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load staff roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getAvatarColor = (name: string) => {
    if (!name) return avatarColors[0];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarColors[index % avatarColors.length];
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStaffName = (item: any) => {
    if (!item) return 'Unknown Staff';
    if (item.staffName) return item.staffName;
    if (item.staffId) {
      let staff = staffList.find(s => s.id === item.staffId);
      if (staff) return staff.fullName;
      staff = staffList.find(s => s.staffId === item.staffId);
      if (staff) return staff.fullName;
      if (item.staffId.length < 20) {
        staff = staffList.find(s => s.staffId === item.staffId || s.id === item.staffId);
        if (staff) return staff.fullName;
      }
    }
    return 'Unknown Staff';
  };

  const getStaffObject = (item: any): Staff | undefined => {
    if (!item || !item.staffId) return undefined;
    let staff = staffList.find(s => s.id === item.staffId);
    if (staff) return staff;
    staff = staffList.find(s => s.staffId === item.staffId);
    if (staff) return staff;
    return undefined;
  };

  const getStaffOutstandingAdvances = (staffId: string) => {
    if (!staffId) return [];

    return advances.filter(a => {
      const staff = getStaffObject(a);
      const isStaffMatch = a.staffId === staffId ||
        staff?.id === staffId ||
        staff?.staffId === staffId ||
        (staffList.find(s => s.id === staffId)?.staffId === a.staffId);

      const totalAmount = a.amount || a.advanceAmount || 0;
      const repaidAmount = a.repaidAmount || a.repaymentAmount || 0;
      const remaining = totalAmount - repaidAmount;

      return isStaffMatch &&
        a.status === 'APPROVED' &&
        remaining > 0;
    });
  };

  const getTotalOutstandingAdvance = (staffId: string) => {
    if (!staffId) return 0;
    const staffAdvances = getStaffOutstandingAdvances(staffId);
    return staffAdvances.reduce((sum, a) => {
      const totalAmount = a.amount || a.advanceAmount || 0;
      const repaidAmount = a.repaidAmount || a.repaymentAmount || 0;
      return sum + (totalAmount - repaidAmount);
    }, 0);
  };

  const isSalaryPaidForMonth = (staffId: string, month: number, year: number): boolean => {
    if (!staffId) return false;
    return payments.some(p => {
      const staff = getStaffObject(p);
      const isMatch = p.staffId === staffId || staff?.id === staffId || staff?.staffId === staffId;
      return isMatch && p.paymentMonthNumber === month && p.paymentYear === year;
    });
  };

  const getLastPayment = (staffId: string): StaffPayment | undefined => {
    if (!staffId) return undefined;
    const staffPayments = payments.filter(p => {
      const staff = getStaffObject(p);
      return p.staffId === staffId || staff?.id === staffId || staff?.staffId === staffId;
    });
    return staffPayments.sort((a, b) => {
      const dateA = new Date(a.paymentDate || '');
      const dateB = new Date(b.paymentDate || '');
      return dateB.getTime() - dateA.getTime();
    })[0];
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.fullName || !staffForm.phoneNumber) {
      showToast('error', 'Full Name and Phone Number are required');
      return;
    }

    if (staffForm.baseSalary === undefined || Number(staffForm.baseSalary) < 0) {
      showToast('error', 'Base salary must be zero or more');
      return;
    }

    try {
      const payload: Partial<Staff> = {
        ...staffForm,
        fullName: (staffForm.fullName || '').trim(),
        phoneNumber: (staffForm.phoneNumber || '').trim(),
        employmentType: staffForm.employmentType || 'FULL_TIME',
        status: staffForm.status || 'ACTIVE',
        baseSalary: Number(staffForm.baseSalary) || 0,
      };
      if (editingStaff && editingStaff.id) {
        await api.staff.profile.update(editingStaff.id, payload);
        showToast('success', 'Staff profile updated');
      } else {
        const created = await api.staff.profile.create(payload as Staff);
        showToast('success', `New staff member added${created?.staffId ? ` (${created.staffId})` : ''}`);
        if (created?.id && pendingStaffImage) {
          try {
            if (pendingStaffImage.file) {
              const fd = new FormData();
              fd.append('images', pendingStaffImage.file);
              await api.staff.uploadImages(created.id, fd, true);
            } else if (pendingStaffImage.url) {
              await api.staff.setPrimaryImage(created.id, pendingStaffImage.url);
            }
          } catch (imgErr: any) {
            showToast('error', `Staff saved, but the photo could not be applied: ${imgErr?.message || 'unknown error'}`);
          }
        }
      }
      setPendingStaffImage(null);
      setIsStaffModalOpen(false);
      setEditingStaff(null);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save staff');
    }
  };

  const handleDeleteStaff = async (staff: Staff) => {
    if (!staff.id) {
      showToast('error', 'Staff ID not found');
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${staff.fullName}" from staff roster?`)) {
      try {
        await api.staff.delete(staff.id);
        showToast('success', `Staff member ${staff.fullName} deleted successfully`);
        loadData();
      } catch (err: any) {
        showToast('error', err.message || 'Failed to delete staff');
      }
    }
  };

  const handleDeletePayment = async (payment: StaffPayment) => {
    if (!payment.id) return;
    const staff = getStaffObject(payment);
    const staffName = staff?.fullName || getStaffName(payment) || 'Unknown Staff';
    if (window.confirm(`Delete salary payment of ₹${(payment.amount || 0).toLocaleString()} for ${staffName}?`)) {
      try {
        await api.staff.payment.delete(payment.id);
        showToast('success', `Salary payment deleted for ${staffName}`);
        loadData();
      } catch (err: any) {
        showToast('error', err.message || 'Failed to delete payment');
      }
    }
  };

  const handleDeleteAdvance = async (advance: StaffAdvance) => {
    if (!advance.id) return;
    const staffName = getStaffName(advance);
    if (window.confirm(`Delete advance of ₹${(advance.amount || advance.advanceAmount || 0).toLocaleString()} for ${staffName}?`)) {
      try {
        await api.staff.advance.delete(advance.id);
        showToast('success', `Advance deleted for ${staffName}`);
        loadData();
      } catch (err: any) {
        showToast('error', err.message || 'Failed to delete advance');
      }
    }
  };

  // ✅ FIXED: Handle advance status update with submission guard
  const handleUpdateAdvanceStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingStatus) return;
    if (!editingAdvance || !editingAdvance.id) return;

    setIsSubmittingStatus(true);
    try {
      const newStatus = advanceStatusForm.status;

      if (newStatus === 'APPROVED') {
        await api.staff.advance.approve(editingAdvance.id, '');
        showToast('success', 'Advance approved successfully');
      } else if (newStatus === 'REJECTED') {
        await api.staff.advance.reject(editingAdvance.id);
        showToast('success', 'Advance rejected successfully');
      } else if (newStatus === 'REPAID') {
        const totalAdvance = editingAdvance.amount || editingAdvance.advanceAmount || 0;
        const repaid = editingAdvance.repaidAmount || editingAdvance.repaymentAmount || 0;
        const remaining = totalAdvance - repaid;

        if (remaining > 0) {
          await api.staff.advance.repay(editingAdvance.id, remaining);
          showToast('success', `Advance repaid: ₹${remaining.toLocaleString()}`);
        } else {
          await api.staff.advance.update(editingAdvance.id, { status: 'REPAID' });
          showToast('success', 'Advance marked as repaid');
        }
      } else if (newStatus === 'PENDING') {
        await api.staff.advance.update(editingAdvance.id, { status: 'PENDING' });
        showToast('success', 'Advance status set to PENDING');
      }

      setIsAdvanceStatusModalOpen(false);
      setEditingAdvance(null);
      await loadData();
    } catch (err: any) {
      console.error('Status update error:', err);
      showToast('error', err.message || 'Failed to update advance status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // ✅ FIXED: handlePaySalary - prevents double payment with submission guard
  // and updates advances directly (via update) instead of repay() to avoid
  // the backend creating a second salary-payment record.
  const handlePaySalary = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ GUARD: prevent double submission
    if (isSubmittingPayment) return;

    if (!selectedStaff || !selectedStaff.id) {
      showToast('error', 'No staff selected');
      return;
    }

    const currentMonth = paymentForm.paymentMonthNumber;
    const currentYear = paymentForm.paymentYear;

    if (isSalaryPaidForMonth(selectedStaff.id, currentMonth, currentYear)) {
      showToast('error', `⚠️ Salary for ${selectedStaff.fullName} has already been paid for ${paymentForm.paymentMonth} ${currentYear}. Please delete the existing salary slip first.`);
      return;
    }

    setIsSubmittingPayment(true);

    try {
      let advanceAmount = 0;
      let advanceRemarks = '';
      const advancesToSettle: any[] = [];

      if (paymentForm.deductAdvance) {
        const outstandingAdvances = getStaffOutstandingAdvances(selectedStaff.id);

        if (outstandingAdvances.length > 0) {
          advanceAmount = outstandingAdvances.reduce((sum, a) => {
            const totalAdvance = a.amount || a.advanceAmount || 0;
            const repaid = a.repaidAmount || a.repaymentAmount || 0;
            const remaining = totalAdvance - repaid;
            return sum + remaining;
          }, 0);

          advanceRemarks = outstandingAdvances.map(a => {
            const totalAdvance = a.amount || a.advanceAmount || 0;
            const repaid = a.repaidAmount || a.repaymentAmount || 0;
            const remaining = totalAdvance - repaid;
            return `Advance: ₹${totalAdvance.toLocaleString()} (${a.reason || a.purpose || 'No reason'}) - Remaining: ₹${remaining.toLocaleString()}`;
          }).join('; ');

          advancesToSettle.push(...outstandingAdvances);
        }
      }

      // ✅ Total payable = Base Salary + Advance Amount
      const totalPayable = paymentForm.amount + advanceAmount;

      // ✅ Create salary payment with total amount (salary + advance)
      await api.staff.payment.create({
        staffId: selectedStaff.id,
        amount: Number(totalPayable),
        paymentDate: paymentForm.paymentDate,
        paymentMonth: paymentForm.paymentMonth,
        paymentYear: paymentForm.paymentYear,
        paymentMonthNumber: paymentForm.paymentMonthNumber,
        paymentMethod: paymentForm.paymentMethod,
        remarks: `${paymentForm.remarks}${advanceRemarks ? ` | Advances added: ₹${advanceAmount.toLocaleString()} - ${advanceRemarks}` : ''}`,
      });

      // ✅ FIXED: Settle advances by DIRECTLY updating the advance record
      // instead of calling advance.repay() — this avoids the backend creating
      // a SECOND salary-payment entry for the same advance.
      if (advanceAmount > 0 && advancesToSettle.length > 0) {
        for (const advance of advancesToSettle) {
          const totalAdvance = advance.amount || advance.advanceAmount || 0;
          const repaid = advance.repaidAmount || advance.repaymentAmount || 0;
          const remaining = totalAdvance - repaid;

          if (remaining > 0) {
            await api.staff.advance.update(advance.id, {
              repaidAmount: totalAdvance,
              repaymentAmount: totalAdvance,
              status: 'REPAID',
            });
          }
        }
      }

      showToast('success',
        `✅ Salary of ₹${totalPayable.toLocaleString()} paid to ${selectedStaff.fullName}${advanceAmount > 0 ? ` (Advance added: ₹${advanceAmount.toLocaleString()})` : ''}`
      );
      setIsPaymentModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Salary payment error:', err);
      showToast('error', err.message || 'Salary payment failed');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ✅ FIXED: handleGiveAdvance with submission guard
  const handleGiveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingAdvance) return;

    if (!selectedStaff || !selectedStaff.id) {
      showToast('error', 'No staff member selected');
      return;
    }

    if (!advanceForm.amount || advanceForm.amount <= 0) {
      showToast('error', 'Please enter a valid advance amount');
      return;
    }

    setIsSubmittingAdvance(true);

    try {
      const advanceData = {
        staffId: selectedStaff.id,
        advanceDate: advanceForm.advanceDate,
        amount: Number(advanceForm.amount),
        reason: advanceForm.reason || 'General advance',
        installmentMonths: Number(advanceForm.installmentMonths) || 1,
        monthlyDeduction: Number(advanceForm.monthlyDeduction) || Number(advanceForm.amount),
        remarks: advanceForm.remarks || '',
        status: 'APPROVED' as const,
        repaidAmount: 0,
        repaymentAmount: 0,
      };

      await api.staff.advance.create(advanceData);
      showToast('success', `✅ Advance of ₹${advanceForm.amount.toLocaleString()} approved for ${selectedStaff.fullName}`);
      setIsAdvanceModalOpen(false);
      setAdvanceForm({
        amount: 5000,
        advanceDate: new Date().toISOString().split('T')[0],
        reason: 'Medical emergency',
        installmentMonths: 2,
        monthlyDeduction: 2500,
        remarks: '',
      });
      await loadData();
    } catch (err: any) {
      console.error('Advance error:', err);
      showToast('error', err.message || 'Failed to record advance');
    } finally {
      setIsSubmittingAdvance(false);
    }
  };

  const openPaymentModal = (staff: Staff) => {
    if (!staff || !staff.id) {
      showToast('error', 'Invalid staff member');
      return;
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const alreadyPaid = isSalaryPaidForMonth(staff.id, currentMonth, currentYear);

    const outstandingAdvances = getStaffOutstandingAdvances(staff.id);

    let totalAdvanceAmount = 0;

    if (outstandingAdvances.length > 0) {
      totalAdvanceAmount = outstandingAdvances.reduce((sum, a) => {
        const total = a.amount || a.advanceAmount || 0;
        const repaid = a.repaidAmount || a.repaymentAmount || 0;
        return sum + (total - repaid);
      }, 0);
    }

    setSelectedStaff(staff);
    setSelectedStaffAdvances(outstandingAdvances);

    const baseSalary = staff.baseSalary || 0;
    const netPayable = baseSalary + totalAdvanceAmount;

    setPaymentForm({
      amount: baseSalary,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMonth: new Date().toLocaleString('default', { month: 'long' }),
      paymentYear: new Date().getFullYear(),
      paymentMonthNumber: new Date().getMonth() + 1,
      paymentMethod: 'CASH',
      remarks: `Monthly salary for ${new Date().toLocaleString('default', { month: 'long' })}`,
      deductAdvance: outstandingAdvances.length > 0,
      advanceDeduction: totalAdvanceAmount,
      netPayable: netPayable,
    });

    if (alreadyPaid) {
      showToast('info', `⚠️ ${staff.fullName} has already been paid for ${new Date().toLocaleString('default', { month: 'long' })} ${currentYear}. Delete the existing salary slip to pay again.`);
    }

    setIsPaymentModalOpen(true);
  };

  const totalMonthlyPayroll = staffList
    .filter(s => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + (s.baseSalary || 0), 0);

  const totalOutstandingAdvances = advances
    .filter(a => a.status === 'APPROVED')
    .reduce((sum, a) => {
      const totalAmount = a.amount || a.advanceAmount || 0;
      const repaidAmount = a.repaidAmount || a.repaymentAmount || 0;
      const remaining = totalAmount - repaidAmount;
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

  const filteredStaff = staffList.filter(s => {
    const searchLower = (staffSearchTerm || globalSearchTerm || '').toLowerCase();
    if (searchLower) {
      return (
        s.fullName?.toLowerCase().includes(searchLower) ||
        s.phoneNumber?.includes(searchLower) ||
        s.position?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const staff = getStaffObject(p);
      const staffName = staff?.fullName || getStaffName(p) || 'Unknown Staff';

      if (paymentSearchTerm) {
        if (!staffName.toLowerCase().includes(paymentSearchTerm.toLowerCase())) {
          return false;
        }
      }

      if (paymentDateFrom && p.paymentDate) {
        if (p.paymentDate < paymentDateFrom) return false;
      }
      if (paymentDateTo && p.paymentDate) {
        if (p.paymentDate > paymentDateTo) return false;
      }

      return true;
    });
  }, [payments, staffList, paymentSearchTerm, paymentDateFrom, paymentDateTo]);

  const filteredAdvances = useMemo(() => {
    return advances.filter(a => {
      const staffName = getStaffName(a);

      if (advanceSearchTerm) {
        if (!staffName.toLowerCase().includes(advanceSearchTerm.toLowerCase())) {
          return false;
        }
      }

      if (advanceDateFrom && a.advanceDate) {
        if (a.advanceDate < advanceDateFrom) return false;
      }
      if (advanceDateTo && a.advanceDate) {
        if (a.advanceDate > advanceDateTo) return false;
      }

      return true;
    });
  }, [advances, staffList, advanceSearchTerm, advanceDateFrom, advanceDateTo]);

  const clearPaymentFilters = () => {
    setPaymentSearchTerm('');
    setPaymentDateFrom('');
    setPaymentDateTo('');
  };

  const clearAdvanceFilters = () => {
    setAdvanceSearchTerm('');
    setAdvanceDateFrom('');
    setAdvanceDateTo('');
  };

  const openAdvanceStatusModal = (advance: StaffAdvance) => {
    setEditingAdvance(advance);
    setAdvanceStatusForm({
      status: advance.status || 'PENDING',
      repaymentAmount: advance.repaidAmount || advance.repaymentAmount || 0,
    });
    setIsAdvanceStatusModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('ROSTER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'ROSTER'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            Staff Roster ({staffList.length})
          </button>
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'PAYMENTS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Salary Slips ({payments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('ADVANCES')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'ADVANCES'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            <HandCoins className="w-3.5 h-3.5" />
            <span>Advances ({advances.length})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'ROSTER' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('CARD')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center space-x-1 transition-all ${viewMode === 'CARD'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center space-x-1 transition-all ${viewMode === 'TABLE'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setEditingStaff(null);
              setStaffForm({
                fullName: '',
                phoneNumber: '',
                position: 'KITCHEN_HELPER',
                baseSalary: 12000,
                joiningDate: new Date().toISOString().split('T')[0],
                employmentType: 'FULL_TIME',
                status: 'ACTIVE',
              });
              setPendingStaffImage(null);
              setIsStaffModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs shadow-xs transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Staff Employed</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{staffList.length} members</div>
          </div>
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
            <UserCog className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Monthly Payroll</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">₹{totalMonthlyPayroll.toLocaleString()}</div>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Active Advances Outstanding</div>
            <div className="text-xl font-bold text-amber-600 mt-0.5">
              ₹{totalOutstandingAdvances.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <HandCoins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ROSTER TAB */}
      {activeTab === 'ROSTER' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name, phone, or position..."
              value={staffSearchTerm || globalSearchTerm}
              onChange={(e) => setStaffSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
            />
          </div>

          {viewMode === 'CARD' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {filteredStaff.length === 0 ? (
                <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                  <User className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">No staff members found.</p>
                </div>
              ) : (
                filteredStaff.map(staff => {
                  const outstanding = getTotalOutstandingAdvance(staff.id);
                  const alreadyPaid = isSalaryPaidForMonth(
                    staff.id,
                    new Date().getMonth() + 1,
                    new Date().getFullYear()
                  );
                  return (
                    <div
                      key={staff.id}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all"
                    >
                      <div className="p-4 flex items-start gap-4">
                        <Avatar
                          src={staff.primaryImageUrl}
                          name={staff.fullName || 'User'}
                          size="lg"
                          colorClass={`text-white ${getAvatarColor(staff.fullName || 'User')}`}
                        />

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 truncate">{staff.fullName}</h3>
                          <p className="text-xs text-slate-500 truncate">{staff.position?.replace('_', ' ') || 'OTHER'}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            <span>{staff.phoneNumber}</span>
                          </div>
                          <div className="mt-1 text-xs font-semibold text-emerald-600">
                            ₹{(staff.baseSalary || 0).toLocaleString()}/mo
                          </div>
                          {outstanding > 0 && (
                            <div className="mt-1 text-xs font-semibold text-amber-600">
                              Outstanding Advance: ₹{outstanding.toLocaleString()}
                            </div>
                          )}
                          {alreadyPaid && (
                            <div className="mt-1 text-xs font-semibold text-rose-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Salary Paid This Month
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-4 pb-4 flex gap-1.5">
                        <button
                          onClick={() => openPaymentModal(staff)}
                          className={`flex-1 py-1.5 font-bold text-xs rounded-lg transition-colors text-center ${alreadyPaid
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          disabled={alreadyPaid}
                          title={alreadyPaid ? 'Salary already paid for this month' : 'Pay salary'}
                        >
                          {alreadyPaid ? 'Paid ✓' : 'Pay Salary'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStaff(staff);
                            setAdvanceForm({
                              amount: 5000,
                              advanceDate: new Date().toISOString().split('T')[0],
                              reason: 'Medical emergency',
                              installmentMonths: 2,
                              monthlyDeduction: 2500,
                              remarks: '',
                            });
                            setIsAdvanceModalOpen(true);
                          }}
                          className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors text-center"
                        >
                          Advance
                        </button>
                        <button
                          onClick={() => {
                            setEditingStaff(staff);
                            setStaffForm({ ...staff });
                            setIsStaffModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(staff)}
                          className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Position</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Base Salary</th>
                      <th className="py-3 px-4">Outstanding Advance</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No staff members registered.
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map(staff => {
                        const outstanding = getTotalOutstandingAdvance(staff.id);
                        const alreadyPaid = isSalaryPaidForMonth(
                          staff.id,
                          new Date().getMonth() + 1,
                          new Date().getFullYear()
                        );
                        return (
                          <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-900 text-sm">
                              <div className="flex items-center gap-3">
                                <Avatar
                                  src={staff.primaryImageUrl}
                                  name={staff.fullName || 'User'}
                                  size="sm"
                                  colorClass={`text-white ${getAvatarColor(staff.fullName || 'User')}`}
                                />
                                {staff.fullName}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {staff.position?.replace('_', ' ') || 'OTHER'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <div className="flex items-center">
                                <Phone className="w-3 h-3 mr-1 text-slate-400" />
                                {staff.phoneNumber}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                              ₹{(staff.baseSalary || 0).toLocaleString()}/mo
                            </td>
                            <td className="py-3.5 px-4 font-bold text-amber-600 text-sm">
                              {outstanding > 0 ? `₹${outstanding.toLocaleString()}` : '-'}
                            </td>
                            <td className="py-3.5 px-4">
                              {alreadyPaid ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  Paid This Month
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => openPaymentModal(staff)}
                                disabled={alreadyPaid}
                                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-colors ${alreadyPaid
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                              >
                                {alreadyPaid ? 'Paid ✓' : 'Pay Salary'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStaff(staff);
                                  setAdvanceForm({
                                    amount: 5000,
                                    advanceDate: new Date().toISOString().split('T')[0],
                                    reason: 'Medical emergency',
                                    installmentMonths: 2,
                                    monthlyDeduction: 2500,
                                    remarks: '',
                                  });
                                  setIsAdvanceModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold text-[11px] transition-colors"
                              >
                                Give Advance
                              </button>
                              <button
                                onClick={() => {
                                  setEditingStaff(staff);
                                  setStaffForm({ ...staff });
                                  setIsStaffModalOpen(true);
                                }}
                                className="p-1 hover:bg-slate-100 text-slate-500 rounded"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(staff)}
                                className="p-1 hover:bg-rose-50 text-rose-500 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* PAYMENTS TAB */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Filters</span>
                {(paymentSearchTerm || paymentDateFrom || paymentDateTo) && (
                  <span className="text-xs text-blue-600 font-medium">(Active)</span>
                )}
              </div>
              {(paymentSearchTerm || paymentDateFrom || paymentDateTo) && (
                <button onClick={clearPaymentFilters} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  Clear All Filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Search by Staff Name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search staff name..."
                    value={paymentSearchTerm}
                    onChange={(e) => setPaymentSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={paymentDateFrom}
                  onChange={(e) => setPaymentDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={paymentDateTo}
                  onChange={(e) => setPaymentDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Month & Year</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {payments.length === 0 ? 'No salary payment logs found.' : 'No payments match your filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map(p => {
                      const staff = getStaffObject(p);
                      const staffName = staff?.fullName || getStaffName(p) || 'Unknown Staff';
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-500">{p.paymentDate || '-'}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${getAvatarColor(staffName)}`}>
                                {getInitials(staffName)}
                              </div>
                              {staffName}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700">{p.paymentMonth} {p.paymentYear}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600 text-sm">₹{(p.amount || 0).toLocaleString()}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">{p.paymentMethod || 'CASH'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">{p.remarks || '-'}</td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleDeletePayment(p)}
                              className="p-1 hover:bg-rose-50 text-rose-500 rounded transition-colors"
                              title="Delete Payment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredPayments.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Showing {filteredPayments.length} of {payments.length} payments</span>
                <span className="font-semibold text-slate-700">
                  Total: ₹{filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADVANCES TAB */}
      {activeTab === 'ADVANCES' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Filters</span>
                {(advanceSearchTerm || advanceDateFrom || advanceDateTo) && (
                  <span className="text-xs text-blue-600 font-medium">(Active)</span>
                )}
              </div>
              {(advanceSearchTerm || advanceDateFrom || advanceDateTo) && (
                <button onClick={clearAdvanceFilters} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  Clear All Filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Search by Staff Name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search staff name..."
                    value={advanceSearchTerm}
                    onChange={(e) => setAdvanceSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={advanceDateFrom}
                  onChange={(e) => setAdvanceDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={advanceDateTo}
                  onChange={(e) => setAdvanceDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Date Given</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Advance Amount</th>
                    <th className="py-3 px-4">Repaid / Settled</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {advances.length === 0 ? 'No staff advance loans recorded.' : 'No advances match your filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAdvances.map(a => {
                      const staffName = getStaffName(a);
                      const statusColors: Record<string, string> = {
                        PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                        APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
                        REPAID: 'bg-green-50 text-green-700 border-green-200',
                        REJECTED: 'bg-red-50 text-red-700 border-red-200',
                      };
                      return (
                        <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-500">{a.advanceDate || '-'}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${getAvatarColor(staffName)}`}>
                                {getInitials(staffName)}
                              </div>
                              {staffName}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-amber-600 text-sm">₹{(a.amount || a.advanceAmount || 0).toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-slate-700 font-medium">₹{(a.repaidAmount || a.repaymentAmount || 0).toLocaleString()}</td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => openAdvanceStatusModal(a)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors hover:opacity-80 ${statusColors[a.status as keyof typeof statusColors] || 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                              title="Click to change status"
                            >
                              {a.status || 'PENDING'}
                              <Edit2 className="w-2.5 h-2.5 inline ml-1" />
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">{a.reason || a.purpose || '-'}</td>
                          <td className="py-3.5 px-4 text-center space-x-1">
                            <button
                              onClick={() => openAdvanceStatusModal(a)}
                              className="p-1 hover:bg-blue-50 text-blue-500 rounded transition-colors"
                              title="Edit Status"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAdvance(a)}
                              className="p-1 hover:bg-rose-50 text-rose-500 rounded transition-colors"
                              title="Delete Advance"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredAdvances.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Showing {filteredAdvances.length} of {advances.length} advances</span>
                <span className="font-semibold text-amber-700">
                  Total Outstanding: ₹{filteredAdvances
                    .filter(a => a.status === 'APPROVED')
                    .reduce((sum, a) => {
                      const totalAmount = a.amount || a.advanceAmount || 0;
                      const repaidAmount = a.repaidAmount || a.repaymentAmount || 0;
                      const remaining = totalAmount - repaidAmount;
                      return sum + (remaining > 0 ? remaining : 0);
                    }, 0)
                    .toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Salary Payment Modal */}
      {isPaymentModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Disburse Salary: {selectedStaff.fullName}</h3>
                <p className="text-[10px] text-slate-400">ID: {selectedStaff.id}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaySalary} className="p-5 space-y-4 text-xs">
              {isSalaryPaidForMonth(
                selectedStaff.id,
                paymentForm.paymentMonthNumber,
                paymentForm.paymentYear
              ) && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-800 text-xs">⚠️ Salary Already Paid</p>
                      <p className="text-rose-600 text-[11px]">
                        {selectedStaff.fullName} has already been paid for {paymentForm.paymentMonth} {paymentForm.paymentYear}.
                        Delete the existing salary slip to pay again.
                      </p>
                    </div>
                  </div>
                )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Base Salary (₹) *</label>
                <input
                  type="number"
                  required
                  value={paymentForm.amount}
                  onChange={e => {
                    const val = Number(e.target.value);
                    const totalOutstanding = getTotalOutstandingAdvance(selectedStaff.id);
                    setPaymentForm(prev => ({
                      ...prev,
                      amount: val,
                      advanceDeduction: prev.deductAdvance ? totalOutstanding : 0,
                      netPayable: val + (prev.deductAdvance ? totalOutstanding : 0),
                    }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {selectedStaffAdvances.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-amber-900 text-xs">Outstanding Advances</span>
                    <label className="flex items-center gap-1 text-xs text-amber-900">
                      <input
                        type="checkbox"
                        checked={paymentForm.deductAdvance}
                        onChange={(e) => {
                          const deduct = e.target.checked;
                          const totalOutstanding = getTotalOutstandingAdvance(selectedStaff.id);
                          setPaymentForm(prev => ({
                            ...prev,
                            deductAdvance: deduct,
                            advanceDeduction: deduct ? totalOutstanding : 0,
                            netPayable: prev.amount + (deduct ? totalOutstanding : 0),
                          }));
                        }}
                        className="rounded border-amber-300"
                      />
                      Add advances to salary
                    </label>
                  </div>

                  {paymentForm.deductAdvance && (
                    <>
                      <div className="space-y-1.5">
                        {selectedStaffAdvances.map((adv, idx) => {
                          const totalAmount = adv.amount || adv.advanceAmount || 0;
                          const repaidAmount = adv.repaidAmount || adv.repaymentAmount || 0;
                          const remaining = totalAmount - repaidAmount;
                          return (
                            <div key={adv.id} className="flex items-center justify-between text-xs bg-white/70 rounded p-1.5">
                              <div>
                                <span className="font-medium text-amber-800">₹{totalAmount.toLocaleString()}</span>
                                <span className="text-amber-600 ml-1">({adv.reason || adv.purpose || 'No reason'})</span>
                              </div>
                              <div className="text-slate-500">
                                Remaining: <span className="font-semibold text-amber-700">₹{remaining.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-amber-200 pt-2">
                        <span className="font-semibold text-amber-900">Total Advance to Add:</span>
                        <span className="font-bold text-amber-900">
                          +₹{paymentForm.advanceDeduction.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {paymentForm.deductAdvance && paymentForm.advanceDeduction > 0 && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <span className="font-semibold text-emerald-900 text-[11px]">✅ Total Payable (Salary + Advance):</span>
                  <span className="text-base font-bold text-emerald-900">
                    ₹{(paymentForm.amount + paymentForm.advanceDeduction).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Payment Month</label>
                  <input
                    type="text"
                    value={paymentForm.paymentMonth}
                    onChange={e => setPaymentForm({ ...paymentForm, paymentMonth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Year</label>
                  <input
                    type="number"
                    value={paymentForm.paymentYear}
                    onChange={e => setPaymentForm({ ...paymentForm, paymentYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                >
                  <option value="CASH">Cash in Hand</option>
                  <option value="UPI">UPI / GooglePay</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes / Reference</label>
                <input
                  type="text"
                  value={paymentForm.remarks}
                  onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isSubmittingPayment}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingPayment ||
                    isSalaryPaidForMonth(
                      selectedStaff.id,
                      paymentForm.paymentMonthNumber,
                      paymentForm.paymentYear
                    )
                  }
                  className={`px-4 py-1.5 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 ${
                    isSubmittingPayment ||
                    isSalaryPaidForMonth(
                      selectedStaff.id,
                      paymentForm.paymentMonthNumber,
                      paymentForm.paymentYear
                    )
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSubmittingPayment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Modal */}
      {isAdvanceModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Issue Advance: {selectedStaff.fullName}</h3>
              <button onClick={() => setIsAdvanceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGiveAdvance} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Staff Member</label>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-slate-900">
                  {selectedStaff?.fullName}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">ID: {selectedStaff?.id}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Advance Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={advanceForm.amount === 0 ? '' : advanceForm.amount}
                  onChange={e => {
                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                    setAdvanceForm({ ...advanceForm, amount: val });
                    if (advanceForm.installmentMonths > 0) {
                      setAdvanceForm(prev => ({
                        ...prev,
                        amount: val,
                        monthlyDeduction: Math.round(val / prev.installmentMonths),
                      }));
                    }
                  }}
                  onFocus={(e) => {
                    if (e.target.value === '0') {
                      e.target.value = '';
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') {
                      setAdvanceForm({ ...advanceForm, amount: 0 });
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Advance Date</label>
                <input
                  type="date"
                  value={advanceForm.advanceDate}
                  onChange={e => setAdvanceForm({ ...advanceForm, advanceDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason / Purpose</label>
                <input
                  type="text"
                  value={advanceForm.reason}
                  onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Installment Months</label>
                  <input
                    type="number"
                    min="1"
                    value={advanceForm.installmentMonths}
                    onChange={e => {
                      const months = Number(e.target.value) || 1;
                      setAdvanceForm(prev => ({
                        ...prev,
                        installmentMonths: months,
                        monthlyDeduction: Math.round(prev.amount / months),
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monthly Deduction</label>
                  <input
                    type="number"
                    value={advanceForm.monthlyDeduction}
                    onChange={e => setAdvanceForm({ ...advanceForm, monthlyDeduction: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Remarks (Optional)</label>
                <input
                  type="text"
                  value={advanceForm.remarks}
                  onChange={e => setAdvanceForm({ ...advanceForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  disabled={isSubmittingAdvance}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdvance}
                  className={`px-4 py-1.5 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 ${
                    isSubmittingAdvance ? 'bg-slate-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isSubmittingAdvance ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Issue Advance
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Status Edit Modal */}
      {isAdvanceStatusModalOpen && editingAdvance && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Update Advance Status</h3>
              <button onClick={() => setIsAdvanceStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAdvanceStatus} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Staff Member</label>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-slate-900">
                  {getStaffName(editingAdvance)}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Advance Amount</label>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-amber-600">
                  ₹{(editingAdvance.amount || editingAdvance.advanceAmount || 0).toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Repaid Amount</label>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-emerald-600">
                  ₹{(editingAdvance.repaidAmount || editingAdvance.repaymentAmount || 0).toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status *</label>
                <select
                  value={advanceStatusForm.status}
                  onChange={e => setAdvanceStatusForm({
                    ...advanceStatusForm,
                    status: e.target.value as 'PENDING' | 'APPROVED' | 'REPAID' | 'REJECTED'
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REPAID">REPAID</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              {advanceStatusForm.status === 'REPAID' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-800 text-[11px]">
                  ⚠️ Marking as REPAID will settle the remaining balance automatically.
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceStatusModalOpen(false)}
                  disabled={isSubmittingStatus}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStatus}
                  className={`px-4 py-1.5 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 ${
                    isSubmittingStatus ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isSubmittingStatus ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Update Status
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingStaff ? 'Edit Staff Profile' : 'Register New Staff Member'}
              </h3>
              <button onClick={() => setIsStaffModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={staffForm.fullName || ''}
                  onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Position / Role</label>
                  <select
                    value={staffForm.position || 'KITCHEN_HELPER'}
                    onChange={e => setStaffForm({ ...staffForm, position: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    {positions.map(p => (
                      <option key={p} value={p}>
                        {p.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={staffForm.phoneNumber || ''}
                    onChange={e => setStaffForm({ ...staffForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Base Monthly Salary (₹)</label>
                  <input
                    type="number"
                    value={staffForm.baseSalary === 0 ? '' : staffForm.baseSalary}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setStaffForm({ ...staffForm, baseSalary: val });
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        e.target.value = '';
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') {
                        setStaffForm({ ...staffForm, baseSalary: 0 });
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={staffForm.joiningDate || ''}
                    onChange={e => setStaffForm({ ...staffForm, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="block text-slate-700 font-semibold mb-2">Profile Photo</label>
                <ProfileImageUploader
                  key={editingStaff?.id || 'new-staff'}
                  currentUrl={editingStaff?.id ? editingStaff.primaryImageUrl : (pendingStaffImage?.preview || pendingStaffImage?.url || null)}
                  name={staffForm.fullName || 'Staff'}
                  size="lg"
                  successMessage={editingStaff?.id ? undefined : 'Photo selected. It will be applied when you save the staff member.'}
                  onUpload={async (file) => {
                    if (editingStaff?.id) {
                      const fd = new FormData();
                      fd.append('images', file);
                      const updated = await api.staff.uploadImages(editingStaff.id, fd, true);
                      setEditingStaff(prev => (prev ? { ...prev, primaryImageUrl: updated?.primaryImageUrl, imageUrls: updated?.imageUrls } : prev));
                      loadData();
                    } else {
                      setPendingStaffImage({ file, preview: URL.createObjectURL(file) });
                    }
                  }}
                  onSetUrl={async (url) => {
                    if (editingStaff?.id) {
                      const updated = await api.staff.setPrimaryImage(editingStaff.id, url);
                      setEditingStaff(prev => (prev ? { ...prev, primaryImageUrl: updated?.primaryImageUrl, imageUrls: updated?.imageUrls } : prev));
                      loadData();
                    } else {
                      setPendingStaffImage({ url });
                    }
                  }}
                  onRemove={editingStaff?.id && editingStaff.primaryImageUrl ? async () => {
                    const updated = await api.staff.removeImage(editingStaff.id!, editingStaff.primaryImageUrl!);
                    setEditingStaff(prev => (prev ? { ...prev, primaryImageUrl: updated?.primaryImageUrl, imageUrls: updated?.imageUrls } : prev));
                    loadData();
                  } : undefined}
                  hint={editingStaff?.id ? 'Photo changes are saved immediately for this staff member.' : 'Optional. The photo is applied right after the staff member is saved.'}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setIsStaffModalOpen(false); setPendingStaffImage(null); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-xs"
                >
                  Save Staff Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};