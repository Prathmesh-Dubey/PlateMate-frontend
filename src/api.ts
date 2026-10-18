// src/api.ts - Complete API Client for Mess Management System
import { isDemoMode } from './demo/demoMode';
import type {
  Candidate,
  Attendance,
  BulkAttendance,
  Meal,
  BulkMeal,
  Expense,
  StockItem,
  StockTransaction,
  Staff,
  StaffPayment,
  StaffAdvance,
  FeeCollection,
  BulkFeeCollection,
  Party,
  Department,
  PartyPayment,
  MenuItem,
  Menu,
  ReportRequest,
  LoginRequest,
  RegisterRequest,
  VerifyOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  AuthResponse,
  OtpResponse,
  ApiResponse,
  CollegeBilling,
  CollegeBillingRequest,
  CollegeBillingSummary,
  BillingScope,
  BillingSummary,
  MonthlyProfitLoss,
  StaffSalarySummary
} from './types';

/** Backend (Spring Boot) origin. Override with VITE_API_URL when the API runs elsewhere. */
export const API_BASE_URL: string = ((import.meta as any).env?.VITE_API_URL as string | undefined) || 'https://platemate-backend-69fq.onrender.com';
const BASE_URL = API_BASE_URL;

/** Dispatched on window when the session cannot be refreshed; App listens and logs the user out. */
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

export class MessManagementAPI {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
    // Load tokens from localStorage if available
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
      if (this.accessToken) this.loadPersistedCache();
    }
  }

  // ==================== TOKEN MANAGEMENT ====================
  /** `keepCache` = true when the same user's session is only being restored / its token refreshed. */
  setTokens(accessToken: string, refreshToken: string, keepCache: boolean = false) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (!keepCache) this.clearCache(); // never serve one user's cached reads to the next
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
    this.clearCache();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** Clears the stored session and notifies the app so it can return to the login screen. */
  private handleSessionExpired() {
    this.clearTokens();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
  }

  // ==================== PERSISTENT GET CACHE ====================
  // Every read (GET) goes through here. Responses are kept in memory AND saved to localStorage,
  // so re-opening the app (or a page) shows the saved data instantly with no network call.
  // Data is only re-fetched when the user taps Refresh, after any write (POST/PUT/PATCH/DELETE
  // clears the whole cache so the next read is fresh), or on login/logout. If the network is down,
  // the last saved copy is served instead of an error.
  private cache = new Map<string, { data: unknown; expiry: number }>();
  private inflightGets = new Map<string, Promise<unknown>>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly CACHE_STORAGE_KEY = 'platemate-api-cache-v1';
  // Effectively "as long as the app is installed"; the cache is cleared by writes, refresh and logout.
  private static readonly CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
  private static readonly MAX_PERSISTED_CHARS = 4_000_000; // stay under the ~5MB localStorage quota

  private loadPersistedCache() {
    try {
      const raw = localStorage.getItem(MessManagementAPI.CACHE_STORAGE_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw) as Record<string, { data: unknown; expiry: number }>;
      const now = Date.now();
      Object.entries(entries).forEach(([endpoint, entry]) => {
        if (entry && entry.expiry > now) this.cache.set(endpoint, entry);
      });
    } catch {
      /* unreadable cache: start empty */
    }
  }

  private schedulePersist() {
    if (typeof window === 'undefined' || isDemoMode()) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        const json = JSON.stringify(Object.fromEntries(this.cache));
        if (json.length <= MessManagementAPI.MAX_PERSISTED_CHARS) {
          localStorage.setItem(MessManagementAPI.CACHE_STORAGE_KEY, json);
        }
      } catch {
        /* quota exceeded / storage unavailable: memory cache still works */
      }
    }, 400);
  }

  /** Drops all cached GET responses (memory + saved copy). Called after every successful mutation and by Refresh. */
  clearCache() {
    this.cache.clear();
    this.inflightGets.clear();
    if (this.persistTimer) clearTimeout(this.persistTimer);
    try {
      if (typeof window !== 'undefined') localStorage.removeItem(MessManagementAPI.CACHE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  // ==================== PUBLIC REQUEST METHOD (cached) ====================
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();

    if (method !== 'GET') {
      const result = await this.requestRaw<T>(endpoint, options, retryCount);
      this.clearCache();
      return result;
    }

    const cached = this.cache.get(endpoint);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }

    const pending = this.inflightGets.get(endpoint);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = this.requestRaw<T>(endpoint, options, retryCount)
      .then((data) => {
        this.cache.set(endpoint, { data, expiry: Date.now() + MessManagementAPI.CACHE_TTL_MS });
        this.schedulePersist();
        this.inflightGets.delete(endpoint);
        return data;
      })
      .catch((err) => {
        this.inflightGets.delete(endpoint);
        throw err;
      });

    this.inflightGets.set(endpoint, promise);
    return promise;
  }

  // ==================== RAW REQUEST METHOD (no caching) ====================
  private async requestRaw<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    // Demo mode: answer from the in-memory mock backend, never touch the network
    if (isDemoMode()) {
      const { handleDemoRequest } = await import('./demo/mockBackend');
      return (await handleDemoRequest((options.method || 'GET').toUpperCase(), endpoint, options.body)) as T;
    }

    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add Authorization header if token exists
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized - try to refresh the access token once, then give up
      const isAuthEndpoint = endpoint.startsWith('/api/auth/login') || endpoint.startsWith('/api/auth/register')
        || endpoint.startsWith('/api/auth/verify-otp') || endpoint.startsWith('/api/auth/refresh-token');
      if (response.status === 401 && !isAuthEndpoint && this.accessToken) {
        if (retryCount === 0 && this.refreshToken) {
          const refreshed = await this.refreshAccessToken().catch(() => false);
          if (refreshed) {
            // Retry the request with new token
            return this.requestRaw<T>(endpoint, options, retryCount + 1);
          }
        }
        this.handleSessionExpired();
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = `API request failed: ${response.status}`;
        if (text) {
          try {
            const errorData = JSON.parse(text);
            message = errorData.message || message;
          } catch {
            message = text;
          }
        }
        throw new Error(message);
      }

      if (response.status === 204) {
        return {} as T;
      }

      // ✅ Read as text first so empty bodies (200 + no content) don't throw
      const text = await response.text();
      if (!text || text.trim() === '') {
        return {} as T;
      }

      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        // Non-JSON response — return raw text
        return text as unknown as T;
      }

      // Handle API response wrapper
      if (json && typeof json === 'object' && 'success' in json) {
        if (json.success === false) {
          throw new Error(json.message || 'API request failed');
        }
        // Unwrap only if `data` is present
        if ('data' in json) {
          return json.data as T;
        }
        return json as T;
      }

      return json as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh-token?refreshToken=${encodeURIComponent(this.refreshToken)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return false;

      const json = await response.json();
      if (json.success && json.data) {
        const { token, refreshToken } = json.data;
        this.setTokens(token, refreshToken, true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ==================== AUTHENTICATION ====================
  auth = {
    register: (data: RegisterRequest) =>
      this.request<OtpResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    verifyOtp: (data: VerifyOtpRequest) =>
      this.request<AuthResponse>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    resendOtp: (email: string, purpose: string = 'REGISTER') =>
      this.request<OtpResponse>(`/api/auth/resend-otp?email=${encodeURIComponent(email)}&purpose=${purpose}`, {
        method: 'POST',
      }),

    login: (data: LoginRequest) =>
      this.request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    forgotPassword: (data: ForgotPasswordRequest) =>
      this.request<OtpResponse>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    resetPassword: (data: ResetPasswordRequest) =>
      this.request<AuthResponse>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    refreshToken: (refreshToken: string) =>
      this.request<AuthResponse>(`/api/auth/refresh-token?refreshToken=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
      }),

    logout: () =>
      this.request<void>('/api/auth/logout', {
        method: 'POST',
      }),

    getProfile: () =>
      this.request<AuthResponse>('/api/auth/me', {
        method: 'GET',
      }),

    updateProfile: (data: UpdateProfileRequest) =>
      this.request<AuthResponse>('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    changePassword: (data: ChangePasswordRequest) =>
      this.request<void>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    /** Upload a profile picture from the local device (multipart) */
    uploadProfileImage: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<AuthResponse>('/api/auth/me/profile-image', {
        method: 'POST',
        body: formData,
      });
    },

    /** Set the profile picture from an image URL (empty string clears it) */
    setProfileImageUrl: (url: string) =>
      this.request<AuthResponse>('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ profilePictureUrl: url }),
      }),

    removeProfileImage: () =>
      this.request<AuthResponse>('/api/auth/me/profile-image', {
        method: 'DELETE',
      }),
  };

  // ==================== 1. CANDIDATE MANAGEMENT ====================
  candidate = {
    create: (data: Candidate) =>
      this.request<Candidate>('/api/candidates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getAll: () =>
      this.request<Candidate[]>('/api/candidates'),

    getActive: () =>
      this.request<Candidate[]>('/api/candidates/active'),

    getLeft: () =>
      this.request<Candidate[]>('/api/candidates/left'),

    getStats: () =>
      this.request<{ total: number; active: number; left: number }>('/api/candidates/stats'),

    getById: (id: string) =>
      this.request<Candidate>(`/api/candidates/${id}`),

    getByCandidateId: (candidateId: string) =>
      this.request<Candidate>(`/api/candidates/by-id/${candidateId}`),

    update: (id: string, data: Partial<Candidate>) =>
      this.request<Candidate>(`/api/candidates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    markLeft: (id: string, leavingDate: string) =>
      this.request<Candidate>(`/api/candidates/${id}/mark-left?leavingDate=${encodeURIComponent(leavingDate)}`, {
        method: 'PATCH',
      }),

    delete: (id: string) =>
      this.request<void>(`/api/candidates/${id}`, {
        method: 'DELETE',
      }),

    /** Upload a candidate profile picture from the local device (multipart) */
    uploadProfileImage: (id: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<Candidate>(`/api/candidates/${id}/profile-image`, {
        method: 'POST',
        body: formData,
      });
    },

    /** Set the candidate profile picture from an image URL (empty string clears it) */
    setProfileImageUrl: (id: string, url: string) =>
      this.request<Candidate>(`/api/candidates/${id}/profile-image?imageUrl=${encodeURIComponent(url)}`, {
        method: 'PATCH',
      }),

    removeProfileImage: (id: string) =>
      this.request<Candidate>(`/api/candidates/${id}/profile-image`, {
        method: 'DELETE',
      }),
  };

  // ==================== 2. ATTENDANCE MANAGEMENT ====================
  attendance = {
    mark: (data: Attendance) =>
      this.request<Attendance>('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Attendance>) =>
      this.request<Attendance>(`/api/attendance/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getById: (id: string) =>
      this.request<Attendance>(`/api/attendance/${id}`),

    getByDate: (date: string) =>
      this.request<Attendance[]>(`/api/attendance/date/${date}`),

    getByCandidate: (candidateId: string) =>
      this.request<Attendance[]>(`/api/attendance/candidate/${candidateId}`),

    getByCandidateAndDateRange: (candidateId: string, startDate: string, endDate: string) =>
      this.request<Attendance[]>(`/api/attendance/candidate/${candidateId}/range?startDate=${startDate}&endDate=${endDate}`),

    getPresent: (date: string) =>
      this.request<Candidate[]>(`/api/attendance/present/${date}`),

    getAbsent: (date: string) =>
      this.request<Candidate[]>(`/api/attendance/absent/${date}`),

    bulkMark: (data: BulkAttendance) =>
      this.request<{ success: boolean; message: string }>('/api/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request<void>(`/api/attendance/${id}`, {
        method: 'DELETE',
      }),

    getDailySummary: (date: string) =>
      this.request<{ present: number; absent: number; total: number }>(
        `/api/attendance/summary/daily?date=${date}`
      ),

    getTodayStats: () =>
      this.request<{ present: number; absent: number; total: number }>('/api/attendance/stats/today'),

    getMonthlySummary: (candidateId: string, month: number, year: number) =>
      this.request<{ present: number; absent: number; total: number }>(
        `/api/attendance/monthly-summary?candidateId=${candidateId}&month=${month}&year=${year}`
      ),

    autoMarkAbsent: () =>
      this.request<{ success: boolean; message: string }>('/api/attendance/auto-mark-absent', {
        method: 'POST',
      }),
  };

  // ==================== 3. MEAL MANAGEMENT ====================
  meal = {
    mark: (data: Meal) =>
      this.request<Meal>('/api/meals/mark', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Meal>) =>
      this.request<Meal>(`/api/meals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getById: (id: string) =>
      this.request<Meal>(`/api/meals/${id}`),

    getByDate: (date: string) =>
      this.request<Meal[]>(`/api/meals/date/${date}`),

    getByCandidate: (candidateId: string) =>
      this.request<Meal[]>(`/api/meals/candidate/${candidateId}`),

    getByCandidateAndDate: (candidateId: string, date: string) =>
      this.request<Meal[]>(`/api/meals/candidate/${candidateId}/date/${date}`),

    getByCandidateAndDateRange: (candidateId: string, startDate: string, endDate: string) =>
      this.request<Meal[]>(`/api/meals/candidate/${candidateId}/range?startDate=${startDate}&endDate=${endDate}`),

    getByTypeAndDate: (mealType: string, date: string) =>
      this.request<Meal[]>(`/api/meals/type/${mealType}/date/${date}`),

    bulkMark: (data: BulkMeal) =>
      this.request<{ success: boolean; message: string }>('/api/meals/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request<void>(`/api/meals/${id}`, {
        method: 'DELETE',
      }),

    getDailySummary: (date: string) =>
      this.request<{ total: number; taken: number; notTaken: number }>(
        `/api/meals/summary/daily?date=${date}`
      ),

    getTodayStats: () =>
      this.request<{ total: number; taken: number; notTaken: number }>('/api/meals/stats/today'),

    getCandidateSummary: (candidateId: string, month: number, year: number) =>
      this.request<{ total: number; taken: number; notTaken: number }>(
        `/api/meals/candidate-summary?candidateId=${candidateId}&month=${month}&year=${year}`
      ),

    getMissed: (date: string, mealType: string) =>
      this.request<Candidate[]>(`/api/meals/missed?date=${date}&mealType=${mealType}`),
  };

  // ==================== 4. EXPENSE MANAGEMENT ====================
  expense = {
    create: (data: Expense) =>
      this.request<Expense>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Expense>) =>
      this.request<Expense>(`/api/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    uploadAttachment: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<{ fileUrl: string; fileName: string }>('/api/expenses/upload', {
        method: 'POST',
        body: formData,
      });
    },

    getAll: () =>
      this.request<Expense[]>('/api/expenses/range?startDate=2000-01-01&endDate=2099-12-31').catch(() => []),

    getById: (id: string) =>
      this.request<Expense>(`/api/expenses/${id}`),

    getByDate: (date: string) =>
      this.request<Expense[]>(`/api/expenses/date/${date}`),

    getByDateRange: (startDate: string, endDate: string) =>
      this.request<Expense[]>(`/api/expenses/range?startDate=${startDate}&endDate=${endDate}`),

    getByCategory: (category: string) =>
      this.request<Expense[]>(`/api/expenses/category/${encodeURIComponent(category)}`),

    getByCategoryAndDateRange: (category: string, startDate: string, endDate: string) =>
      this.request<Expense[]>(`/api/expenses/category/${encodeURIComponent(category)}/range?startDate=${startDate}&endDate=${endDate}`),

    delete: (id: string) =>
      this.request<void>(`/api/expenses/${id}`, {
        method: 'DELETE',
      }),

    getTotal: (startDate: string = '', endDate: string = '') => {
      const start = startDate || '2000-01-01';
      const end = endDate || '2099-12-31';
      return this.request<{ total: number }>(`/api/expenses/total?startDate=${start}&endDate=${end}`).catch(() => ({ total: 0 }));
    },

    getTodayTotal: () =>
      this.request<{ total: number }>('/api/expenses/total/today').catch(() => ({ total: 0 })),

    getSummary: (startDate: string = '', endDate: string = '') => {
      const start = startDate || '2000-01-01';
      const end = endDate || '2099-12-31';
      return this.request<{ total: number; count: number; categories: Record<string, number> }>(
        `/api/expenses/summary?startDate=${start}&endDate=${end}`
      ).catch(() => ({ total: 0, count: 0, categories: {} }));
    },

    getCategoryWise: (startDate: string, endDate: string) =>
      this.request<Record<string, number>>(`/api/expenses/category-wise?startDate=${startDate}&endDate=${endDate}`),

    getMonthly: (year: number) =>
      this.request<Array<{ month: number; total: number }>>(`/api/expenses/monthly?year=${year}`),

    getDailyForMonth: (month: number, year: number) =>
      this.request<Array<{ day: number; total: number }>>(`/api/expenses/daily/${month}/${year}`),
  };

  // ==================== 8b. DEPARTMENT MANAGEMENT (NEW) ====================
  department = {
    create: (data: Partial<Department>) =>
      this.request<Department>('/api/departments/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Department>) =>
      this.request<Department>(`/api/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getById: (id: string) =>
      this.request<Department>(`/api/departments/${id}`),

    getByCode: (code: string) =>
      this.request<Department>(`/api/departments/code/${encodeURIComponent(code)}`),

    getAll: () =>
      this.request<Department[]>('/api/departments/').catch(() => []),

    getActive: () =>
      this.request<Department[]>('/api/departments/active').catch(() => []),

    toggle: (id: string) =>
      this.request<Department>(`/api/departments/${id}/toggle`, {
        method: 'PATCH',
      }),

    delete: (id: string) =>
      this.request<void>(`/api/departments/${id}`, {
        method: 'DELETE',
      }),
  };
  // ==================== 5. STOCK MANAGEMENT ====================
  stock = {
    item: {
      create: (data: StockItem) =>
        this.request<StockItem>('/api/stock/items', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      createWithImages: (formData: FormData) =>
        this.request<StockItem>('/api/stock/items/with-images', {
          method: 'POST',
          body: formData,
        }),

      update: (id: string, data: Partial<StockItem>) =>
        this.request<StockItem>(`/api/stock/items/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

      updateWithImages: (id: string, formData: FormData) =>
        this.request<StockItem>(`/api/stock/items/${id}/with-images`, {
          method: 'PUT',
          body: formData,
        }),

      getById: (id: string) =>
        this.request<StockItem>(`/api/stock/items/${id}`),

      getByName: (name: string) =>
        this.request<StockItem>(`/api/stock/items/name/${encodeURIComponent(name)}`),

      getAll: () =>
        this.request<StockItem[]>('/api/stock/items'),

      getActive: () =>
        this.request<StockItem[]>('/api/stock/items/active'),

      getByCategory: (category: string) =>
        this.request<StockItem[]>(`/api/stock/items/category/${encodeURIComponent(category)}`),

      getLowStock: () =>
        this.request<StockItem[]>('/api/stock/items/low-stock'),

      getOverStock: () =>
        this.request<StockItem[]>('/api/stock/items/over-stock'),

      delete: (id: string) =>
        this.request<void>(`/api/stock/items/${id}`, {
          method: 'DELETE',
        }),

      toggleStatus: (id: string) =>
        this.request<StockItem>(`/api/stock/items/${id}/toggle`, {
          method: 'PATCH',
        }),

      updateStock: (id: string, newStock: number) =>
        this.request<StockItem>(`/api/stock/items/${id}/stock?newStock=${newStock}`, {
          method: 'PATCH',
        }),

      addStock: (id: string, quantity: number, reference?: string, remarks?: string) =>
        this.request<StockItem>(
          `/api/stock/items/${id}/add?quantity=${quantity}${reference ? `&reference=${encodeURIComponent(reference)}` : ''}${remarks ? `&remarks=${encodeURIComponent(remarks)}` : ''}`,
          { method: 'PATCH' }
        ),

      deductStock: (id: string, quantity: number, reference?: string, remarks?: string) =>
        this.request<StockItem>(
          `/api/stock/items/${id}/deduct?quantity=${quantity}${reference ? `&reference=${encodeURIComponent(reference)}` : ''}${remarks ? `&remarks=${encodeURIComponent(remarks)}` : ''}`,
          { method: 'PATCH' }
        ),

      uploadImages: (id: string, formData: FormData) =>
        this.request<{ images: string[] }>(`/api/stock/items/${id}/images`, {
          method: 'POST',
          body: formData,
        }),

      setPrimaryImage: (id: string, imageUrl: string) =>
        this.request<StockItem>(`/api/stock/items/${id}/primary-image?imageUrl=${encodeURIComponent(imageUrl)}`, {
          method: 'PATCH',
        }),

      removeImage: (id: string, imageUrl: string) =>
        this.request<void>(`/api/stock/items/${id}/images?imageUrl=${encodeURIComponent(imageUrl)}`, {
          method: 'DELETE',
        }),
    },

    transaction: {
      getAll: () =>
        this.request<StockTransaction[]>('/api/stock/transactions/range?startDate=2000-01-01&endDate=2099-12-31').catch(() => []),

      create: (data: StockTransaction) =>
        this.request<StockTransaction>('/api/stock/transactions', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      getById: (id: string) =>
        this.request<StockTransaction>(`/api/stock/transactions/${id}`),

      getByStockItem: (stockItemId: string) =>
        this.request<StockTransaction[]>(`/api/stock/transactions/item/${stockItemId}`),

      getByDateRange: (startDate: string, endDate: string) =>
        this.request<StockTransaction[]>(`/api/stock/transactions/range?startDate=${startDate}&endDate=${endDate}`),

      getByType: (type: string) =>
        this.request<StockTransaction[]>(`/api/stock/transactions/type/${type}`),
    },

    getSummary: () =>
      this.request<{ totalItems: number; totalValue: number; lowStockItems: number; categories: string[] }>('/api/stock/summary'),

    getSummaryByCategory: (category: string) =>
      this.request<{ totalItems: number; totalValue: number; items: StockItem[] }>(`/api/stock/summary/category/${encodeURIComponent(category)}`),

    getTotalValue: () =>
      this.request<{ totalValue: number }>('/api/stock/total-value'),

    getHistory: (stockItemId: string, startDate: string, endDate: string) =>
      this.request<Array<{ date: string; stock: number; transaction: StockTransaction }>>(
        `/api/stock/history/${stockItemId}?startDate=${startDate}&endDate=${endDate}`
      ),

    checkLowStockAlerts: () =>
      this.request<{ alerts: Array<{ item: StockItem; currentStock: number; minLevel: number }> }>('/api/stock/alerts/check', {
        method: 'POST',
      }),
  };

  // ==================== 6. STAFF MANAGEMENT ====================
  staff = {
    profile: {
      getAll: () => this.request<Staff[]>('/api/staff/'),
      getActive: () => this.request<Staff[]>('/api/staff/active'),
      getById: (id: string) => this.request<Staff>(`/api/staff/${id}`),
      create: (data: Staff) =>
        this.request<Staff>('/api/staff/', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: Partial<Staff>) =>
        this.request<Staff>(`/api/staff/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        this.request<void>(`/api/staff/${id}`, {
          method: 'DELETE',
        }),
    },

    create: (data: Staff) =>
      this.request<Staff>('/api/staff/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    createWithImages: (formData: FormData) =>
      this.request<Staff>('/api/staff/with-images', {
        method: 'POST',
        body: formData,
      }),

    update: (id: string, data: Partial<Staff>) =>
      this.request<Staff>(`/api/staff/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    updateWithImages: (id: string, formData: FormData) =>
      this.request<Staff>(`/api/staff/${id}/with-images`, {
        method: 'PUT',
        body: formData,
      }),

    getById: (id: string) =>
      this.request<Staff>(`/api/staff/${id}`),

    getByStaffId: (staffId: string) =>
      this.request<Staff>(`/api/staff/staff-id/${staffId}`),

    getAll: () =>
      this.request<Staff[]>('/api/staff/'),

    getActive: () =>
      this.request<Staff[]>('/api/staff/active'),

    getByPosition: (position: string) =>
      this.request<Staff[]>(`/api/staff/position/${encodeURIComponent(position)}`),

    delete: (id: string) =>
      this.request<void>(`/api/staff/${id}`, {
        method: 'DELETE',
      }),

    toggleStatus: (id: string) =>
      this.request<Staff>(`/api/staff/${id}/toggle`, {
        method: 'PATCH',
      }),

    generateId: () =>
      this.request<{ staffId: string }>('/api/staff/generate-id'),

    /** Upload staff images (multipart field "images"); setAsPrimary makes the upload the profile picture */
    uploadImages: (id: string, formData: FormData, setAsPrimary: boolean = false) =>
      this.request<Staff>(`/api/staff/${id}/images${setAsPrimary ? '?setAsPrimary=true' : ''}`, {
        method: 'POST',
        body: formData,
      }),

    setPrimaryImage: (id: string, imageUrl: string) =>
      this.request<Staff>(`/api/staff/${id}/primary-image?imageUrl=${encodeURIComponent(imageUrl)}`, {
        method: 'PATCH',
      }),

    removeImage: (id: string, imageUrl: string) =>
      this.request<Staff>(`/api/staff/${id}/images?imageUrl=${encodeURIComponent(imageUrl)}`, {
        method: 'DELETE',
      }),

    payment: {
      getAll: () =>
        this.request<StaffPayment[]>('/api/staff/payments/range?startDate=2000-01-01&endDate=2099-12-31').catch(() => []),

      create: (data: StaffPayment) =>
        this.request<StaffPayment>('/api/staff/payments', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      getById: (id: string) =>
        this.request<StaffPayment>(`/api/staff/payments/${id}`),

      getByStaff: (staffId: string) =>
        this.request<StaffPayment[]>(`/api/staff/payments/staff/${staffId}`),

      getByStaffAndYear: (staffId: string, year: number) =>
        this.request<StaffPayment[]>(`/api/staff/payments/staff/${staffId}/year/${year}`),

      getByDateRange: (startDate: string, endDate: string) =>
        this.request<StaffPayment[]>(`/api/staff/payments/range?startDate=${startDate}&endDate=${endDate}`),

      getTotal: (startDate: string, endDate: string) =>
        this.request<{ total: number }>(`/api/staff/payments/total?startDate=${startDate}&endDate=${endDate}`),

      delete: (id: string) =>
        this.request<void>(`/api/staff/payments/${id}`, {
          method: 'DELETE',
        }),
    },

    advance: {
      getAll: () =>
        this.request<StaffAdvance[]>('/api/staff/advances').catch(() => []),

      create: (data: StaffAdvance) =>
        this.request<StaffAdvance>('/api/staff/advances', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      update: (id: string, data: Partial<StaffAdvance>) =>
        this.request<StaffAdvance>(`/api/staff/advances/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

      getById: (id: string) =>
        this.request<StaffAdvance>(`/api/staff/advances/${id}`),

      getByStaff: (staffId: string) =>
        this.request<StaffAdvance[]>(`/api/staff/advances/staff/${staffId}`),

      getPending: () =>
        this.request<StaffAdvance[]>('/api/staff/advances/pending'),

      approve: (id: string, approvedByCandidateId: string) =>
        this.request<StaffAdvance>(`/api/staff/advances/${id}/approve?approvedByCandidateId=${encodeURIComponent(approvedByCandidateId)}`, {
          method: 'PATCH',
        }),

      reject: (id: string) =>
        this.request<StaffAdvance>(`/api/staff/advances/${id}/reject`, {
          method: 'PATCH',
        }),

      // In api.ts - Update the repay method to use query parameter
      repay: (id: string, repaymentAmount: number) =>
        this.request<StaffAdvance>(`/api/staff/advances/${id}/repay?repaymentAmount=${repaymentAmount}`, {
          method: 'PATCH',
        }),
      getOutstanding: (staffId: string) =>
        this.request<{ totalOutstanding: number; advances: StaffAdvance[] }>(
          `/api/staff/advances/outstanding/${staffId}`
        ),

      delete: (id: string) =>
        this.request<void>(`/api/staff/advances/${id}`, {
          method: 'DELETE',
        }),
    },

    /** Per active staff member salary summary (base salary, total paid, outstanding advance) */
    getSalarySummary: () =>
      this.request<StaffSalarySummary[]>('/api/staff/summary'),

    getSalarySummaryById: (staffId: string) =>
      this.request<{ staff: Staff; totalPaid: number; outstandingAdvances: number; lastPayment?: StaffPayment }>(
        `/api/staff/summary/${staffId}`
      ),

    getMonthlyReport: (month: number, year: number) =>
      this.request<{ totalSalary: number; totalBonus: number; totalDeductions: number; netPayable: number }>(
        `/api/staff/report/monthly?month=${month}&year=${year}`
      ),

    getYearlyReport: (year: number) =>
      this.request<Array<{ month: number; totalPaid: number }>>(`/api/staff/report/yearly?year=${year}`),
  };

  // ==================== 7. BILLING & FEE COLLECTION ====================
  billing = {
    fee: {
      collect: (data: FeeCollection) =>
        this.request<FeeCollection>('/api/billing/fees', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      bulkCollect: (data: BulkFeeCollection) =>
        this.request<{ success: boolean; message: string; fees: FeeCollection[] }>('/api/billing/fees/bulk', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      getById: (id: string) =>
        this.request<FeeCollection>(`/api/billing/fees/${id}`),

      getByCandidate: (candidateId: string) =>
        this.request<FeeCollection[]>(`/api/billing/fees/candidate/${candidateId}`),

      getByMonth: (month: number, year: number) =>
        this.request<FeeCollection[]>(`/api/billing/fees/month?month=${month}&year=${year}`),

      getSummary: (month: number, year: number) =>
        this.request<{
          month: number;
          year: number;
          monthName: string;
          totalCandidates: number;
          paidCandidates: number;
          pendingCandidates: number;
          totalExpectedFees: number;
          totalCollectedFees: number;
          pendingAmount: number;
          collectionPercentage: number;
          candidateFees: Array<{
            candidateId: string;
            candidateName: string;
            monthlyRate: number;
            paidAmount: number;
            pendingAmount: number;
            isPaid: boolean;
            paymentDate?: string;
          }>;
        }>(`/api/billing/fees/summary?month=${month}&year=${year}`),

      delete: (id: string) =>
        this.request<void>(`/api/billing/fees/${id}`, {
          method: 'DELETE',
        }),
    },

    generateMonthly: (month: number, year: number) =>
      this.request<{ success: boolean; message: string; billings: Array<{ candidateId: string; amount: number }> }>(
        `/api/billing/generate?month=${month}&year=${year}`, { method: 'POST' }
      ),

    getMonthly: (month: number, year: number) =>
      this.request<{
        totalIncome: number;
        totalExpenses: number;
        totalStaffSalary: number;
        netProfit: number;
        details: {
          feeCollection: { total: number; count: number; candidates: FeeCollection[] };
          expenses: { total: number; count: number; details: Expense[] };
          staffSalary: { total: number; count: number; payments: StaffPayment[] };
          partyRevenue: { total: number; count: number; parties: Party[] };
        };
      }>(`/api/billing/monthly?month=${month}&year=${year}`),

    getYearly: (year: number) =>
      this.request<Array<{ month: number; income: number; expenses: number; staffSalary: number; profit: number }>>(
        `/api/billing/yearly/${year}`
      ),

    getYearlyReport: (year: number) =>
      this.request<{
        yearlyData: Array<{ month: number; income: number; expenses: number; staffSalary: number; profit: number }>;
        totalIncome: number;
        totalExpenses: number;
        totalStaffSalary: number;
        totalProfit: number;
      }>(`/api/billing/report/yearly/${year}`),

    getDashboard: () =>
      this.request<{
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
      }>('/api/billing/dashboard'),

    /**
     * Live dashboard summary boxes. scope = MONTH (month + year), YEAR (year) or ALL.
     * Every figure is computed by the backend from the database.
     */
    getSummary: (scope: BillingScope = 'MONTH', month?: number, year?: number) => {
      const params = new URLSearchParams({ scope });
      if (scope === 'MONTH' && month) params.append('month', String(month));
      if (scope !== 'ALL' && year) params.append('year', String(year));
      return this.request<BillingSummary>(`/api/billing/summary?${params.toString()}`);
    },

    /** Live monthly profit & loss (revenue vs expenses per month) for a year */
    getProfitLossChart: (year: number) =>
      this.request<MonthlyProfitLoss>(`/api/billing/profit-loss-chart?year=${year}`),

    getIncomeExpenseComparison: (year: number) =>
      this.request<{
        months: number[];
        income: number[];
        expenses: number[];
        staffSalary: number[];
        profit: number[];
      }>(`/api/billing/income-expense-comparison?year=${year}`),

    getCurrentMonthProfit: () =>
      this.request<{ profit: number; income: number; expenses: number; staffSalary: number }>(
        '/api/billing/current-month-profit'
      ),

    getCurrentYearProfit: () =>
      this.request<{ profit: number; income: number; expenses: number; staffSalary: number }>(
        '/api/billing/current-year-profit'
      ),

    generateAllMonthly: () =>
      this.request<{ success: boolean; message: string; generated: number }>('/api/billing/generate-all', {
        method: 'POST',
      }),
  };

  // ==================== 8. PARTY MANAGEMENT ====================
  party = {
    create: (data: Party) =>
      this.request<Party>('/api/parties/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Party>) =>
      this.request<Party>(`/api/parties/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getById: (id: string) =>
      this.request<Party>(`/api/parties/${id}`),

    getByPartyId: (partyId: string) =>
      this.request<Party>(`/api/parties/party-id/${partyId}`),

    getAll: () =>
      this.request<Party[]>('/api/parties/').catch(() => []),

    getByDate: (date: string) =>
      this.request<Party[]>(`/api/parties/date/${date}`),

    getByDateRange: (startDate: string, endDate: string) =>
      this.request<Party[]>(`/api/parties/range?startDate=${startDate}&endDate=${endDate}`),

    getByPaymentStatus: (status: string) =>
      this.request<Party[]>(`/api/parties/payment-status/${status}`),

    getByDepartment: (departmentCode: string) =>
      this.request<Party[]>(`/api/parties/department/${encodeURIComponent(departmentCode)}`),

    delete: (id: string) =>
      this.request<void>(`/api/parties/${id}`, {
        method: 'DELETE',
      }),

    makePayment: (data: PartyPayment) =>
      this.request<PartyPayment>('/api/parties/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    markPaid: (id: string) =>
      this.request<Party>(`/api/parties/${id}/mark-paid`, {
        method: 'PATCH',
      }),

    updatePaymentStatus: (id: string, status: string) =>
      this.request<Party>(`/api/parties/${id}/payment-status?status=${status}`, {
        method: 'PATCH',
      }),

    getSummary: (startDate: string = '', endDate: string = '') => {
      const start = startDate || '2000-01-01';
      const end = endDate || '2099-12-31';
      return this.request<{ totalParties: number; totalRevenue: number; totalPaid: number; totalOutstanding: number }>(
        `/api/parties/summary?startDate=${start}&endDate=${end}`
      ).catch(() => ({ totalParties: 0, totalRevenue: 0, totalPaid: 0, totalOutstanding: 0 }));
    },

    getTotalBilling: (startDate: string, endDate: string) =>
      this.request<{ total: number }>(`/api/parties/total-billing?startDate=${startDate}&endDate=${endDate}`),

    getOutstanding: () =>
      this.request<{ totalOutstanding: number; parties: Party[] }>('/api/parties/outstanding'),

    getMonthlyBilling: (year: number) =>
      this.request<Array<{ month: number; total: number; count: number }>>(`/api/parties/monthly-billing?year=${year}`),

    getRevenueReport: (year: number) =>
      this.request<{ totalRevenue: number; monthlyData: Array<{ month: number; revenue: number; count: number }> }>(
        `/api/parties/revenue-report?year=${year}`
      ),

    generateId: () =>
      this.request<{ partyId: string }>('/api/parties/generate-id'),

    generateInvoice: () =>
      this.request<{ invoiceNumber: string }>('/api/parties/generate-invoice'),
  };

  // ==================== 9. MENU MANAGEMENT ====================
  menu = {
    create: (data: Menu) =>
      this.request<Menu>('/api/menus/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Menu>) =>
      this.request<Menu>(`/api/menus/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getById: (id: string) =>
      this.request<Menu>(`/api/menus/${id}`),

    getByDateAndMealType: (date: string, mealType: string) =>
      this.request<Menu>(`/api/menus/date/${date}/meal/${mealType}`),

    getByDate: (date: string) =>
      this.request<Menu[]>(`/api/menus/date/${date}`),

    getByDateRange: (startDate: string, endDate: string) =>
      this.request<Menu[]>(`/api/menus/range?startDate=${startDate}&endDate=${endDate}`),

    getAll: () =>
      this.request<Menu[]>('/api/menus/today').catch(() => []),

    getToday: () =>
      this.request<Menu[]>('/api/menus/today'),

    getWeekly: (startDate: string) =>
      this.request<Menu[]>(`/api/menus/weekly?startDate=${startDate}`),

    getMonthly: (month: number, year: number) =>
      this.request<Menu[]>(`/api/menus/monthly?month=${month}&year=${year}`),

    delete: (id: string) =>
      this.request<void>(`/api/menus/${id}`, {
        method: 'DELETE',
      }),

    toggleStatus: (id: string) =>
      this.request<Menu>(`/api/menus/${id}/toggle`, {
        method: 'PATCH',
      }),

    item: {
      add: (menuId: string, data: MenuItem) =>
        this.request<MenuItem>(`/api/menus/${menuId}/items`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      update: (menuId: string, itemId: string, data: Partial<MenuItem>) =>
        this.request<MenuItem>(`/api/menus/${menuId}/items/${itemId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

      remove: (menuId: string, itemId: string) =>
        this.request<void>(`/api/menus/${menuId}/items/${itemId}`, {
          method: 'DELETE',
        }),

      updateAvailability: (menuId: string, itemId: string, available: boolean) =>
        this.request<MenuItem>(
          `/api/menus/${menuId}/items/${itemId}/availability?available=${available}`,
          { method: 'PATCH' }
        ),
    },

    getSummary: (startDate: string, endDate: string) =>
      this.request<{ totalMenus: number; totalItems: number; categories: Record<string, number> }>(
        `/api/menus/summary?startDate=${startDate}&endDate=${endDate}`
      ),

    getPopularItems: (startDate: string, endDate: string) =>
      this.request<Array<{ itemName: string; count: number; category: string }>>(
        `/api/menus/popular-items?startDate=${startDate}&endDate=${endDate}`
      ),

    getWeeklyPlan: (startDate: string) =>
      this.request<Array<{ day: string; meals: Menu[] }>>(`/api/menus/weekly-plan?startDate=${startDate}`),

    copy: (sourceMenuId: string, targetDate: string, mealType: string = 'LUNCH') =>
      this.request<Menu>(`/api/menus/copy?sourceMenuId=${sourceMenuId}&targetDate=${targetDate}&mealType=${mealType}`, {
        method: 'POST',
      }),

    copyWeekly: (sourceWeekStart: string, targetWeekStart: string) =>
      this.request<{ success: boolean; message: string; copied: number }>(
        `/api/menus/copy-weekly?sourceWeekStart=${sourceWeekStart}&targetWeekStart=${targetWeekStart}`,
        { method: 'POST' }
      ),
  };

  // ==================== 10. REPORTS ====================
  report = {
    generate: (data: ReportRequest) =>
      this.request<{ success: boolean; message: string; reportUrl?: string }>('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getMonthly: (month: number, year: number) =>
      this.request<{
        candidates: { total: number; active: number; left: number };
        attendance: { present: number; absent: number; total: number };
        meals: { total: number; taken: number; notTaken: number };
        expenses: { total: number; count: number };
        feeCollection: { total: number; count: number };
        partyRevenue: { total: number; count: number };
        staffSalary: { total: number; count: number };
        profit: number;
      }>(`/api/reports/monthly?month=${month}&year=${year}`),

    getYearly: (year: number) =>
      this.request<{
        monthlyData: Array<{
          month: number;
          income: number;
          expenses: number;
          staffSalary: number;
          profit: number;
        }>;
        totalIncome: number;
        totalExpenses: number;
        totalStaffSalary: number;
        totalProfit: number;
      }>(`/api/reports/yearly?year=${year}`),

    getCustom: (startDate: string, endDate: string) =>
      this.request<{
        candidates: { total: number; active: number; left: number };
        attendance: { present: number; absent: number; total: number };
        meals: { total: number; taken: number; notTaken: number };
        expenses: { total: number; count: number };
        feeCollection: { total: number; count: number };
        partyRevenue: { total: number; count: number };
        staffSalary: { total: number; count: number };
        profit: number;
      }>(`/api/reports/custom?startDate=${startDate}&endDate=${endDate}`),

    getCandidate: (startDate: string, endDate: string) =>
      this.request<{
        candidates: Candidate[];
        attendance: Record<string, number>;
        meals: Record<string, number>;
        feeHistory: FeeCollection[];
      }>(`/api/reports/candidate?startDate=${startDate}&endDate=${endDate}`),

    getAttendance: (startDate: string, endDate: string) =>
      this.request<{
        summary: { present: number; absent: number; total: number };
        dailyData: Array<{ date: string; present: number; absent: number }>;
        candidateWise: Array<{ candidate: Candidate; present: number; absent: number }>;
      }>(`/api/reports/attendance?startDate=${startDate}&endDate=${endDate}`),

    getExpense: (startDate: string, endDate: string) =>
      this.request<{
        total: number;
        count: number;
        categoryWise: Record<string, number>;
        dailyData: Array<{ date: string; total: number }>;
        expenses: Expense[];
      }>(`/api/reports/expense?startDate=${startDate}&endDate=${endDate}`),

    getStock: () =>
      this.request<{
        totalItems: number;
        totalValue: number;
        lowStockItems: StockItem[];
        categoryWise: Record<string, { count: number; value: number }>;
        items: StockItem[];
      }>('/api/reports/stock'),

    getStaff: (startDate: string, endDate: string) =>
      this.request<{
        totalStaff: number;
        totalSalary: number;
        positionWise: Record<string, { count: number; totalSalary: number }>;
        payments: StaffPayment[];
        advances: StaffAdvance[];
      }>(`/api/reports/staff?startDate=${startDate}&endDate=${endDate}`),

    getBilling: (month: number, year: number) =>
      this.request<{
        feeCollection: { total: number; count: number; candidates: FeeCollection[] };
        partyRevenue: { total: number; count: number; parties: Party[] };
        totalIncome: number;
      }>(`/api/reports/billing?month=${month}&year=${year}`),

    getParty: (startDate: string, endDate: string) =>
      this.request<{
        totalParties: number;
        totalRevenue: number;
        totalPaid: number;
        totalOutstanding: number;
        parties: Party[];
        dailyData: Array<{ date: string; count: number; revenue: number }>;
      }>(`/api/reports/party?startDate=${startDate}&endDate=${endDate}`),

    getMenu: (startDate: string, endDate: string) =>
      this.request<{
        totalMenus: number;
        totalItems: number;
        popularItems: Array<{ itemName: string; count: number }>;
        categoryWise: Record<string, number>;
        menus: Menu[];
      }>(`/api/reports/menu?startDate=${startDate}&endDate=${endDate}`),

    getProfitLoss: (year: number) =>
      this.request<{
        yearlySummary: {
          totalIncome: number;
          totalExpenses: number;
          totalStaffSalary: number;
          totalProfit: number;
        };
        monthlyData: Array<{
          month: number;
          income: number;
          expenses: number;
          staffSalary: number;
          profit: number;
        }>;
      }>(`/api/reports/profit-loss?year=${year}`),

    exportPDF: (data: ReportRequest) =>
      this.request<{ success: boolean; message: string; downloadUrl?: string }>('/api/reports/export/pdf', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    exportExcel: (data: ReportRequest) =>
      this.request<{ success: boolean; message: string; downloadUrl?: string }>('/api/reports/export/excel', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    exportCSV: (data: ReportRequest) =>
      this.request<{ success: boolean; message: string; downloadUrl?: string }>('/api/reports/export/csv', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // ==================== 12. COLLEGE BILLING ====================
  collegeBilling = {
    getAll: (params?: { college?: string; month?: number; year?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.college) queryParams.append('college', params.college);
      if (params?.month) queryParams.append('month', params.month.toString());
      if (params?.year) queryParams.append('year', params.year.toString());
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      return this.request<CollegeBilling[]>(`/api/college-billing${qs}`).catch(() => []);
    },

    getById: (id: string) =>
      this.request<CollegeBilling>(`/api/college-billing/${id}`),

    create: (data: CollegeBillingRequest) =>
      this.request<CollegeBilling>('/api/college-billing', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: CollegeBillingRequest) =>
      this.request<CollegeBilling>(`/api/college-billing/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request<void>(`/api/college-billing/${id}`, {
        method: 'DELETE',
      }),

    getSummary: (params?: { college?: string; month?: number; year?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.college) queryParams.append('college', params.college);
      if (params?.month) queryParams.append('month', params.month.toString());
      if (params?.year) queryParams.append('year', params.year.toString());
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      return this.request<CollegeBillingSummary>(`/api/college-billing/summary${qs}`).catch(() => ({
        totalBillableAmount: 0,
        totalAmountReceived: 0,
        totalOutstandingBalance: 0,
        totalRecords: 0,
        paidCount: 0,
        partiallyPaidCount: 0,
        unpaidCount: 0,
      }));
    },

    getColleges: () =>
      this.request<string[]>('/api/college-billing/colleges').catch(() => []),
  };
}

// Create singleton instance
export const api = new MessManagementAPI(BASE_URL);
export default api;