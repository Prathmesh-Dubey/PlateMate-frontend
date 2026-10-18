// src/demo/mockBackend.ts
// In-memory mock of the PlateMate REST API used by demo mode. src/api.ts forwards every request here
// (instead of fetch) while demo mode is on. Nothing is persisted: the "database" below lives in module
// memory only, so a page reload wipes every change the visitor made.
//
// handleDemoRequest(method, endpoint, body) resolves with the plain data (already unwrapped from the
// {success, data} envelope) or throws Error(message) to simulate a failed request.
import { DEMO_USER } from './demoMode';
import {
  MONTH_NAMES, addDays, addMonthsISO, buildSeed, isoDate, todayISO,
  type Row,
} from './seed';

// ====================================================================== database
const db = buildSeed();

// ====================================================================== generic helpers
const clone = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, '0');
const nowIso = () => new Date().toISOString();

const newId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const h = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${h(8)}-${h(4)}-4${h(3)}-a${h(3)}-${h(12)}`;
};

const num = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const money = (n: number): number => Math.round(n * 100) / 100;
const sum = <T,>(list: T[], fn: (x: T) => number): number => list.reduce((s, x) => s + fn(x), 0);
const day10 = (d?: string | null): string => (d ? String(d).slice(0, 10) : '');
const inRange = (d: string | undefined, start: string, end: string): boolean => {
  const x = day10(d);
  return !!x && x >= start && x <= end;
};
const ymKey = (y: number, m: number) => y * 12 + m;
const ymOfDate = (d?: string): { y: number; m: number } => ({ y: Number(day10(d).slice(0, 4)), m: Number(day10(d).slice(5, 7)) });
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate();
const defined = (o: Row): Row => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const fail = (message: string): never => { throw new Error(message); };
const lc = (s: unknown) => String(s ?? '').trim().toLowerCase();

const nextCode = (prefix: string, rows: Row[], field: string, width: number): string => {
  let max = 0;
  rows.forEach((r) => {
    const m = String(r[field] || '').match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
};

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#e2e8f0"/>' +
    '<circle cx="120" cy="92" r="40" fill="#94a3b8"/><rect x="50" y="146" width="140" height="70" rx="35" fill="#94a3b8"/></svg>',
  );

/** Turns an uploaded File/Blob into a URL the <img> tag can load (object URL, never sent anywhere). */
const fileToUrl = (f: unknown): string => {
  try {
    if (typeof Blob !== 'undefined' && f instanceof Blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(f);
    }
  } catch { /* fall through */ }
  return PLACEHOLDER_IMAGE;
};

const isFormData = (b: unknown): b is FormData => typeof FormData !== 'undefined' && b instanceof FormData;
const formFiles = (fd: FormData | undefined, ...fields: string[]): File[] => {
  if (!fd) return [];
  const out: File[] = [];
  const names = fields.length ? fields : Array.from(new Set(Array.from(fd.keys())));
  names.forEach((n) => fd.getAll(n).forEach((v) => { if (typeof v !== 'string') out.push(v as File); }));
  return out;
};
const formToObject = (fd: FormData | undefined): Row => {
  if (!fd) return {};
  for (const key of ['stockItem', 'item', 'staff', 'data', 'payload']) {
    const v = fd.get(key);
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { /* ignore */ }
    }
  }
  const out: Row = {};
  fd.forEach((v, k) => {
    if (typeof v !== 'string') return;
    if (v !== '' && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) out[k] = Number(v);
    else if (v === 'true' || v === 'false') out[k] = v === 'true';
    else out[k] = v;
  });
  return out;
};

// ====================================================================== router
interface Ctx {
  method: string;
  p: Record<string, string>;   // path params
  q: URLSearchParams;          // query string
  body: Row;                   // parsed JSON body ({} when none)
  form?: FormData;             // multipart body, if any
}
type Handler = (c: Ctx) => unknown;
const routes: Array<{ method: string; re: RegExp; keys: string[]; h: Handler }> = [];

/** Registers `METHOD /pattern/:param`. Trailing slashes are optional; first match wins, so list fixed paths before `/:id`. */
const route = (method: string, pattern: string, h: Handler) => {
  const keys: string[] = [];
  const src = pattern.replace(/\/$/, '').replace(/:([A-Za-z]+)/g, (_m, k: string) => { keys.push(k); return '([^/]+)'; });
  routes.push({ method, re: new RegExp(`^${src}/?$`), keys, h });
};
const get = (p: string, h: Handler) => route('GET', p, h);
const post = (p: string, h: Handler) => route('POST', p, h);
const put = (p: string, h: Handler) => route('PUT', p, h);
const patch = (p: string, h: Handler) => route('PATCH', p, h);
const del = (p: string, h: Handler) => route('DELETE', p, h);

// ====================================================================== AUTH
const profile: Row = {
  id: DEMO_USER.id,
  fullName: DEMO_USER.fullName,
  email: DEMO_USER.email,
  phoneNumber: DEMO_USER.phoneNumber,
  role: DEMO_USER.role,
  emailVerified: true,
  phoneVerified: true,
  enabled: true,
  profilePictureUrl: undefined,
  createdAt: `${addMonthsISO(todayISO(), -8)}T10:00:00`,
  lastLoginAt: nowIso(),
};
const authResponse = (): Row => ({
  ...profile,
  token: 'demo-access-token',
  refreshToken: 'demo-refresh-token',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
});
const otpResponse = (c: Ctx, purpose: string): Row => ({
  email: String(c.body.email || c.q.get('email') || profile.email),
  purpose: c.q.get('purpose') || purpose,
  message: 'Demo mode: no email is sent. Use any code.',
  expiresInMinutes: 10,
});

post('/api/auth/register', (c) => otpResponse(c, 'REGISTER'));
post('/api/auth/verify-otp', () => authResponse());
post('/api/auth/resend-otp', (c) => otpResponse(c, 'REGISTER'));
post('/api/auth/login', () => { profile.lastLoginAt = nowIso(); return authResponse(); });
post('/api/auth/forgot-password', (c) => otpResponse(c, 'RESET_PASSWORD'));
post('/api/auth/reset-password', () => authResponse());
post('/api/auth/refresh-token', () => authResponse());
post('/api/auth/logout', () => ({}));
get('/api/auth/me', () => authResponse());
put('/api/auth/me', (c) => {
  const b = c.body;
  if (typeof b.fullName === 'string' && b.fullName.trim()) profile.fullName = b.fullName.trim();
  if (typeof b.phoneNumber === 'string') profile.phoneNumber = b.phoneNumber.trim();
  if (typeof b.profilePictureUrl === 'string') profile.profilePictureUrl = b.profilePictureUrl.trim() || undefined;
  return authResponse();
});
post('/api/auth/change-password', (c) => {
  const b = c.body;
  if (b.newPassword && b.confirmPassword && b.newPassword !== b.confirmPassword) fail('New password and confirmation do not match');
  return {};
});
post('/api/auth/me/profile-image', (c) => {
  const f = formFiles(c.form)[0];
  if (!f) fail('No image file provided');
  profile.profilePictureUrl = fileToUrl(f);
  return authResponse();
});
del('/api/auth/me/profile-image', () => { profile.profilePictureUrl = undefined; return authResponse(); });

// ====================================================================== CANDIDATES
const findCandidate = (ref: string): Row | undefined => db.candidates.find((c) => c.id === ref || c.candidateId === ref);
const requireCandidate = (ref: string): Row => findCandidate(ref) || fail('Candidate not found');
const canonCandidateId = (ref: string): string => findCandidate(ref)?.id ?? ref;
const byCode = (a: Row, b: Row) => String(a.candidateId).localeCompare(String(b.candidateId));

const applyCandidate = (c: Row, patchBody: Row): Row => {
  const b = defined(patchBody);
  delete b.id;
  Object.assign(c, b);
  if (b.phoneNumber !== undefined || b.phone !== undefined) {
    c.phoneNumber = b.phoneNumber ?? b.phone;
    c.phone = c.phoneNumber;
  }
  if (b.monthlyRate !== undefined || b.monthlyFee !== undefined) {
    c.monthlyRate = num(b.monthlyRate ?? b.monthlyFee);
    c.monthlyFee = c.monthlyRate;
  }
  if (b.joiningDate && !b.endDate) c.endDate = addMonthsISO(day10(c.joiningDate), 1);
  if (b.status === 'ACTIVE') delete c.leavingDate;
  c.updatedAt = nowIso();
  return c;
};

post('/api/candidates', (c) => {
  const b = c.body;
  if (!String(b.fullName || '').trim()) fail('Full name is required');
  const id = newId();
  const row: Row = {
    id,
    candidateId: String(b.candidateId || '').trim() || nextCode('MBR-', db.candidates, 'candidateId', 3),
    status: 'ACTIVE',
    dietaryPreference: 'VEG',
    joiningDate: todayISO(),
    monthlyRate: 3500,
    monthlyFee: 3500,
    createdAt: nowIso(),
  };
  if (db.candidates.some((x) => lc(x.candidateId) === lc(row.candidateId))) fail(`Member ID ${row.candidateId} already exists`);
  applyCandidate(row, b);
  if (!row.endDate) row.endDate = addMonthsISO(day10(row.joiningDate), 1);
  db.candidates.push(row);
  return row;
});
get('/api/candidates', () => [...db.candidates].sort(byCode));
get('/api/candidates/active', () => db.candidates.filter((x) => x.status === 'ACTIVE').sort(byCode));
get('/api/candidates/left', () => db.candidates.filter((x) => x.status === 'LEFT').sort(byCode));
get('/api/candidates/stats', () => ({
  total: db.candidates.length,
  active: db.candidates.filter((x) => x.status === 'ACTIVE').length,
  left: db.candidates.filter((x) => x.status === 'LEFT').length,
}));
get('/api/candidates/by-id/:cid', (c) => requireCandidate(c.p.cid));
get('/api/candidates/:id', (c) => requireCandidate(c.p.id));
put('/api/candidates/:id', (c) => applyCandidate(requireCandidate(c.p.id), c.body));
patch('/api/candidates/:id/mark-left', (c) => {
  const cand = requireCandidate(c.p.id);
  cand.status = 'LEFT';
  cand.leavingDate = c.q.get('leavingDate') || todayISO();
  cand.updatedAt = nowIso();
  return cand;
});
del('/api/candidates/:id', (c) => {
  const cand = requireCandidate(c.p.id);
  db.candidates = db.candidates.filter((x) => x !== cand);
  db.attendance = db.attendance.filter((a) => a.candidateId !== cand.id);
  db.meals = db.meals.filter((m) => m.candidateId !== cand.id);
  db.fees = db.fees.filter((f) => f.candidateId !== cand.id);
  return {};
});
post('/api/candidates/:id/profile-image', (c) => {
  const cand = requireCandidate(c.p.id);
  const f = formFiles(c.form)[0];
  if (!f) fail('No image file provided');
  cand.profileImageUrl = fileToUrl(f);
  cand.updatedAt = nowIso();
  return cand;
});
patch('/api/candidates/:id/profile-image', (c) => {
  const cand = requireCandidate(c.p.id);
  const url = c.q.get('imageUrl') || '';
  if (url) cand.profileImageUrl = url; else delete cand.profileImageUrl;
  cand.updatedAt = nowIso();
  return cand;
});
del('/api/candidates/:id/profile-image', (c) => {
  const cand = requireCandidate(c.p.id);
  delete cand.profileImageUrl;
  cand.updatedAt = nowIso();
  return cand;
});

// ====================================================================== ATTENDANCE
const PRESENT = new Set(['IN', 'OUT', 'HALF_DAY']);
const activeCandidates = () => db.candidates.filter((x) => x.status === 'ACTIVE');

const upsertAttendance = (b: Row): Row => {
  const cid = canonCandidateId(String(b.candidateId));
  const date = day10(b.attendanceDate) || todayISO();
  let rec = db.attendance.find((a) => a.candidateId === cid && a.attendanceDate === date);
  if (!rec) {
    rec = { id: newId(), candidateId: cid, attendanceDate: date, createdAt: nowIso() };
    db.attendance.push(rec);
  }
  Object.assign(rec, defined({ ...b, candidateId: cid, attendanceDate: date, updatedAt: nowIso() }));
  return rec;
};
const attendanceCounts = (date: string) => {
  const total = activeCandidates().length;
  const present = db.attendance.filter((a) => a.attendanceDate === date && PRESENT.has(a.status)).length;
  return { present, absent: Math.max(0, total - present), total };
};

post('/api/attendance/mark', (c) => upsertAttendance(c.body));
post('/api/attendance/bulk', (c) => {
  const b = c.body;
  (b.presentCandidateIds || []).forEach((id: string) => upsertAttendance({ candidateId: id, attendanceDate: b.attendanceDate, status: 'IN', inTime: '08:00' }));
  (b.absentCandidateIds || []).forEach((id: string) => upsertAttendance({ candidateId: id, attendanceDate: b.attendanceDate, status: 'ABSENT' }));
  return { success: true, message: 'Attendance saved' };
});
post('/api/attendance/auto-mark-absent', () => {
  const date = todayISO();
  let n = 0;
  activeCandidates().forEach((cand) => {
    if (!db.attendance.some((a) => a.candidateId === cand.id && a.attendanceDate === date)) {
      upsertAttendance({ candidateId: cand.id, attendanceDate: date, status: 'ABSENT' });
      n++;
    }
  });
  return { success: true, message: `Marked ${n} member(s) absent` };
});
get('/api/attendance/summary/daily', (c) => attendanceCounts(c.q.get('date') || todayISO()));
get('/api/attendance/stats/today', () => attendanceCounts(todayISO()));
get('/api/attendance/monthly-summary', (c) => {
  const cid = canonCandidateId(c.q.get('candidateId') || '');
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  const list = db.attendance.filter((a) => a.candidateId === cid && ymOfDate(a.attendanceDate).y === y && ymOfDate(a.attendanceDate).m === m);
  const present = list.filter((a) => PRESENT.has(a.status)).length;
  return { present, absent: list.length - present, total: list.length };
});
get('/api/attendance/date/:date', (c) => db.attendance.filter((a) => a.attendanceDate === c.p.date));
get('/api/attendance/present/:date', (c) => {
  const ids = new Set(db.attendance.filter((a) => a.attendanceDate === c.p.date && PRESENT.has(a.status)).map((a) => a.candidateId));
  return db.candidates.filter((x) => ids.has(x.id));
});
get('/api/attendance/absent/:date', (c) => {
  const ids = new Set(db.attendance.filter((a) => a.attendanceDate === c.p.date && PRESENT.has(a.status)).map((a) => a.candidateId));
  return activeCandidates().filter((x) => !ids.has(x.id));
});
get('/api/attendance/candidate/:cid/range', (c) => {
  const cid = canonCandidateId(c.p.cid);
  return db.attendance.filter((a) => a.candidateId === cid && inRange(a.attendanceDate, c.q.get('startDate') || '', c.q.get('endDate') || '9999'));
});
get('/api/attendance/candidate/:cid', (c) => {
  const cid = canonCandidateId(c.p.cid);
  return db.attendance.filter((a) => a.candidateId === cid);
});
get('/api/attendance/:id', (c) => db.attendance.find((a) => a.id === c.p.id) || fail('Attendance record not found'));
put('/api/attendance/:id', (c) => {
  const rec = db.attendance.find((a) => a.id === c.p.id) || fail('Attendance record not found');
  Object.assign(rec, defined({ ...c.body, id: rec.id, updatedAt: nowIso() }));
  return rec;
});
del('/api/attendance/:id', (c) => { db.attendance = db.attendance.filter((a) => a.id !== c.p.id); return {}; });

// ====================================================================== MEALS
const upsertMeal = (b: Row): Row => {
  const cid = canonCandidateId(String(b.candidateId));
  const date = day10(b.mealDate) || todayISO();
  let rec = db.meals.find((m) => m.candidateId === cid && m.mealDate === date && m.mealType === b.mealType);
  if (!rec) {
    rec = { id: newId(), candidateId: cid, mealDate: date, mealType: b.mealType, isTaken: true, createdAt: nowIso() };
    db.meals.push(rec);
  }
  Object.assign(rec, defined({ ...b, candidateId: cid, mealDate: date, updatedAt: nowIso() }));
  return rec;
};
const mealCounts = (list: Row[]) => {
  const taken = list.filter((m) => m.isTaken).length;
  return { total: list.length, taken, notTaken: list.length - taken };
};

post('/api/meals/mark', (c) => upsertMeal(c.body));
post('/api/meals/bulk', (c) => {
  const b = c.body;
  (b.candidateIds || []).forEach((id: string) => upsertMeal({
    candidateId: id, mealDate: b.mealDate, mealType: b.mealType, isTaken: true, mealPreference: b.mealPreference,
  }));
  return { success: true, message: 'Meals recorded' };
});
get('/api/meals/summary/daily', (c) => mealCounts(db.meals.filter((m) => m.mealDate === (c.q.get('date') || todayISO()))));
get('/api/meals/stats/today', () => mealCounts(db.meals.filter((m) => m.mealDate === todayISO())));
get('/api/meals/candidate-summary', (c) => {
  const cid = canonCandidateId(c.q.get('candidateId') || '');
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  return mealCounts(db.meals.filter((x) => x.candidateId === cid && ymOfDate(x.mealDate).y === y && ymOfDate(x.mealDate).m === m));
});
get('/api/meals/missed', (c) => {
  const date = c.q.get('date') || todayISO();
  const type = c.q.get('mealType');
  const taken = new Set(db.meals.filter((m) => m.mealDate === date && m.mealType === type && m.isTaken).map((m) => m.candidateId));
  return activeCandidates().filter((x) => !taken.has(x.id));
});
get('/api/meals/date/:date', (c) => db.meals.filter((m) => m.mealDate === c.p.date));
get('/api/meals/type/:type/date/:date', (c) => db.meals.filter((m) => m.mealType === c.p.type && m.mealDate === c.p.date));
get('/api/meals/candidate/:cid/date/:date', (c) => {
  const cid = canonCandidateId(c.p.cid);
  return db.meals.filter((m) => m.candidateId === cid && m.mealDate === c.p.date);
});
get('/api/meals/candidate/:cid/range', (c) => {
  const cid = canonCandidateId(c.p.cid);
  return db.meals.filter((m) => m.candidateId === cid && inRange(m.mealDate, c.q.get('startDate') || '', c.q.get('endDate') || '9999'));
});
get('/api/meals/candidate/:cid', (c) => {
  const cid = canonCandidateId(c.p.cid);
  return db.meals.filter((m) => m.candidateId === cid);
});
get('/api/meals/:id', (c) => db.meals.find((m) => m.id === c.p.id) || fail('Meal record not found'));
put('/api/meals/:id', (c) => {
  const rec = db.meals.find((m) => m.id === c.p.id) || fail('Meal record not found');
  Object.assign(rec, defined({ ...c.body, id: rec.id, updatedAt: nowIso() }));
  return rec;
});
del('/api/meals/:id', (c) => { db.meals = db.meals.filter((m) => m.id !== c.p.id); return {}; });

// ====================================================================== EXPENSES
const expAmount = (e: Row): number => num(e.totalAmount, num(e.quantity, 1) * num(e.rate));
const requireExpense = (id: string): Row => db.expenses.find((e) => e.id === id) || fail('Expense not found');
const sortExpenses = (list: Row[]) => [...list].sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : a.expenseDate > b.expenseDate ? -1 : 0));
const expensesIn = (s: string, e: string) => db.expenses.filter((x) => inRange(x.expenseDate, s, e));
const range = (c: Ctx): [string, string] => [c.q.get('startDate') || '0000-01-01', c.q.get('endDate') || '9999-12-31'];
const byCategory = (list: Row[]): Record<string, number> => {
  const out: Record<string, number> = {};
  list.forEach((e) => { const k = e.category || 'MISCELLANEOUS'; out[k] = money((out[k] || 0) + expAmount(e)); });
  return out;
};

const applyExpense = (e: Row, b: Row): Row => {
  const clean = defined(b);
  delete clean.id;
  Object.assign(e, clean);
  e.quantity = num(e.quantity, 1) || 1;
  e.rate = num(e.rate);
  e.totalAmount = money(e.quantity * e.rate);
  e.updatedAt = nowIso();
  return e;
};

post('/api/expenses', (c) => {
  if (!String(c.body.itemName || '').trim()) fail('Item name is required');
  const e: Row = {
    id: newId(), category: 'MISCELLANEOUS', paymentMethod: 'CASH', paymentStatus: 'PAID',
    expenseDate: todayISO(), createdAt: nowIso(),
  };
  applyExpense(e, c.body);
  db.expenses.push(e);
  return e;
});
post('/api/expenses/upload', (c) => {
  const f = formFiles(c.form)[0];
  if (!f) fail('No file provided');
  return { fileUrl: fileToUrl(f), fileName: (f as File).name || 'attachment' };
});
get('/api/expenses/range', (c) => sortExpenses(expensesIn(...range(c))));
get('/api/expenses/total/today', () => ({ total: money(sum(expensesIn(todayISO(), todayISO()), expAmount)) }));
get('/api/expenses/total', (c) => ({ total: money(sum(expensesIn(...range(c)), expAmount)) }));
get('/api/expenses/summary', (c) => {
  const list = expensesIn(...range(c));
  return { total: money(sum(list, expAmount)), count: list.length, categories: byCategory(list) };
});
get('/api/expenses/category-wise', (c) => byCategory(expensesIn(...range(c))));
get('/api/expenses/monthly', (c) => {
  const y = num(c.q.get('year'), new Date().getFullYear());
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    total: money(sum(db.expenses.filter((e) => ymOfDate(e.expenseDate).y === y && ymOfDate(e.expenseDate).m === i + 1), expAmount)),
  }));
});
get('/api/expenses/daily/:month/:year', (c) => {
  const m = num(c.p.month);
  const y = num(c.p.year);
  return Array.from({ length: lastDayOf(y, m) }, (_, i) => ({
    day: i + 1,
    total: money(sum(expensesIn(`${y}-${pad(m)}-${pad(i + 1)}`, `${y}-${pad(m)}-${pad(i + 1)}`), expAmount)),
  }));
});
get('/api/expenses/date/:date', (c) => sortExpenses(expensesIn(c.p.date, c.p.date)));
get('/api/expenses/category/:cat/range', (c) => {
  const [s, e] = range(c);
  return sortExpenses(expensesIn(s, e).filter((x) => lc(x.category) === lc(c.p.cat)));
});
get('/api/expenses/category/:cat', (c) => sortExpenses(db.expenses.filter((x) => lc(x.category) === lc(c.p.cat))));
get('/api/expenses/:id', (c) => requireExpense(c.p.id));
put('/api/expenses/:id', (c) => applyExpense(requireExpense(c.p.id), c.body));
del('/api/expenses/:id', (c) => { const e = requireExpense(c.p.id); db.expenses = db.expenses.filter((x) => x !== e); return {}; });

// ====================================================================== DEPARTMENTS
const requireDept = (id: string): Row => db.departments.find((d) => d.id === id) || fail('Department not found');
const createDept = (c: Ctx) => {
  const b = c.body;
  const code = String(b.code || '').trim().toUpperCase();
  if (!code || !String(b.name || '').trim()) fail('Department code and name are required');
  if (db.departments.some((d) => d.code === code)) fail(`Department code ${code} already exists`);
  const d: Row = { id: newId(), active: true, createdAt: nowIso(), ...defined(b), code, updatedAt: nowIso() };
  db.departments.push(d);
  return d;
};
post('/api/departments', createDept);
get('/api/departments', () => [...db.departments].sort((a, b) => a.code.localeCompare(b.code)));
get('/api/departments/active', () => db.departments.filter((d) => d.active).sort((a, b) => a.code.localeCompare(b.code)));
get('/api/departments/code/:code', (c) => db.departments.find((d) => lc(d.code) === lc(c.p.code)) || fail('Department not found'));
get('/api/departments/:id', (c) => requireDept(c.p.id));
put('/api/departments/:id', (c) => {
  const d = requireDept(c.p.id);
  const b = defined(c.body);
  delete b.id;
  if (b.code) b.code = String(b.code).trim().toUpperCase();
  if (b.code && db.departments.some((x) => x !== d && x.code === b.code)) fail(`Department code ${b.code} already exists`);
  Object.assign(d, b, { updatedAt: nowIso() });
  return d;
});
patch('/api/departments/:id/toggle', (c) => { const d = requireDept(c.p.id); d.active = !d.active; d.updatedAt = nowIso(); return d; });
del('/api/departments/:id', (c) => { const d = requireDept(c.p.id); db.departments = db.departments.filter((x) => x !== d); return {}; });

// ====================================================================== STOCK
const requireItem = (id: string): Row => db.stockItems.find((i) => i.id === id) || fail('Stock item not found');
const isLow = (i: Row) => num(i.currentStock) <= num(i.minimumStockLevel);
const sortItems = (list: Row[]) => [...list].sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)));
const sortTx = (list: Row[]) => [...list].sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : a.transactionDate > b.transactionDate ? -1 : String(b.createdAt).localeCompare(String(a.createdAt))));

const applyItem = (i: Row, b: Row): Row => {
  const clean = defined(b);
  delete clean.id;
  if (clean.expiryDate === '' || clean.expiryDate === null) { delete clean.expiryDate; delete i.expiryDate; }
  Object.assign(i, clean);
  ['currentStock', 'minimumStockLevel', 'maximumStockLevel', 'unitPrice'].forEach((k) => { if (i[k] !== undefined) i[k] = num(i[k]); });
  if (i.currentStock === undefined) i.currentStock = 0;
  if (i.minimumStockLevel === undefined) i.minimumStockLevel = 0;
  if (i.unitPrice === undefined) i.unitPrice = 0;
  i.status = i.status || 'ACTIVE';
  i.images = Array.isArray(i.images) ? i.images : [];
  i.imageUrls = i.images;
  i.updatedAt = nowIso();
  return i;
};
const createItem = (b: Row, files: File[] = []): Row => {
  if (!String(b.itemName || '').trim()) fail('Item name is required');
  const i: Row = { id: newId(), createdAt: nowIso(), category: 'OTHERS', unit: 'kg' };
  applyItem(i, b);
  if (files.length) addItemImages(i, files, true);
  db.stockItems.push(i);
  return i;
};
const addItemImages = (i: Row, files: File[], setPrimary: boolean) => {
  const urls = files.map(fileToUrl);
  i.images = [...(i.images || []), ...urls];
  i.imageUrls = i.images;
  if (urls.length && (setPrimary || !i.primaryImage)) { i.primaryImage = urls[0]; i.primaryImageUrl = urls[0]; }
  i.updatedAt = nowIso();
  return urls;
};

interface TxOpts { reference?: string | null; refType?: string; remarks?: string | null; date?: string; unitPrice?: number; enteredBy?: string }
const recordTx = (item: Row, type: string, qty: number, before: number, after: number, o: TxOpts = {}): Row => {
  const unitPrice = o.unitPrice ?? num(item.unitPrice);
  const tx: Row = {
    id: newId(),
    stockItemId: item.id,
    stockItemName: item.itemName,
    transactionType: type,
    quantity: qty,
    unit: item.unit,
    unitPrice,
    totalAmount: money(qty * unitPrice),
    stockBefore: before,
    stockAfter: after,
    transactionDate: o.date || todayISO(),
    referenceNumber: o.reference || undefined,
    referenceType: o.refType,
    remarks: o.remarks || undefined,
    enteredBy: o.enteredBy || String(profile.fullName),
    createdAt: nowIso(),
  };
  db.stockTx.push(tx);
  return tx;
};
const stockOp = (item: Row, kind: 'ADD' | 'DEDUCT', qty: number, o: TxOpts) => {
  if (!(qty > 0)) fail('Quantity must be greater than zero');
  const before = num(item.currentStock);
  if (kind === 'DEDUCT' && qty > before) fail(`Insufficient stock for ${item.itemName}: only ${before} ${item.unit} available`);
  const after = money(kind === 'ADD' ? before + qty : before - qty);
  item.currentStock = after;
  item.updatedAt = nowIso();
  recordTx(item, kind === 'ADD' ? 'PURCHASE' : 'USAGE', qty, before, after, o);
  return item;
};

post('/api/stock/items/with-images', (c) => createItem(formToObject(c.form), formFiles(c.form, 'images', 'files', 'file')));
post('/api/stock/items', (c) => createItem(c.body));
get('/api/stock/items/active', () => sortItems(db.stockItems.filter((i) => i.status === 'ACTIVE')));
get('/api/stock/items/low-stock', () => sortItems(db.stockItems.filter(isLow)));
get('/api/stock/items/over-stock', () => sortItems(db.stockItems.filter((i) => i.maximumStockLevel && num(i.currentStock) > num(i.maximumStockLevel))));
get('/api/stock/items/category/:cat', (c) => sortItems(db.stockItems.filter((i) => lc(i.category) === lc(c.p.cat))));
get('/api/stock/items/name/:name', (c) => db.stockItems.find((i) => lc(i.itemName) === lc(c.p.name)) || fail('Stock item not found'));
get('/api/stock/items', () => sortItems(db.stockItems));
get('/api/stock/items/:id', (c) => requireItem(c.p.id));
put('/api/stock/items/:id/with-images', (c) => {
  const i = requireItem(c.p.id);
  applyItem(i, formToObject(c.form));
  const files = formFiles(c.form, 'images', 'files', 'file');
  if (files.length) addItemImages(i, files, false);
  return i;
});
put('/api/stock/items/:id', (c) => applyItem(requireItem(c.p.id), c.body));
del('/api/stock/items/:id', (c) => {
  const i = requireItem(c.p.id);
  db.stockItems = db.stockItems.filter((x) => x !== i);
  db.stockTx = db.stockTx.filter((t) => t.stockItemId !== i.id);
  return {};
});
patch('/api/stock/items/:id/toggle', (c) => { const i = requireItem(c.p.id); i.status = i.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'; i.updatedAt = nowIso(); return i; });
patch('/api/stock/items/:id/stock', (c) => {
  const i = requireItem(c.p.id);
  const target = num(c.q.get('newStock'), NaN);
  if (!Number.isFinite(target) || target < 0) fail('Invalid stock level');
  const before = num(i.currentStock);
  i.currentStock = target;
  i.updatedAt = nowIso();
  recordTx(i, 'ADJUSTMENT', Math.abs(target - before), before, target, { reference: 'MANUAL_ADJUSTMENT', remarks: 'Stock level adjusted manually' });
  return i;
});
patch('/api/stock/items/:id/add', (c) => stockOp(requireItem(c.p.id), 'ADD', num(c.q.get('quantity')), { reference: c.q.get('reference'), refType: 'PURCHASE_ORDER', remarks: c.q.get('remarks') }));
patch('/api/stock/items/:id/deduct', (c) => stockOp(requireItem(c.p.id), 'DEDUCT', num(c.q.get('quantity')), { reference: c.q.get('reference'), refType: 'KITCHEN', remarks: c.q.get('remarks') }));
post('/api/stock/items/:id/images', (c) => {
  const i = requireItem(c.p.id);
  addItemImages(i, formFiles(c.form), false);
  return { images: i.images };
});
patch('/api/stock/items/:id/primary-image', (c) => {
  const i = requireItem(c.p.id);
  const url = c.q.get('imageUrl') || '';
  i.primaryImage = url; i.primaryImageUrl = url;
  if (url && !(i.images || []).includes(url)) { i.images = [...(i.images || []), url]; i.imageUrls = i.images; }
  return i;
});
del('/api/stock/items/:id/images', (c) => {
  const i = requireItem(c.p.id);
  const url = c.q.get('imageUrl') || '';
  i.images = (i.images || []).filter((x: string) => x !== url);
  i.imageUrls = i.images;
  if (i.primaryImage === url) { i.primaryImage = i.images[0]; i.primaryImageUrl = i.images[0]; }
  return {};
});

// transactions
post('/api/stock/transactions', (c) => {
  const b = c.body;
  const item = requireItem(String(b.stockItemId));
  const qty = num(b.quantity);
  if (!(qty > 0) && b.transactionType !== 'ADJUSTMENT') fail('Quantity must be greater than zero');
  const before = num(item.currentStock);
  let after = before;
  switch (b.transactionType) {
    case 'USAGE':
      if (qty > before) fail(`Insufficient stock for ${item.itemName}: only ${before} ${item.unit} available`);
      after = before - qty; break;
    case 'ADJUSTMENT':
      after = b.stockAfter !== undefined ? num(b.stockAfter) : before + qty; break;
    default: // PURCHASE / RETURN
      after = before + qty;
  }
  after = money(after);
  item.currentStock = after;
  item.updatedAt = nowIso();
  return recordTx(item, b.transactionType || 'PURCHASE', qty, before, after, {
    reference: b.referenceNumber, refType: b.referenceType, remarks: b.remarks, date: b.transactionDate ? day10(b.transactionDate) : undefined,
    unitPrice: b.unitPrice !== undefined ? num(b.unitPrice) : undefined, enteredBy: b.enteredBy,
  });
});
get('/api/stock/transactions/range', (c) => sortTx(db.stockTx.filter((t) => inRange(t.transactionDate, ...range(c)))));
get('/api/stock/transactions/item/:id', (c) => sortTx(db.stockTx.filter((t) => t.stockItemId === c.p.id)));
get('/api/stock/transactions/type/:type', (c) => sortTx(db.stockTx.filter((t) => t.transactionType === c.p.type)));
get('/api/stock/transactions/:id', (c) => db.stockTx.find((t) => t.id === c.p.id) || fail('Transaction not found'));

get('/api/stock/summary/category/:cat', (c) => {
  const items = sortItems(db.stockItems.filter((i) => lc(i.category) === lc(c.p.cat)));
  return { totalItems: items.length, totalValue: money(sum(items, (i) => num(i.currentStock) * num(i.unitPrice))), items };
});
get('/api/stock/summary', () => ({
  totalItems: db.stockItems.length,
  totalValue: money(sum(db.stockItems, (i) => num(i.currentStock) * num(i.unitPrice))),
  lowStockItems: db.stockItems.filter(isLow).length,
  categories: Array.from(new Set(db.stockItems.map((i) => i.category))).sort(),
}));
get('/api/stock/total-value', () => ({ totalValue: money(sum(db.stockItems, (i) => num(i.currentStock) * num(i.unitPrice))) }));
get('/api/stock/history/:id', (c) => sortTx(db.stockTx.filter((t) => t.stockItemId === c.p.id && inRange(t.transactionDate, ...range(c))))
  .reverse().map((t) => ({ date: t.transactionDate, stock: t.stockAfter, transaction: t })));
post('/api/stock/alerts/check', () => ({
  alerts: db.stockItems.filter(isLow).map((i) => ({ item: i, currentStock: i.currentStock, minLevel: i.minimumStockLevel })),
}));

// ====================================================================== STAFF
const findStaff = (ref: string): Row | undefined => db.staff.find((s) => s.id === ref || s.staffId === ref);
const requireStaff = (ref: string): Row => findStaff(ref) || fail('Staff member not found');
const canonStaffId = (ref: string): string => findStaff(ref)?.id ?? ref;
const staffName = (id: string) => findStaff(id)?.fullName;
const sortStaff = (list: Row[]) => [...list].sort((a, b) => String(a.staffId).localeCompare(String(b.staffId)));

const applyStaff = (s: Row, b: Row): Row => {
  const clean = defined(b);
  delete clean.id;
  Object.assign(s, clean);
  s.baseSalary = num(s.baseSalary);
  s.status = s.status || 'ACTIVE';
  s.employmentType = s.employmentType || 'FULL_TIME';
  s.images = Array.isArray(s.images) ? s.images : [];
  s.imageUrls = s.images;
  s.updatedAt = nowIso();
  return s;
};
const createStaff = (b: Row, files: File[] = []): Row => {
  if (!String(b.fullName || '').trim()) fail('Full name is required');
  const s: Row = {
    id: newId(), staffId: String(b.staffId || '').trim() || nextCode('STF-', db.staff, 'staffId', 3),
    joiningDate: todayISO(), createdAt: nowIso(),
  };
  applyStaff(s, b);
  if (files.length) addStaffImages(s, files, true);
  db.staff.push(s);
  return s;
};
const addStaffImages = (s: Row, files: File[], setPrimary: boolean) => {
  const urls = files.map(fileToUrl);
  s.images = [...(s.images || []), ...urls];
  s.imageUrls = s.images;
  if (urls.length && (setPrimary || !s.primaryImageUrl)) { s.primaryImage = urls[0]; s.primaryImageUrl = urls[0]; }
  s.updatedAt = nowIso();
};

get('/api/staff/generate-id', () => ({ staffId: nextCode('STF-', db.staff, 'staffId', 3) }));
get('/api/staff/active', () => sortStaff(db.staff.filter((s) => s.status === 'ACTIVE')));
get('/api/staff/position/:pos', (c) => sortStaff(db.staff.filter((s) => lc(s.position) === lc(c.p.pos))));
get('/api/staff/staff-id/:sid', (c) => requireStaff(c.p.sid));
post('/api/staff/with-images', (c) => createStaff(formToObject(c.form), formFiles(c.form, 'images', 'files', 'file')));
post('/api/staff', (c) => createStaff(c.body));
get('/api/staff', () => sortStaff(db.staff));

// salary payments
const decoratePayment = (p: Row): Row => ({ ...p, staffName: p.staffName || staffName(p.staffId) });
const sortPayments = (list: Row[]) => [...list].sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : a.paymentDate > b.paymentDate ? -1 : 0));
get('/api/staff/payments/range', (c) => sortPayments(db.staffPayments.filter((p) => inRange(p.paymentDate, ...range(c)))).map(decoratePayment));
get('/api/staff/payments/total', (c) => ({ total: money(sum(db.staffPayments.filter((p) => inRange(p.paymentDate, ...range(c))), (p) => num(p.amount))) }));
get('/api/staff/payments/staff/:sid/year/:year', (c) => {
  const sid = canonStaffId(c.p.sid);
  return sortPayments(db.staffPayments.filter((p) => p.staffId === sid && p.paymentYear === num(c.p.year))).map(decoratePayment);
});
get('/api/staff/payments/staff/:sid', (c) => {
  const sid = canonStaffId(c.p.sid);
  return sortPayments(db.staffPayments.filter((p) => p.staffId === sid)).map(decoratePayment);
});
post('/api/staff/payments', (c) => {
  const b = c.body;
  const s = requireStaff(String(b.staffId));
  const date = day10(b.paymentDate) || todayISO();
  const ym = ymOfDate(date);
  const p: Row = {
    id: newId(),
    ...defined(b),
    staffId: s.id,
    staffName: s.fullName,
    paymentDate: date,
    amount: num(b.amount),
    paymentMonthNumber: num(b.paymentMonthNumber, ym.m),
    paymentYear: num(b.paymentYear, ym.y),
    paymentMonth: b.paymentMonth || MONTH_NAMES[num(b.paymentMonthNumber, ym.m) - 1],
    paymentMethod: b.paymentMethod || 'CASH',
    bonus: num(b.bonus),
    deductions: num(b.deductions),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.staffPayments.push(p);
  return p;
});
get('/api/staff/payments/:id', (c) => decoratePayment(db.staffPayments.find((p) => p.id === c.p.id) || fail('Payment not found')));
del('/api/staff/payments/:id', (c) => {
  const p = db.staffPayments.find((x) => x.id === c.p.id) || fail('Payment not found');
  db.staffPayments = db.staffPayments.filter((x) => x !== p);
  return {};
});

// advances
const advAmount = (a: Row) => num(a.amount, num(a.advanceAmount));
const normAdvance = (a: Row): Row => {
  a.amount = advAmount(a);
  a.advanceAmount = a.amount;
  const repaid = Math.min(a.amount, num(a.repaidAmount, num(a.repaymentAmount)));
  a.repaidAmount = repaid;
  a.repaymentAmount = repaid;
  if (a.status === 'REPAID') { a.repaidAmount = a.amount; a.repaymentAmount = a.amount; }
  a.remainingAmount = a.status === 'REJECTED' ? a.amount : Math.max(0, a.amount - a.repaidAmount);
  a.staffName = staffName(a.staffId) || a.staffName;
  a.updatedAt = nowIso();
  return a;
};
const requireAdvance = (id: string): Row => db.advances.find((a) => a.id === id) || fail('Advance not found');
const sortAdv = (list: Row[]) => [...list].sort((a, b) => (a.advanceDate < b.advanceDate ? 1 : a.advanceDate > b.advanceDate ? -1 : 0));
const outstandingFor = (sid: string) => db.advances.filter((a) => a.staffId === sid && a.status === 'APPROVED' && advAmount(a) - num(a.repaidAmount) > 0);

get('/api/staff/advances', () => sortAdv(db.advances));
post('/api/staff/advances', (c) => {
  const b = c.body;
  const s = requireStaff(String(b.staffId));
  const a: Row = {
    id: newId(), status: 'PENDING', installmentMonths: 1, repaidAmount: 0, advanceDate: todayISO(), createdAt: nowIso(),
    ...defined(b), staffId: s.id,
  };
  if (!(advAmount(a) > 0)) fail('Advance amount must be greater than zero');
  if (a.status === 'APPROVED') { a.approvedAt = nowIso(); a.approvedByCandidateId = a.approvedByCandidateId || String(profile.id); }
  if (a.monthlyDeduction === undefined) a.monthlyDeduction = Math.round(advAmount(a) / num(a.installmentMonths, 1));
  db.advances.push(normAdvance(a));
  return a;
});
get('/api/staff/advances/pending', () => sortAdv(db.advances.filter((a) => a.status === 'PENDING')));
get('/api/staff/advances/staff/:sid', (c) => sortAdv(db.advances.filter((a) => a.staffId === canonStaffId(c.p.sid))));
get('/api/staff/advances/outstanding/:sid', (c) => {
  const list = outstandingFor(canonStaffId(c.p.sid));
  return { totalOutstanding: sum(list, (a) => advAmount(a) - num(a.repaidAmount)), advances: list };
});
patch('/api/staff/advances/:id/approve', (c) => {
  const a = requireAdvance(c.p.id);
  a.status = 'APPROVED';
  a.approvedAt = nowIso();
  a.approvedByCandidateId = c.q.get('approvedByCandidateId') || String(profile.id);
  return normAdvance(a);
});
patch('/api/staff/advances/:id/reject', (c) => { const a = requireAdvance(c.p.id); a.status = 'REJECTED'; return normAdvance(a); });
patch('/api/staff/advances/:id/repay', (c) => {
  const a = requireAdvance(c.p.id);
  const amt = num(c.q.get('repaymentAmount'));
  if (!(amt > 0)) fail('Repayment amount must be greater than zero');
  a.repaidAmount = Math.min(advAmount(a), num(a.repaidAmount) + amt);
  if (a.repaidAmount >= advAmount(a)) a.status = 'REPAID';
  return normAdvance(a);
});
get('/api/staff/advances/:id', (c) => requireAdvance(c.p.id));
put('/api/staff/advances/:id', (c) => {
  const a = requireAdvance(c.p.id);
  const b = defined(c.body);
  delete b.id;
  if (b.repaymentAmount !== undefined && b.repaidAmount === undefined) b.repaidAmount = b.repaymentAmount;
  Object.assign(a, b);
  if (b.status === 'APPROVED' && !a.approvedAt) a.approvedAt = nowIso();
  return normAdvance(a);
});
del('/api/staff/advances/:id', (c) => { const a = requireAdvance(c.p.id); db.advances = db.advances.filter((x) => x !== a); return {}; });

// summaries / reports
const monthsBetween = (fromIso: string, to = new Date()): number => {
  const [y, m] = [Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7))];
  return Math.max(1, (to.getFullYear() - y) * 12 + (to.getMonth() + 1 - m) + 1);
};
const staffSummaryRow = (s: Row): Row => {
  const pays = db.staffPayments.filter((p) => p.staffId === s.id);
  const last = [...pays].sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1))[0];
  return {
    staffId: s.id,
    staffName: s.fullName,
    position: s.position,
    baseSalary: s.baseSalary,
    totalPaid: money(sum(pays, (p) => num(p.amount))),
    totalDeductions: money(sum(pays, (p) => num(p.deductions))),
    totalBonus: money(sum(pays, (p) => num(p.bonus))),
    outstandingAdvance: money(sum(outstandingFor(s.id), (a) => advAmount(a) - num(a.repaidAmount))),
    monthsWorked: monthsBetween(s.joiningDate),
    joiningDate: s.joiningDate,
    lastPaymentDate: last?.paymentDate,
  };
};
get('/api/staff/summary/:sid', (c) => {
  const s = requireStaff(c.p.sid);
  const row = staffSummaryRow(s);
  const last = [...db.staffPayments.filter((p) => p.staffId === s.id)].sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1))[0];
  return { staff: s, totalPaid: row.totalPaid, outstandingAdvances: row.outstandingAdvance, lastPayment: last };
});
get('/api/staff/summary', () => sortStaff(db.staff.filter((s) => s.status === 'ACTIVE')).map(staffSummaryRow));
get('/api/staff/report/monthly', (c) => {
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  const list = db.staffPayments.filter((p) => p.paymentYear === y && p.paymentMonthNumber === m);
  const totalSalary = sum(list, (p) => num(p.amount) - num(p.bonus) + num(p.deductions));
  const totalBonus = sum(list, (p) => num(p.bonus));
  const totalDeductions = sum(list, (p) => num(p.deductions));
  return { totalSalary: money(totalSalary), totalBonus: money(totalBonus), totalDeductions: money(totalDeductions), netPayable: money(sum(list, (p) => num(p.amount))) };
});
get('/api/staff/report/yearly', (c) => {
  const y = num(c.q.get('year'), new Date().getFullYear());
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    totalPaid: money(sum(db.staffPayments.filter((p) => p.paymentYear === y && p.paymentMonthNumber === i + 1), (p) => num(p.amount))),
  }));
});

// staff profile CRUD + images (after the fixed /api/staff/* paths above)
get('/api/staff/:id', (c) => requireStaff(c.p.id));
put('/api/staff/:id/with-images', (c) => {
  const s = requireStaff(c.p.id);
  applyStaff(s, formToObject(c.form));
  const files = formFiles(c.form, 'images', 'files', 'file');
  if (files.length) addStaffImages(s, files, false);
  return s;
});
put('/api/staff/:id', (c) => applyStaff(requireStaff(c.p.id), c.body));
del('/api/staff/:id', (c) => {
  const s = requireStaff(c.p.id);
  db.staff = db.staff.filter((x) => x !== s);
  db.staffPayments = db.staffPayments.filter((p) => p.staffId !== s.id);
  db.advances = db.advances.filter((a) => a.staffId !== s.id);
  return {};
});
patch('/api/staff/:id/toggle', (c) => { const s = requireStaff(c.p.id); s.status = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'; s.updatedAt = nowIso(); return s; });
post('/api/staff/:id/images', (c) => {
  const s = requireStaff(c.p.id);
  const files = formFiles(c.form);
  if (!files.length) fail('No image file provided');
  addStaffImages(s, files, c.q.get('setAsPrimary') === 'true');
  return s;
});
patch('/api/staff/:id/primary-image', (c) => {
  const s = requireStaff(c.p.id);
  const url = c.q.get('imageUrl') || '';
  s.primaryImage = url || undefined; s.primaryImageUrl = url || undefined;
  if (url && !(s.images || []).includes(url)) { s.images = [...(s.images || []), url]; s.imageUrls = s.images; }
  s.updatedAt = nowIso();
  return s;
});
del('/api/staff/:id/images', (c) => {
  const s = requireStaff(c.p.id);
  const url = c.q.get('imageUrl') || '';
  s.images = (s.images || []).filter((x: string) => x !== url);
  s.imageUrls = s.images;
  if (s.primaryImageUrl === url) { s.primaryImage = s.images[0]; s.primaryImageUrl = s.images[0]; }
  s.updatedAt = nowIso();
  return s;
});

// ====================================================================== PARTIES
const requireParty = (ref: string): Row => db.parties.find((p) => p.id === ref || p.partyId === ref) || fail('Party not found');
const partyBill = (p: Row): number => {
  const base = num(p.numberOfPeople) * num(p.thaliRate);
  const extras = Array.isArray(p.extraItems) ? sum(p.extraItems as Row[], (x) => num(x.quantity) * num(x.rate)) : 0;
  return Math.max(0, money(base + extras - num(p.discount)));
};
const partyStatusOf = (p: Row): string => {
  const bill = partyBill(p);
  const paid = num(p.paidAmount);
  if (paid > 0 && paid >= bill) return 'PAID';
  return paid > 0 ? 'PARTIAL' : 'PENDING';
};
const sortParties = (list: Row[]) => [...list].sort((a, b) => (a.eventDate < b.eventDate ? 1 : a.eventDate > b.eventDate ? -1 : 0));
const syncParty = (p: Row): Row => {
  if (p.clientName || p.contactPerson) { p.clientName = p.clientName || p.contactPerson; p.contactPerson = p.contactPerson || p.clientName; }
  if (p.clientPhone || p.phoneNumber) { p.clientPhone = p.clientPhone || p.phoneNumber; p.phoneNumber = p.phoneNumber || p.clientPhone; }
  if (!p.partyName) p.partyName = p.clientName || 'Party Booking';
  p.eventDate = day10(p.eventDate) || todayISO();
  p.numberOfPeople = num(p.numberOfPeople);
  p.thaliRate = num(p.thaliRate);
  p.paidAmount = num(p.paidAmount, num(p.advanceAmount));
  p.advanceAmount = p.paidAmount;
  p.extraItems = Array.isArray(p.extraItems) ? p.extraItems : [];
  p.totalAmount = partyBill(p);
  p.paymentStatus = partyStatusOf(p);
  const dn = lc(p.departmentName);
  if (dn) {
    const d = db.departments.find((x) => lc(x.name) === dn || lc(x.code) === dn);
    if (d) { p.departmentId = d.id; p.departmentCode = d.code; p.departmentName = d.name; }
    else { delete p.departmentId; delete p.departmentCode; }
  } else if (p.departmentId) {
    const d = db.departments.find((x) => x.id === p.departmentId);
    if (d) { p.departmentCode = d.code; p.departmentName = d.name; }
  }
  p.updatedAt = nowIso();
  return p;
};
const nextInvoice = (): string => {
  const yr = new Date().getFullYear();
  let max = 0;
  db.parties.forEach((p) => {
    const m = String(p.invoiceNumber || '').match(/^INV-P-\d{4}-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `INV-P-${yr}-${String(max + 1).padStart(3, '0')}`;
};
const partiesIn = (s: string, e: string) => db.parties.filter((p) => inRange(p.eventDate, s, e));
const partyTotals = (list: Row[]) => {
  const totalRevenue = money(sum(list, partyBill));
  const totalPaid = money(sum(list, (p) => num(p.paidAmount)));
  return { totalParties: list.length, totalRevenue, totalPaid, totalOutstanding: money(sum(list, (p) => Math.max(0, partyBill(p) - num(p.paidAmount)))) };
};

post('/api/parties', (c) => {
  const p: Row = { id: newId(), createdAt: nowIso(), ...defined(c.body) };
  if (!p.partyId) p.partyId = nextCode('PTY-', db.parties, 'partyId', 4);
  if (!p.invoiceNumber) p.invoiceNumber = nextInvoice();
  db.parties.push(syncParty(p));
  if (num(p.paidAmount) > 0) {
    db.partyPayments.push({ id: newId(), partyId: p.id, amount: num(p.paidAmount), paymentDate: todayISO(), receiptNumber: `REC-PTY-${Date.now().toString().slice(-6)}`, paymentMethod: p.paymentMethod || 'CASH', remarks: 'Advance received', createdAt: nowIso() });
  }
  return p;
});
get('/api/parties/generate-id', () => ({ partyId: nextCode('PTY-', db.parties, 'partyId', 4) }));
get('/api/parties/generate-invoice', () => ({ invoiceNumber: nextInvoice() }));
get('/api/parties/summary', (c) => partyTotals(partiesIn(...range(c))));
get('/api/parties/total-billing', (c) => ({ total: money(sum(partiesIn(...range(c)), partyBill)) }));
get('/api/parties/outstanding', () => {
  const list = db.parties.filter((p) => partyBill(p) - num(p.paidAmount) > 0);
  return { totalOutstanding: money(sum(list, (p) => partyBill(p) - num(p.paidAmount))), parties: sortParties(list) };
});
get('/api/parties/monthly-billing', (c) => {
  const y = num(c.q.get('year'), new Date().getFullYear());
  return Array.from({ length: 12 }, (_, i) => {
    const list = db.parties.filter((p) => ymOfDate(p.eventDate).y === y && ymOfDate(p.eventDate).m === i + 1);
    return { month: i + 1, total: money(sum(list, partyBill)), count: list.length };
  });
});
get('/api/parties/revenue-report', (c) => {
  const y = num(c.q.get('year'), new Date().getFullYear());
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const list = db.parties.filter((p) => ymOfDate(p.eventDate).y === y && ymOfDate(p.eventDate).m === i + 1);
    return { month: i + 1, revenue: money(sum(list, partyBill)), count: list.length };
  });
  return { totalRevenue: money(sum(monthlyData, (m) => m.revenue)), monthlyData };
});
get('/api/parties/range', (c) => sortParties(partiesIn(...range(c))));
get('/api/parties/date/:date', (c) => sortParties(partiesIn(c.p.date, c.p.date)));
get('/api/parties/payment-status/:status', (c) => sortParties(db.parties.filter((p) => p.paymentStatus === c.p.status.toUpperCase())));
get('/api/parties/department/:code', (c) => sortParties(db.parties.filter((p) => lc(p.departmentCode) === lc(c.p.code) || lc(p.departmentName) === lc(c.p.code))));
get('/api/parties/party-id/:pid', (c) => requireParty(c.p.pid));
post('/api/parties/payments', (c) => {
  const b = c.body;
  const p = requireParty(String(b.partyId));
  const amount = num(b.amount);
  if (!(amount > 0)) fail('Payment amount must be greater than zero');
  p.paidAmount = money(num(p.paidAmount) + amount);
  p.paymentMethod = b.paymentMethod || p.paymentMethod;
  syncParty(p);
  const pay: Row = {
    id: newId(), ...defined(b), partyId: p.id, amount, paymentDate: day10(b.paymentDate) || todayISO(),
    receiptNumber: b.receiptNumber || `REC-PTY-${Date.now().toString().slice(-6)}`, createdAt: nowIso(),
  };
  db.partyPayments.push(pay);
  return pay;
});
get('/api/parties', () => sortParties(db.parties));
get('/api/parties/:id', (c) => requireParty(c.p.id));
put('/api/parties/:id', (c) => {
  const p = requireParty(c.p.id);
  const b = defined(c.body);
  delete b.id;
  Object.assign(p, b);
  if (b.paidAmount === undefined && b.advanceAmount !== undefined) p.paidAmount = b.advanceAmount;
  return syncParty(p);
});
del('/api/parties/:id', (c) => {
  const p = requireParty(c.p.id);
  db.parties = db.parties.filter((x) => x !== p);
  db.partyPayments = db.partyPayments.filter((x) => x.partyId !== p.id);
  return {};
});
patch('/api/parties/:id/mark-paid', (c) => {
  const p = requireParty(c.p.id);
  const bill = partyBill(p);
  const due = bill - num(p.paidAmount);
  if (due > 0) {
    db.partyPayments.push({ id: newId(), partyId: p.id, amount: due, paymentDate: todayISO(), receiptNumber: `REC-PTY-${Date.now().toString().slice(-6)}`, paymentMethod: p.paymentMethod || 'CASH', remarks: 'Marked as paid', createdAt: nowIso() });
  }
  p.paidAmount = bill;
  return syncParty(p);
});
patch('/api/parties/:id/payment-status', (c) => {
  const p = requireParty(c.p.id);
  const status = String(c.q.get('status') || '').toUpperCase();
  if (!['PAID', 'PARTIAL', 'PENDING', 'UNPAID'].includes(status)) fail('Invalid payment status');
  const bill = partyBill(p);
  if (status === 'PAID') p.paidAmount = bill;
  else if (status === 'PENDING' || status === 'UNPAID') p.paidAmount = 0;
  else if (num(p.paidAmount) <= 0 || num(p.paidAmount) >= bill) p.paidAmount = Math.round(bill / 2);
  return syncParty(p);
});

// ====================================================================== COLLEGE BILLING
const requireCB = (id: string): Row => db.collegeBillings.find((r) => r.id === id) || fail('College billing record not found');
const normCB = (r: Row): Row => {
  r.month = num(r.month);
  r.year = num(r.year);
  r.monthName = MONTH_NAMES[r.month - 1] || r.monthName;
  if (r.totalThalisServed && r.ratePerThali && !num(r.totalBillableAmount)) r.totalBillableAmount = money(num(r.totalThalisServed) * num(r.ratePerThali));
  r.totalBillableAmount = num(r.totalBillableAmount);
  r.amountReceived = num(r.amountReceived);
  r.outstandingBalance = Math.max(0, money(r.totalBillableAmount - r.amountReceived));
  r.status = r.amountReceived <= 0 ? 'UNPAID' : r.amountReceived < r.totalBillableAmount ? 'PARTIALLY_PAID' : 'PAID';
  r.updatedAt = nowIso();
  return r;
};
const cbFilter = (c: Ctx): Row[] => {
  const college = c.q.get('college');
  const m = num(c.q.get('month'));
  const y = num(c.q.get('year'));
  return db.collegeBillings.filter((r) =>
    (!college || lc(r.college) === lc(college)) && (!m || r.month === m) && (!y || r.year === y));
};
const sortCB = (list: Row[]) => [...list].sort((a, b) => ymKey(b.year, b.month) - ymKey(a.year, a.month) || String(a.college).localeCompare(String(b.college)));

get('/api/college-billing/summary', (c) => {
  const list = cbFilter(c);
  return {
    totalBillableAmount: money(sum(list, (r) => num(r.totalBillableAmount))),
    totalAmountReceived: money(sum(list, (r) => num(r.amountReceived))),
    totalOutstandingBalance: money(sum(list, (r) => num(r.outstandingBalance))),
    totalRecords: list.length,
    paidCount: list.filter((r) => r.status === 'PAID').length,
    partiallyPaidCount: list.filter((r) => r.status === 'PARTIALLY_PAID').length,
    unpaidCount: list.filter((r) => r.status === 'UNPAID').length,
  };
});
get('/api/college-billing/colleges', () => Array.from(new Set(db.collegeBillings.map((r) => r.college))).sort());
get('/api/college-billing', (c) => sortCB(cbFilter(c)));
get('/api/college-billing/:id', (c) => requireCB(c.p.id));
post('/api/college-billing', (c) => {
  const b = c.body;
  if (!String(b.college || '').trim()) fail('College name is required');
  if (!num(b.month) || !num(b.year)) fail('Month and year are required');
  const r: Row = { id: newId(), billingDate: todayISO(), createdAt: nowIso(), ...defined(b), college: String(b.college).trim() };
  db.collegeBillings.push(normCB(r));
  return r;
});
put('/api/college-billing/:id', (c) => {
  const r = requireCB(c.p.id);
  const b = defined(c.body);
  delete b.id;
  Object.assign(r, b);
  return normCB(r);
});
del('/api/college-billing/:id', (c) => { const r = requireCB(c.p.id); db.collegeBillings = db.collegeBillings.filter((x) => x !== r); return {}; });

// ====================================================================== BILLING (fees, finance roll-ups)
// ---- finance helpers: everything below is computed from the live in-memory data
const feesIn = (y: number, m: number) => db.fees.filter((f) => f.paymentYear === y && f.paymentMonthNumber === m);
const salaryIn = (y: number, m: number) => db.staffPayments.filter((p) => p.paymentYear === y && p.paymentMonthNumber === m);
const expensesInMonth = (y: number, m: number) => db.expenses.filter((e) => ymOfDate(e.expenseDate).y === y && ymOfDate(e.expenseDate).m === m);
const partiesInMonth = (y: number, m: number) => db.parties.filter((p) => ymOfDate(p.eventDate).y === y && ymOfDate(p.eventDate).m === m);
const collegeIn = (y: number, m: number) => db.collegeBillings.filter((r) => r.year === y && r.month === m);

const monthFinance = (y: number, m: number) => {
  const messFees = money(sum(feesIn(y, m), (f) => num(f.amount)));
  const partyIncome = money(sum(partiesInMonth(y, m), (p) => num(p.paidAmount)));
  const collegeBillingIncome = money(sum(collegeIn(y, m), (r) => num(r.amountReceived)));
  const dayToDayExpenses = money(sum(expensesInMonth(y, m), expAmount));
  const staffSalary = money(sum(salaryIn(y, m), (p) => num(p.amount)));
  const income = money(messFees + partyIncome + collegeBillingIncome);
  const expenses = money(dayToDayExpenses + staffSalary);
  const profit = money(income - expenses);
  return { messFees, partyIncome, collegeBillingIncome, income, dayToDayExpenses, staffSalary, expenses, profit };
};

interface Period { start: string; end: string; label: string; scope: string; month?: number; year?: number }
const periodFrom = (scope: string, month?: number, year?: number): Period => {
  const now = new Date();
  if (scope === 'ALL') return { scope, start: '2000-01-01', end: '2099-12-31', label: 'All time' };
  const y = year || now.getFullYear();
  if (scope === 'YEAR') return { scope, year: y, start: `${y}-01-01`, end: `${y}-12-31`, label: `Year ${y}` };
  const m = month || now.getMonth() + 1;
  return { scope: 'MONTH', month: m, year: y, start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDayOf(y, m))}`, label: `${MONTH_NAMES[m - 1]} ${y}` };
};
const ymInPeriod = (pd: Period, y: number, m: number) => {
  const k = ymKey(y, m);
  return k >= ymKey(Number(pd.start.slice(0, 4)), Number(pd.start.slice(5, 7))) && k <= ymKey(Number(pd.end.slice(0, 4)), Number(pd.end.slice(5, 7)));
};

get('/api/billing/summary', (c) => {
  const pd = periodFrom(c.q.get('scope') || 'MONTH', num(c.q.get('month')) || undefined, num(c.q.get('year')) || undefined);
  const cb = db.collegeBillings.filter((r) => ymInPeriod(pd, r.year, r.month));
  const fees = db.fees.filter((f) => ymInPeriod(pd, f.paymentYear, f.paymentMonthNumber));
  const slips = db.staffPayments.filter((p) => ymInPeriod(pd, p.paymentYear, p.paymentMonthNumber));
  const exps = expensesIn(pd.start, pd.end);
  const today = expensesIn(todayISO(), todayISO());
  const parties = db.parties.filter((p) => inRange(p.eventDate, pd.start, pd.end));
  const activeStaff = db.staff.filter((s) => s.status === 'ACTIVE');

  const cbBillable = money(sum(cb, (r) => num(r.totalBillableAmount)));
  const cbReceived = money(sum(cb, (r) => num(r.amountReceived)));
  const cbOutstanding = money(sum(cb, (r) => num(r.outstandingBalance)));
  const feesCollected = money(sum(fees, (f) => num(f.amount)));
  const monthlyRates = sum(activeCandidates(), (x) => num(x.monthlyRate));
  const expected = pd.scope === 'MONTH' ? monthlyRates : pd.scope === 'YEAR' ? monthlyRates * 12 : null;
  const pt = partyTotals(parties);
  const expTotal = money(sum(exps, expAmount));
  const salaryPaid = money(sum(slips, (p) => num(p.amount)));
  const totalRevenue = money(feesCollected + pt.totalPaid + cbReceived);
  const totalExpenses = money(expTotal + salaryPaid);
  const partyPending = pt.totalOutstanding;
  const billed = money(cbBillable + pt.totalRevenue);
  const received = money(cbReceived + pt.totalPaid);

  return {
    scope: pd.scope,
    month: pd.month ?? null,
    year: pd.year ?? null,
    periodLabel: pd.label,
    periodStart: pd.start,
    periodEnd: pd.end,
    generatedAt: nowIso(),
    collegeBilling: { billableAmount: cbBillable, amountReceived: cbReceived, outstandingBalance: cbOutstanding, recordCount: cb.length },
    staffSalary: { monthlyPayroll: sum(activeStaff, (s) => num(s.baseSalary)), activeStaffCount: activeStaff.length, paidInPeriod: salaryPaid, paymentCount: slips.length },
    expenses: { total: expTotal, count: exps.length, categoryBreakdown: byCategory(exps) },
    todayExpense: { date: todayISO(), amount: money(sum(today, expAmount)), count: today.length },
    combinedExpenses: { total: totalExpenses, expenses: expTotal, staffSalaryPaid: salaryPaid, formula: 'Day-to-day expenses + staff salary paid' },
    messFees: {
      collected: feesCollected,
      collectionCount: fees.length,
      expectedMonthly: expected,
      pending: expected === null ? null : Math.max(0, money(expected - feesCollected)),
      collectionRate: expected ? Math.min(100, money((feesCollected / expected) * 100)) : null,
    },
    outstanding: {
      total: money(cbOutstanding + partyPending),
      collegeOutstanding: cbOutstanding,
      partyPending,
      collectionRate: billed > 0 ? money((received / billed) * 100) : null,
      totalBilledReceivables: billed,
      totalReceivedReceivables: received,
    },
    partyIncome: { totalBilled: pt.totalRevenue, received: pt.totalPaid, pending: partyPending, partyCount: pt.totalParties },
    profitLoss: {
      totalRevenue,
      totalExpenses,
      netProfitLoss: money(totalRevenue - totalExpenses),
      messFeesRevenue: feesCollected,
      partyIncome: pt.totalPaid,
      collegeBillingIncome: cbReceived,
      expenses: expTotal,
      staffSalary: salaryPaid,
    },
  };
});

get('/api/billing/profit-loss-chart', (c) => {
  const year = num(c.q.get('year'), new Date().getFullYear());
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const f = monthFinance(year, i + 1);
    return {
      month: i + 1,
      monthName: MONTH_NAMES[i],
      shortName: MONTH_NAMES[i].slice(0, 3),
      ...f,
      profitMargin: f.income > 0 ? money((f.profit / f.income) * 100) : 0,
      hasData: f.income > 0 || f.expenses > 0,
    };
  });
  const t = (k: 'messFees' | 'partyIncome' | 'collegeBillingIncome' | 'income' | 'dayToDayExpenses' | 'staffSalary' | 'expenses' | 'profit') =>
    money(sum(monthlyData, (m) => m[k]));
  const withData = monthlyData.filter((m) => m.hasData);
  return {
    year,
    basis: 'Revenue = mess fees collected + party income received + college billing received. Costs = day-to-day expenses + staff salary paid. Sample data (demo mode).',
    monthlyData,
    totals: {
      messFees: t('messFees'), partyIncome: t('partyIncome'), collegeBillingIncome: t('collegeBillingIncome'), income: t('income'),
      dayToDayExpenses: t('dayToDayExpenses'), staffSalary: t('staffSalary'), expenses: t('expenses'), profit: t('profit'),
      profitableMonths: withData.filter((m) => m.profit >= 0).length,
      lossMonths: withData.filter((m) => m.profit < 0).length,
      monthsWithData: withData.length,
    },
  };
});

const yearlyRows = (year: number) => Array.from({ length: 12 }, (_, i) => {
  const f = monthFinance(year, i + 1);
  return { month: i + 1, income: f.income, expenses: f.dayToDayExpenses, staffSalary: f.staffSalary, profit: f.profit };
});
const yearlyTotals = (rows: ReturnType<typeof yearlyRows>) => ({
  totalIncome: money(sum(rows, (r) => r.income)),
  totalExpenses: money(sum(rows, (r) => r.expenses)),
  totalStaffSalary: money(sum(rows, (r) => r.staffSalary)),
  totalProfit: money(sum(rows, (r) => r.profit)),
});

get('/api/billing/monthly', (c) => {
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  const f = monthFinance(y, m);
  const fees = feesIn(y, m);
  const exps = expensesInMonth(y, m);
  const slips = salaryIn(y, m);
  const parties = partiesInMonth(y, m);
  return {
    totalIncome: f.income,
    totalExpenses: f.dayToDayExpenses,
    totalStaffSalary: f.staffSalary,
    netProfit: f.profit,
    details: {
      feeCollection: { total: f.messFees, count: fees.length, candidates: fees },
      expenses: { total: f.dayToDayExpenses, count: exps.length, details: exps },
      staffSalary: { total: f.staffSalary, count: slips.length, payments: slips },
      partyRevenue: { total: f.partyIncome, count: parties.length, parties },
    },
  };
});
get('/api/billing/yearly/:year', (c) => yearlyRows(num(c.p.year)));
get('/api/billing/report/yearly/:year', (c) => { const rows = yearlyRows(num(c.p.year)); return { yearlyData: rows, ...yearlyTotals(rows) }; });
get('/api/billing/income-expense-comparison', (c) => {
  const rows = yearlyRows(num(c.q.get('year'), new Date().getFullYear()));
  return {
    months: rows.map((r) => r.month), income: rows.map((r) => r.income), expenses: rows.map((r) => r.expenses),
    staffSalary: rows.map((r) => r.staffSalary), profit: rows.map((r) => r.profit),
  };
});
const profitBlock = (rows: Array<{ income: number; expenses: number; staffSalary: number; profit: number }>) => ({
  profit: money(sum(rows, (r) => r.profit)), income: money(sum(rows, (r) => r.income)),
  expenses: money(sum(rows, (r) => r.expenses)), staffSalary: money(sum(rows, (r) => r.staffSalary)),
});
get('/api/billing/current-month-profit', () => {
  const n = new Date();
  const f = monthFinance(n.getFullYear(), n.getMonth() + 1);
  return profitBlock([{ income: f.income, expenses: f.dayToDayExpenses, staffSalary: f.staffSalary, profit: f.profit }]);
});
get('/api/billing/current-year-profit', () => profitBlock(yearlyRows(new Date().getFullYear())));
get('/api/billing/dashboard', () => {
  const n = new Date();
  const y = n.getFullYear();
  const m = n.getMonth() + 1;
  const f = monthFinance(y, m);
  const yr = yearlyRows(y);
  const yt = yearlyTotals(yr);
  const active = activeCandidates();
  const feesNow = feesIn(y, m);
  const expectedNow = sum(active, (x) => num(x.monthlyRate));
  const paidIds = new Set(feesNow.map((x) => x.candidateId));
  const todayExp = expensesIn(todayISO(), todayISO());
  return {
    currentMonthIncome: f.income, currentMonthExpenses: f.expenses, currentMonthProfit: f.profit,
    yearIncome: yt.totalIncome, yearExpenses: money(yt.totalExpenses + yt.totalStaffSalary), yearProfit: yt.totalProfit,
    activeCandidates: active.length, activeStaff: db.staff.filter((s) => s.status === 'ACTIVE').length,
    pendingFees: Math.max(0, expectedNow - sum(feesNow, (x) => num(x.amount))),
    pendingCandidates: active.filter((x) => !paidIds.has(x.id)).length,
    collectionPercentage: expectedNow ? money((sum(feesNow, (x) => num(x.amount)) / expectedNow) * 100) : 0,
    month: m, year: y,
    today: {
      attendance: attendanceCounts(todayISO()),
      meals: mealCounts(db.meals.filter((x) => x.mealDate === todayISO())),
      expenses: { total: money(sum(todayExp, expAmount)), count: todayExp.length },
    },
    currentMonth: { income: f.income, expenses: f.dayToDayExpenses, staffSalary: f.staffSalary, profit: f.profit, feeCollected: f.messFees, partyRevenue: f.partyIncome },
    currentYear: { income: yt.totalIncome, expenses: yt.totalExpenses, staffSalary: yt.totalStaffSalary, profit: yt.totalProfit },
    totalStaff: db.staff.length,
    pendingParties: db.parties.filter((p) => p.paymentStatus !== 'PAID').length,
    lowStockItems: db.stockItems.filter(isLow).length,
  };
});

// ---- fee collection
const decorateFee = (f: Row): Row => ({ ...f, candidateName: f.candidateName || findCandidate(f.candidateId)?.fullName });
const newFee = (b: Row, collectedBy?: string): Row => {
  const cand = requireCandidate(String(b.candidateId));
  const date = day10(b.collectionDate) || todayISO();
  const ym = ymOfDate(date);
  const mn = num(b.paymentMonthNumber, ym.m);
  const method = b.paymentMethod || 'CASH';
  const f: Row = {
    id: newId(),
    ...defined(b),
    candidateId: cand.id,
    candidateName: cand.fullName,
    collectionDate: date,
    amount: num(b.amount),
    paymentMonthNumber: mn,
    paymentYear: num(b.paymentYear, ym.y),
    paymentMonth: b.paymentMonth || MONTH_NAMES[mn - 1],
    paymentMethod: method,
    receiptNumber: b.receiptNumber || `RCPT-${num(b.paymentYear, ym.y)}${pad(mn)}-${String(db.fees.length + 1).padStart(4, '0')}`,
    collectedByCandidateId: collectedBy || b.collectedByCandidateId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  if (!(f.amount > 0)) fail('Amount must be greater than zero');
  db.fees.push(f);
  return f;
};
post('/api/billing/fees/bulk', (c) => {
  const b = c.body;
  const fees = (b.candidateFees || []).map((cf: Row) => newFee({
    candidateId: cf.candidateId, amount: cf.amount, remarks: cf.remarks, collectionDate: b.collectionDate, paymentMonth: b.paymentMonth,
    paymentYear: b.paymentYear, paymentMonthNumber: b.paymentMonthNumber, paymentMethod: b.paymentMethod,
  }, b.collectedByCandidateId));
  return { success: true, message: `Collected ${fees.length} fee(s)`, fees };
});
post('/api/billing/fees', (c) => newFee(c.body));
get('/api/billing/fees/month', (c) => {
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  return feesIn(y, m).map(decorateFee);
});
get('/api/billing/fees/summary', (c) => {
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  const fees = feesIn(y, m);
  const relevant = db.candidates.filter((x) => x.status === 'ACTIVE' || fees.some((f) => f.candidateId === x.id));
  const candidateFees = relevant.map((cand) => {
    const mine = fees.filter((f) => f.candidateId === cand.id);
    const paidAmount = money(sum(mine, (f) => num(f.amount)));
    const rate = num(cand.monthlyRate);
    const last = [...mine].sort((a, b) => (a.collectionDate < b.collectionDate ? 1 : -1))[0];
    return {
      candidateId: cand.id, candidateName: cand.fullName, monthlyRate: rate, paidAmount,
      pendingAmount: Math.max(0, money(rate - paidAmount)), isPaid: rate > 0 ? paidAmount >= rate : paidAmount > 0, paymentDate: last?.collectionDate,
    };
  });
  const totalExpectedFees = money(sum(candidateFees, (x) => x.monthlyRate));
  const totalCollectedFees = money(sum(candidateFees, (x) => x.paidAmount));
  return {
    month: m, year: y, monthName: MONTH_NAMES[m - 1],
    totalCandidates: candidateFees.length,
    paidCandidates: candidateFees.filter((x) => x.isPaid).length,
    pendingCandidates: candidateFees.filter((x) => !x.isPaid).length,
    totalExpectedFees, totalCollectedFees,
    pendingAmount: money(sum(candidateFees, (x) => x.pendingAmount)),
    collectionPercentage: totalExpectedFees ? money((totalCollectedFees / totalExpectedFees) * 100) : 0,
    candidateFees,
  };
});
get('/api/billing/fees/candidate/:cid', (c) => {
  const cid = canonCandidateId(c.p.cid);
  return db.fees.filter((f) => f.candidateId === cid).sort((a, b) => (a.collectionDate < b.collectionDate ? 1 : -1)).map(decorateFee);
});
get('/api/billing/fees/:id', (c) => decorateFee(db.fees.find((f) => f.id === c.p.id) || fail('Fee record not found')));
del('/api/billing/fees/:id', (c) => {
  const f = db.fees.find((x) => x.id === c.p.id) || fail('Fee record not found');
  db.fees = db.fees.filter((x) => x !== f);
  return {};
});
post('/api/billing/generate', (c) => {
  const billings = activeCandidates().map((x) => ({ candidateId: x.id, amount: num(x.monthlyRate) }));
  return { success: true, message: `Generated ${billings.length} bill(s) for ${MONTH_NAMES[num(c.q.get('month'), 1) - 1] || ''} ${c.q.get('year') || ''}`.trim(), billings };
});
post('/api/billing/generate-all', () => ({ success: true, message: 'Monthly bills generated', generated: activeCandidates().length }));

// ====================================================================== MENUS
const requireMenu = (id: string): Row => db.menus.find((m) => m.id === id) || fail('Menu not found');
const MEAL_ORDER: Record<string, number> = { BREAKFAST: 0, LUNCH: 1, SNACKS: 2, DINNER: 3 };
const sortMenus = (list: Row[]) => [...list].sort((a, b) => (a.menuDate < b.menuDate ? -1 : a.menuDate > b.menuDate ? 1 : (MEAL_ORDER[a.mealType] ?? 9) - (MEAL_ORDER[b.mealType] ?? 9)));
const menusIn = (s: string, e: string) => sortMenus(db.menus.filter((m) => inRange(m.menuDate, s, e)));
const normItem = (it: Row, k: number): Row => ({ id: newId(), isAvailable: true, isVegetarian: true, category: 'Main Course', displayOrder: k + 1, ...defined(it) });
const normMenu = (m: Row): Row => {
  m.menuDate = day10(m.menuDate) || todayISO();
  m.items = (Array.isArray(m.items) ? m.items : []).map((it: Row, k: number) => normItem(it, k));
  m.status = m.status || 'ACTIVE';
  m.isSpecial = !!m.isSpecial;
  m.updatedAt = nowIso();
  return m;
};
const weekDates = (start: string): string[] => {
  const [y, mo, d] = start.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => isoDate(addDays(new Date(y, mo - 1, d), i)));
};
const copyMenu = (src: Row, date: string, mealType: string): Row => {
  const m: Row = {
    ...clone(src), id: newId(), menuDate: date, mealType, createdAt: nowIso(),
    items: (src.items as Row[]).map((it) => ({ ...clone(it), id: newId() })),
  };
  db.menus.push(m);
  return m;
};

get('/api/menus/today', () => menusIn(todayISO(), todayISO()));
get('/api/menus/weekly-plan', (c) => {
  const dates = weekDates(c.q.get('startDate') || todayISO());
  return dates.map((d) => ({
    day: new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
    meals: menusIn(d, d),
  }));
});
get('/api/menus/weekly', (c) => { const d = weekDates(c.q.get('startDate') || todayISO()); return menusIn(d[0], d[6]); });
get('/api/menus/monthly', (c) => {
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  return menusIn(`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(lastDayOf(y, m))}`);
});
get('/api/menus/range', (c) => menusIn(...range(c)));
get('/api/menus/summary', (c) => {
  const list = menusIn(...range(c));
  const categories: Record<string, number> = {};
  let totalItems = 0;
  list.forEach((m) => (m.items as Row[]).forEach((it) => { totalItems++; categories[it.category] = (categories[it.category] || 0) + 1; }));
  return { totalMenus: list.length, totalItems, categories };
});
get('/api/menus/popular-items', (c) => {
  const counts = new Map<string, { itemName: string; count: number; category: string }>();
  menusIn(...range(c)).forEach((m) => (m.items as Row[]).forEach((it) => {
    const e = counts.get(it.itemName) || { itemName: it.itemName, count: 0, category: it.category };
    e.count++;
    counts.set(it.itemName, e);
  }));
  return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 10);
});
get('/api/menus/date/:date/meal/:type', (c) => db.menus.find((m) => m.menuDate === c.p.date && m.mealType === c.p.type.toUpperCase()) || fail('Menu not found'));
get('/api/menus/date/:date', (c) => menusIn(c.p.date, c.p.date));
post('/api/menus/copy-weekly', (c) => {
  const src = weekDates(c.q.get('sourceWeekStart') || todayISO());
  const dst = weekDates(c.q.get('targetWeekStart') || todayISO());
  let copied = 0;
  src.forEach((d, i) => menusIn(d, d).forEach((m) => {
    if (!db.menus.some((x) => x.menuDate === dst[i] && x.mealType === m.mealType)) { copyMenu(m, dst[i], m.mealType); copied++; }
  }));
  return { success: true, message: `Copied ${copied} menu(s)`, copied };
});
post('/api/menus/copy', (c) => {
  const src = requireMenu(c.q.get('sourceMenuId') || '');
  return copyMenu(src, c.q.get('targetDate') || todayISO(), c.q.get('mealType') || src.mealType);
});
post('/api/menus', (c) => {
  const m: Row = normMenu({ id: newId(), menuName: 'Menu', mealType: 'LUNCH', createdAt: nowIso(), ...defined(c.body) });
  db.menus.push(m);
  return m;
});
get('/api/menus/:id', (c) => requireMenu(c.p.id));
put('/api/menus/:id', (c) => {
  const m = requireMenu(c.p.id);
  const b = defined(c.body);
  delete b.id;
  if (!Array.isArray(b.items)) delete b.items;
  Object.assign(m, b);
  return normMenu(m);
});
del('/api/menus/:id', (c) => { const m = requireMenu(c.p.id); db.menus = db.menus.filter((x) => x !== m); return {}; });
patch('/api/menus/:id/toggle', (c) => { const m = requireMenu(c.p.id); m.status = m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'; m.updatedAt = nowIso(); return m; });
post('/api/menus/:id/items', (c) => {
  const m = requireMenu(c.p.id);
  const it = normItem(c.body, (m.items as Row[]).length);
  (m.items as Row[]).push(it);
  m.updatedAt = nowIso();
  return it;
});
patch('/api/menus/:id/items/:itemId/availability', (c) => {
  const it = ((requireMenu(c.p.id).items as Row[]).find((x) => x.id === c.p.itemId)) || fail('Menu item not found');
  it.isAvailable = c.q.get('available') === 'true';
  return it;
});
put('/api/menus/:id/items/:itemId', (c) => {
  const it = ((requireMenu(c.p.id).items as Row[]).find((x) => x.id === c.p.itemId)) || fail('Menu item not found');
  const b = defined(c.body);
  delete b.id;
  return Object.assign(it, b);
});
del('/api/menus/:id/items/:itemId', (c) => {
  const m = requireMenu(c.p.id);
  m.items = (m.items as Row[]).filter((x) => x.id !== c.p.itemId);
  return {};
});

// ====================================================================== REPORTS
const reportRange = (start: string, end: string) => {
  const att = db.attendance.filter((a) => inRange(a.attendanceDate, start, end));
  const present = att.filter((a) => PRESENT.has(a.status)).length;
  const meals = db.meals.filter((m) => inRange(m.mealDate, start, end));
  const exps = expensesIn(start, end);
  const fees = db.fees.filter((f) => inRange(f.collectionDate, start, end));
  const parties = partiesIn(start, end);
  const slips = db.staffPayments.filter((p) => inRange(p.paymentDate, start, end));
  const partyRevenue = money(sum(parties, (p) => num(p.paidAmount)));
  const feeTotal = money(sum(fees, (f) => num(f.amount)));
  const expTotal = money(sum(exps, expAmount));
  const salary = money(sum(slips, (p) => num(p.amount)));
  return {
    candidates: { total: db.candidates.length, active: activeCandidates().length, left: db.candidates.filter((x) => x.status === 'LEFT').length },
    attendance: { present, absent: att.length - present, total: att.length },
    meals: mealCounts(meals),
    expenses: { total: expTotal, count: exps.length },
    feeCollection: { total: feeTotal, count: fees.length },
    partyRevenue: { total: partyRevenue, count: parties.length },
    staffSalary: { total: salary, count: slips.length },
    profit: money(feeTotal + partyRevenue - expTotal - salary),
  };
};
get('/api/reports/monthly', (c) => {
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  return reportRange(`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(lastDayOf(y, m))}`);
});
get('/api/reports/custom', (c) => reportRange(...range(c)));
get('/api/reports/yearly', (c) => {
  const y = num(c.q.get('year'), new Date().getFullYear());
  const rows = yearlyRows(y);
  return { monthlyData: rows, ...yearlyTotals(rows) };
});
get('/api/reports/profit-loss', (c) => {
  const rows = yearlyRows(num(c.q.get('year'), new Date().getFullYear()));
  return { yearlySummary: yearlyTotals(rows), monthlyData: rows };
});
get('/api/reports/candidate', (c) => {
  const [s, e] = range(c);
  const att: Record<string, number> = {};
  const meals: Record<string, number> = {};
  db.attendance.filter((a) => inRange(a.attendanceDate, s, e) && PRESENT.has(a.status)).forEach((a) => { att[a.candidateId] = (att[a.candidateId] || 0) + 1; });
  db.meals.filter((m) => inRange(m.mealDate, s, e) && m.isTaken).forEach((m) => { meals[m.candidateId] = (meals[m.candidateId] || 0) + 1; });
  return { candidates: db.candidates, attendance: att, meals, feeHistory: db.fees.filter((f) => inRange(f.collectionDate, s, e)) };
});
get('/api/reports/attendance', (c) => {
  const [s, e] = range(c);
  const list = db.attendance.filter((a) => inRange(a.attendanceDate, s, e));
  const present = list.filter((a) => PRESENT.has(a.status)).length;
  const dates = Array.from(new Set(list.map((a) => a.attendanceDate))).sort();
  return {
    summary: { present, absent: list.length - present, total: list.length },
    dailyData: dates.map((d) => {
      const day = list.filter((a) => a.attendanceDate === d);
      const p = day.filter((a) => PRESENT.has(a.status)).length;
      return { date: d, present: p, absent: day.length - p };
    }),
    candidateWise: db.candidates.map((cand) => {
      const mine = list.filter((a) => a.candidateId === cand.id);
      const p = mine.filter((a) => PRESENT.has(a.status)).length;
      return { candidate: cand, present: p, absent: mine.length - p };
    }),
  };
});
get('/api/reports/expense', (c) => {
  const list = expensesIn(...range(c));
  const dates = Array.from(new Set(list.map((x) => x.expenseDate))).sort();
  return {
    total: money(sum(list, expAmount)), count: list.length, categoryWise: byCategory(list),
    dailyData: dates.map((d) => ({ date: d, total: money(sum(list.filter((x) => x.expenseDate === d), expAmount)) })),
    expenses: sortExpenses(list),
  };
});
get('/api/reports/stock', () => {
  const categoryWise: Record<string, { count: number; value: number }> = {};
  db.stockItems.forEach((i) => {
    const e = categoryWise[i.category] || { count: 0, value: 0 };
    e.count++;
    e.value = money(e.value + num(i.currentStock) * num(i.unitPrice));
    categoryWise[i.category] = e;
  });
  return {
    totalItems: db.stockItems.length,
    totalValue: money(sum(db.stockItems, (i) => num(i.currentStock) * num(i.unitPrice))),
    lowStockItems: db.stockItems.filter(isLow),
    categoryWise,
    items: sortItems(db.stockItems),
  };
});
get('/api/reports/staff', (c) => {
  const [s, e] = range(c);
  const positionWise: Record<string, { count: number; totalSalary: number }> = {};
  db.staff.forEach((st) => {
    const x = positionWise[st.position] || { count: 0, totalSalary: 0 };
    x.count++;
    x.totalSalary += num(st.baseSalary);
    positionWise[st.position] = x;
  });
  return {
    totalStaff: db.staff.length,
    totalSalary: sum(db.staff, (st) => num(st.baseSalary)),
    positionWise,
    payments: db.staffPayments.filter((p) => inRange(p.paymentDate, s, e)).map(decoratePayment),
    advances: db.advances.filter((a) => inRange(a.advanceDate, s, e)),
  };
});
get('/api/reports/billing', (c) => {
  const m = num(c.q.get('month'), new Date().getMonth() + 1);
  const y = num(c.q.get('year'), new Date().getFullYear());
  const f = monthFinance(y, m);
  return {
    feeCollection: { total: f.messFees, count: feesIn(y, m).length, candidates: feesIn(y, m) },
    partyRevenue: { total: f.partyIncome, count: partiesInMonth(y, m).length, parties: partiesInMonth(y, m) },
    totalIncome: f.income,
  };
});
get('/api/reports/party', (c) => {
  const [s, e] = range(c);
  const list = partiesIn(s, e);
  const dates = Array.from(new Set(list.map((p) => p.eventDate))).sort();
  return {
    ...partyTotals(list),
    parties: sortParties(list),
    dailyData: dates.map((d) => {
      const day = list.filter((p) => p.eventDate === d);
      return { date: d, count: day.length, revenue: money(sum(day, partyBill)) };
    }),
  };
});
get('/api/reports/menu', (c) => {
  const list = menusIn(...range(c));
  const categoryWise: Record<string, number> = {};
  const pop = new Map<string, number>();
  let totalItems = 0;
  list.forEach((m) => (m.items as Row[]).forEach((it) => {
    totalItems++;
    categoryWise[it.category] = (categoryWise[it.category] || 0) + 1;
    pop.set(it.itemName, (pop.get(it.itemName) || 0) + 1);
  }));
  return {
    totalMenus: list.length, totalItems, categoryWise, menus: list,
    popularItems: Array.from(pop.entries()).map(([itemName, count]) => ({ itemName, count })).sort((a, b) => b.count - a.count).slice(0, 10),
  };
});
const exportStub = () => ({ success: true, message: 'Demo mode: file exports are not generated in the sample workspace.' });
post('/api/reports/generate', exportStub);
post('/api/reports/export/pdf', exportStub);
post('/api/reports/export/excel', exportStub);
post('/api/reports/export/csv', exportStub);

// ====================================================================== entry point
const parseBody = (raw: unknown): { body: Row; form?: FormData } => {
  if (raw === null || raw === undefined) return { body: {} };
  if (isFormData(raw)) return { body: {}, form: raw };
  if (typeof raw === 'string') {
    if (!raw.trim()) return { body: {} };
    try {
      const parsed = JSON.parse(raw);
      return { body: parsed && typeof parsed === 'object' ? parsed : {} };
    } catch { return { body: {} }; }
  }
  return { body: {} };
};

/** Number of registered API routes (handy for diagnostics / tests). */
export const getDemoRouteCount = (): number => routes.length;

export async function handleDemoRequest(method: string, endpoint: string, body?: BodyInit | null): Promise<unknown> {
  await sleep(80 + Math.random() * 70);
  const verb = (method || 'GET').toUpperCase();
  const qIdx = endpoint.indexOf('?');
  const path = qIdx === -1 ? endpoint : endpoint.slice(0, qIdx);
  const q = new URLSearchParams(qIdx === -1 ? '' : endpoint.slice(qIdx + 1));
  const { body: parsed, form } = parseBody(body);

  for (const r of routes) {
    if (r.method !== verb) continue;
    const m = r.re.exec(path);
    if (!m) continue;
    const p: Record<string, string> = {};
    r.keys.forEach((k, i) => {
      try { p[k] = decodeURIComponent(m[i + 1]); } catch { p[k] = m[i + 1]; }
    });
    const result = r.h({ method: verb, p, q, body: parsed, form });
    return result === undefined ? {} : clone(result);
  }
  throw new Error(`Demo mode: ${method} ${endpoint} is not available`);
}
