// types.ts - Shared Types for Mess Management System

// ==================== API Response Types ====================
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

// ==================== Auth Types ====================
export interface LoginRequest {
  emailOrPhone: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
}

export interface VerifyOtpRequest {
  email: string;
  otpCode: string;
  purpose: string;
}
// ==================== Department Types ====================
export interface Department {
  id: string;
  code: string;
  name: string;
  headName?: string;
  contactEmail?: string;
  contactPhone?: string;
  active: boolean;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otpCode: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
}

export interface AuthResponse {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  token: string;
  refreshToken: string;
  expiresAt: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  profilePictureUrl?: string;
  enabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface OtpResponse {
  email: string;
  purpose: string;
  message: string;
  expiresInMinutes: number;
}

// ==================== Candidate Types ====================
export interface Candidate {
  id?: string;
  fullName: string;
  phoneNumber?: string;
  /** Legacy alias of phoneNumber used by older UI code */
  phone?: string;
  email?: string;
  address?: string;
  roomNumber?: string;
  joiningDate?: string;
  endDate?: string;
  monthlyRate?: number;
  monthlyFee?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'LEFT';
  dietaryPreference?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  notes?: string;
  candidateId?: string;
  leavingDate?: string;
  /** Uploaded file reference (/uploads/...) or external image URL */
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== Attendance Types ====================
export interface Attendance {
  id?: string;
  candidateId: string;
  attendanceDate: string;
  status: 'IN' | 'OUT' | 'ABSENT' | 'HALF_DAY';
  inTime?: string;
  outTime?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkAttendance {
  attendanceDate: string;
  presentCandidateIds: string[];
  absentCandidateIds: string[];
}

// ==================== Meal Types ====================
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACKS';

export interface Meal {
  id?: string;
  candidateId: string;
  mealDate: string;
  mealType: MealType;
  isTaken: boolean;
  mealPreference?: 'VEG' | 'NON_VEG';
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkMeal {
  mealDate: string;
  mealType: MealType;
  candidateIds: string[];
  mealPreference?: 'VEG' | 'NON_VEG';
}

// ==================== Expense Types ====================
export type ExpenseCategory =
  | 'VEGETABLES'
  | 'GROCERY'
  | 'MILK_DAIRY'
  | 'GAS_CYLINDER'
  | 'UTILITIES'
  | 'MAINTENANCE'
  | 'MISCELLANEOUS';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'UNPAID';

export interface Expense {
  id?: string;
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount?: number;
  category: ExpenseCategory | string;
  subCategory?: string;
  vendorName?: string;
  vendorPhone?: string;
  invoiceNumber?: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  attachmentUrl?: string;
  attachmentName?: string;
  remarks?: string;
  enteredByCandidateId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== Stock Types ====================
export type StockCategory =
  | 'PULSES'
  | 'GRAINS'
  | 'OILS'
  | 'SPICES'
  | 'DAIRY'
  | 'VEGETABLES'
  | 'FRUITS'
  | 'MEAT'
  | 'SEAFOOD'
  | 'BEVERAGES'
  | 'SNACKS'
  | 'FROZEN'
  | 'BAKERY'
  | 'OTHERS';

export interface StockItem {
  id?: string;
  itemName: string;
  category: StockCategory | string;
  subCategory?: string;
  unit: string;
  currentStock: number;
  minimumStockLevel: number;
  maximumStockLevel?: number;
  unitPrice: number;
  expiryDate?: string; // ISO date "YYYY-MM-DD"
  description?: string;
  supplierName?: string;
  supplierContact?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  enteredByCandidateId?: string;
  createdAt?: string;
  updatedAt?: string;
  images?: string[];
  primaryImage?: string;
  imageUrls?: string[];
  primaryImageUrl?: string;
}

export interface StockTransaction {
  id?: string;
  stockItemId: string;
  stockItemName?: string;
  transactionType: 'PURCHASE' | 'USAGE' | 'RETURN' | 'ADJUSTMENT';
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalAmount?: number;
  stockBefore: number;
  stockAfter: number;
  transactionDate: string;
  referenceNumber?: string;
  referenceType?: string;
  referenceId?: string;
  remarks?: string;
  enteredBy?: string;
  createdAt?: string;
}

// ==================== Staff Types ====================
export type StaffPosition =
  | 'HEAD_COOK'
  | 'ASSISTANT_COOK'
  | 'KITCHEN_HELPER'
  | 'CLEANER'
  | 'MESS_MANAGER'
  | 'OTHER';

export interface Staff {
  id?: string;
  staffId?: string;
  fullName: string;
  position: StaffPosition | string;
  phoneNumber: string;
  email?: string;
  address?: string;
  joiningDate: string;
  baseSalary: number;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'LEFT';
  emergencyContact?: string;
  emergencyPhone?: string;
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  enteredByCandidateId?: string;
  createdAt?: string;
  updatedAt?: string;
  images?: string[];
  primaryImage?: string;
  imageUrls?: string[];
  primaryImageUrl?: string;
}

export interface StaffPayment {
  id?: string;
  staffId: string;
  paymentDate: string;
  amount: number;
  paymentMonth: string;
  paymentYear: number;
  paymentMonthNumber: number;
  bonus?: number;
  deductions?: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  remarks?: string;
  enteredByCandidateId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffAdvance {
  repaymentAmount: number;
  id?: string;
  staffId: string;
  advanceDate: string;
  amount: number;
  advanceAmount?: number;
  reason: string;
  installmentMonths: number;
  monthlyDeduction: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REPAID';
  approvedByCandidateId?: string;
  approvedAt?: string;
  repaidAmount?: number;
  remainingAmount?: number;
  remarks?: string;
  enteredByCandidateId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== Billing Types ====================
export interface FeeCollection {
  id?: string;
  candidateId: string;
  collectionDate: string;
  amount: number;
  paymentMonth: string;
  paymentYear: number;
  paymentMonthNumber: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  receiptNumber?: string;
  remarks?: string;
  collectedByCandidateId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkFeeCollection {
  collectionDate: string;
  paymentMonth: string;
  paymentYear: number;
  paymentMonthNumber: number;
  paymentMethod: PaymentMethod;
  candidateFees: Array<{
    candidateId: string;
    amount: number;
    remarks?: string;
  }>;
  collectedByCandidateId?: string;
}

// ==================== Party Types ====================
export type PartyType = 'BIRTHDAY' | 'FAREWELL' | 'FESTIVAL' | 'CORPORATE' | 'OTHER';
export interface Party {
  id?: string;
  partyId?: string;
  partyName?: string;
  clientName?: string;
  contactPerson?: string;
  phoneNumber?: string;
  clientPhone?: string;
  email?: string;
  clientEmail?: string;
  address?: string;
  eventDate: string;
  eventTime?: string;
  partyType?: PartyType | string;
  numberOfPeople: number;
  mealType?: 'VEG' | 'NON_VEG' | 'BOTH';
  thaliRate: number;
  advanceAmount?: number;
  discount?: number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  paymentStatus: PaymentStatus;
  paidAmount: number;
  paymentMethod?: PaymentMethod;
  specialRequests?: string;
  remarks?: string;
  enteredByCandidateId?: string;
  extraItems?: Array<{
    itemName: string;
    quantity: number;
    rate: number;
    unit?: string;
  }>;
  invoiceNumber?: string;
  createdAt?: string;
  updatedAt?: string;

  // ==================== DEPARTMENT (NEW) ====================
  departmentId?: string;            // Department UUID
  departmentCode?: string;          // denormalized code, e.g. "CSE"
  departmentName?: string;          // resolved name, for display
  additionalDepartments?: string;   // free-text for joint events, e.g. "ECE, MECH"
}

export interface PartyPayment {
  partyId: string;
  amount: number;
  paymentDate?: string;
  receiptNumber?: string;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  remarks?: string;
  enteredByCandidateId?: string;
}

// ==================== Menu Types ====================
export interface MenuItem {
  id?: string;
  itemName: string;
  description?: string;
  price?: number;
  category: string;
  isVegetarian: boolean;
  isAvailable: boolean;
  preparationTime?: string;
  servingSize?: string;
  displayOrder?: number;
  remarks?: string;
}

export interface Menu {
  id?: string;
  menuDate: string;
  mealType: MealType;
  menuName: string;
  description?: string;
  isSpecial: boolean;
  specialRemarks?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdByCandidateId?: string;
  items: MenuItem[];
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== Report Types ====================
export interface ReportRequest {
  reportType: 'CUSTOM' | 'MONTHLY' | 'YEARLY';
  startDate?: string;
  endDate?: string;
  month?: number;
  year?: number;
  format: 'PDF' | 'EXCEL' | 'CSV';
}

// ==================== Dashboard Types ====================
export interface DashboardStats {
  currentMonthIncome?: number;
  currentMonthExpenses?: number;
  currentMonthProfit?: number;
  yearIncome?: number;
  yearExpenses?: number;
  yearProfit?: number;
  activeCandidates?: number;
  activeStaff?: number;
  pendingFees?: number;
  pendingCandidates?: number;
  collectionPercentage?: number;
  month?: number;
  year?: number;
  today?: {
    attendance: { present: number; absent: number; total: number };
    meals: { total: number; taken: number; notTaken: number };
    expenses: { total: number; count: number };
  };
  currentMonth?: {
    income: number;
    expenses: number;
    staffSalary: number;
    profit: number;
    feeCollected: number;
    partyRevenue: number;
  };
  currentYear?: {
    income: number;
    expenses: number;
    staffSalary: number;
    profit: number;
  };
  totalStaff?: number;
  pendingParties?: number;
  lowStockItems?: number;
}

// ==================== Summary Types ====================
export interface DailySummary {
  present: number;
  absent: number;
  total: number;
}

export interface MealSummary {
  total: number;
  taken: number;
  notTaken: number;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  categories: Record<string, number>;
}

export interface FeeSummary {
  totalCollected: number;
  totalCandidates: number;
  paid: number;
  pending: number;
}

export interface StockSummary {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  categories: string[];
}

// ==================== College Billing Types ====================
export type CollegeBillingPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface CollegeBilling {
  id?: string;
  college: string;
  month: number;
  year: number;
  monthName?: string;
  billingDate?: string;
  totalStudentAttendance?: number;
  totalThalisServed?: number;
  ratePerThali?: number;
  totalBillableAmount: number;
  amountReceived: number;
  outstandingBalance: number;
  status: CollegeBillingPaymentStatus;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CollegeBillingRequest {
  college: string;
  month: number;
  year: number;
  billingDate?: string;
  totalStudentAttendance?: number;
  totalThalisServed?: number;
  ratePerThali?: number;
  totalBillableAmount: number;
  amountReceived: number;
  remarks?: string;
}

export interface CollegeBillingSummary {
  totalBillableAmount: number;
  totalAmountReceived: number;
  totalOutstandingBalance: number;
  totalRecords: number;
  paidCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
}
// ==================== Staff Salary Summary (GET /api/staff/summary) ====================
export interface StaffSalarySummary {
  staffId: string;
  staffName: string;
  position: string;
  baseSalary: number;
  totalPaid: number;
  totalDeductions: number;
  totalBonus: number;
  outstandingAdvance: number;
  monthsWorked: number;
  joiningDate?: string;
  lastPaymentDate?: string;
}

// ==================== Billing Dashboard (GET /api/billing/summary) ====================
export type BillingScope = 'MONTH' | 'YEAR' | 'ALL';

export interface BillingSummary {
  scope: BillingScope;
  month?: number | null;
  year?: number | null;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  collegeBilling: {
    billableAmount: number;
    amountReceived: number;
    outstandingBalance: number;
    recordCount: number;
  };
  staffSalary: {
    monthlyPayroll: number;
    activeStaffCount: number;
    paidInPeriod: number;
    paymentCount: number;
  };
  expenses: {
    total: number;
    count: number;
    categoryBreakdown: Record<string, number>;
    dayToDayTotal: number;
    dayToDayCount: number;
    paidTotal: number;
    unpaidTotal: number;
  };
  todayExpense: {
    date: string;
    amount: number;
    count: number;
  };
  combinedExpenses: {
    total: number;
    expenses: number;
    staffSalaryPaid: number;
    formula: string;
  };
  messFees: {
    collected: number;
    collectionCount: number;
    expectedMonthly?: number | null;
    pending?: number | null;
    collectionRate?: number | null;
  };
  outstanding: {
    total: number;
    collegeOutstanding: number;
    partyPending: number;
    collectionRate?: number | null;
    totalBilledReceivables: number;
    totalReceivedReceivables: number;
  };
  partyIncome: {
    totalBilled: number;
    received: number;
    pending: number;
    partyCount: number;
  };
  profitLoss: {
    totalRevenue: number;
    totalExpenses: number;
    netProfitLoss: number;
    messFeesRevenue: number;
    partyIncome: number;
    collegeBillingIncome: number;
    expenses: number;
    staffSalary: number;
  };
}

// ==================== Monthly Profit & Loss (GET /api/billing/profit-loss-chart) ====================
export interface MonthlyProfitLossEntry {
  month: number;
  monthName: string;
  shortName: string;
  messFees: number;
  partyIncome: number;
  collegeBillingIncome: number;
  income: number;
  dayToDayExpenses: number;
  supplyExpenses: number;
  staffSalary: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  hasData: boolean;
}

export interface MonthlyProfitLoss {
  year: number;
  basis: string;
  monthlyData: MonthlyProfitLossEntry[];
  totals: {
    messFees: number;
    partyIncome: number;
    collegeBillingIncome: number;
    income: number;
    dayToDayExpenses: number;
    supplyExpenses: number;
    staffSalary: number;
    expenses: number;
    profit: number;
    profitableMonths: number;
    lossMonths: number;
    monthsWithData: number;
  };
}
