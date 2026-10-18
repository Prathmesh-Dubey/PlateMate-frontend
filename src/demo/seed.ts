// src/demo/seed.ts
// Builds the initial in-memory data set for demo mode. Everything is fictional (names, phone numbers,
// vendors, colleges) and is generated relative to TODAY so the app always looks current.
// This module has no side effects: mockBackend.ts calls buildSeed() once per page load.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Seed {
  candidates: Row[];
  attendance: Row[];
  meals: Row[];
  fees: Row[];
  expenses: Row[];
  departments: Row[];
  stockItems: Row[];
  stockTx: Row[];
  staff: Row[];
  staffPayments: Row[];
  advances: Row[];
  parties: Row[];
  partyPayments: Row[];
  menus: Row[];
  collegeBillings: Row[];
}

// ------------------------------------------------------------------ date helpers
const pad = (n: number) => String(n).padStart(2, '0');

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local-time ISO date (YYYY-MM-DD) */
export const isoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = (): string => isoDate(new Date());

export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const daysFromToday = (n: number): string => isoDate(addDays(new Date(), n));

/** Adds calendar months (clamping the day) to an ISO date */
export const addMonthsISO = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return isoDate(new Date(target.getFullYear(), target.getMonth(), Math.min(d, last)));
};

/** Year / month (1-12) that is `offset` months before the current month */
export const monthAt = (offset: number): { y: number; m: number } => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
};

/** ISO date for `day` in the given month, clamped to the month's length; null when it lies in the future */
const dateIn = (y: number, m: number, day: number): string | null => {
  const last = new Date(y, m, 0).getDate();
  const iso = `${y}-${pad(m)}-${pad(Math.min(day, last))}`;
  return iso > todayISO() ? null : iso;
};

// ------------------------------------------------------------------ random helpers
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: string) => `${d}T09:00:00`;

// ------------------------------------------------------------------ builder
export function buildSeed(): Seed {
  const rng = mulberry32(20260101);
  const rand = (min: number, max: number) => min + rng() * (max - min);
  const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const round = (n: number, step = 1) => Math.round(n / step) * step;
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join('');
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rng() * 10)).join('');
  const nowIso = new Date().toISOString();

  const seed: Seed = {
    candidates: [], attendance: [], meals: [], fees: [], expenses: [], departments: [],
    stockItems: [], stockTx: [], staff: [], staffPayments: [], advances: [], parties: [],
    partyPayments: [], menus: [], collegeBillings: [],
  };

  // ============================================================ DEPARTMENTS
  const deptDefs: Array<[string, string, string, string]> = [
    ['CSE', 'Department of Computer Science', 'Dr. Anita Verma', '9000003001'],
    ['ECE', 'Department of Electronics', 'Dr. Prakash Rao', '9000003002'],
    ['MECH', 'Department of Mechanical Engineering', 'Dr. Sanjay Kulkarni', '9000003003'],
    ['CIVIL', 'Department of Civil Engineering', 'Dr. Neelam Joshi', '9000003004'],
    ['MBA', 'School of Management Studies', 'Dr. Rohit Malhotra', '9000003005'],
    ['PHY', 'Department of Physics', 'Dr. Kavita Menon', '9000003006'],
  ];
  const departments = deptDefs.map(([code, name, head, phone]) => ({
    id: uuid(), code, name, headName: head,
    contactEmail: `${code.toLowerCase()}@sample-college.example`, contactPhone: phone,
    active: true, remarks: '', createdAt: nowIso, updatedAt: nowIso,
  }));
  seed.departments = departments;

  // ============================================================ CANDIDATES (mess members)
  interface MemberDef {
    name: string; diet: string; room: string; rate: number; renewedDaysAgo: number;
    status: 'ACTIVE' | 'LEFT' | 'INACTIVE'; sinceOffset: number; leftDaysAgo?: number; unpaidNow?: boolean;
    notes?: string;
  }
  const memberDefs: MemberDef[] = [
    { name: 'Aarav Mehta', diet: 'VEG', room: 'A-101', rate: 4200, renewedDaysAgo: 4, status: 'ACTIVE', sinceOffset: 6 },
    { name: 'Diya Nair', diet: 'VEG', room: 'B-204', rate: 3800, renewedDaysAgo: 9, status: 'ACTIVE', sinceOffset: 6 },
    { name: 'Rohan Deshpande', diet: 'NON_VEG', room: 'A-105', rate: 4200, renewedDaysAgo: 17, status: 'ACTIVE', sinceOffset: 6 },
    { name: 'Ishita Kulkarni', diet: 'VEG', room: 'B-210', rate: 3800, renewedDaysAgo: 21, status: 'ACTIVE', sinceOffset: 5 },
    { name: 'Kabir Rathore', diet: 'NON_VEG', room: 'A-112', rate: 4500, renewedDaysAgo: 27, status: 'ACTIVE', sinceOffset: 6, unpaidNow: true },
    { name: 'Meera Iyer', diet: 'JAIN', room: 'B-201', rate: 3800, renewedDaysAgo: 29, status: 'ACTIVE', sinceOffset: 4, unpaidNow: true, notes: 'No onion / garlic' },
    { name: 'Siddharth Joshi', diet: 'NON_VEG', room: 'A-118', rate: 4200, renewedDaysAgo: 33, status: 'ACTIVE', sinceOffset: 5, unpaidNow: true },
    { name: 'Tanvi Patil', diet: 'VEG', room: 'B-215', rate: 4500, renewedDaysAgo: 12, status: 'ACTIVE', sinceOffset: 3 },
    { name: 'Vikram Chauhan', diet: 'NON_VEG', room: 'A-103', rate: 4200, renewedDaysAgo: 45, status: 'LEFT', sinceOffset: 5, leftDaysAgo: 20 },
    { name: 'Neha Bhatt', diet: 'VEG', room: 'B-207', rate: 3800, renewedDaysAgo: 80, status: 'LEFT', sinceOffset: 6, leftDaysAgo: 55 },
    { name: 'Yash Agarwal', diet: 'VEG', room: 'A-120', rate: 4000, renewedDaysAgo: 48, status: 'INACTIVE', sinceOffset: 4 },
    { name: 'Pooja Reddy', diet: 'VEG', room: 'B-218', rate: 3800, renewedDaysAgo: 6, status: 'ACTIVE', sinceOffset: 2 },
  ];

  const payMethods = ['UPI', 'CASH', 'UPI', 'BANK_TRANSFER', 'UPI'];
  const nowDate = new Date();
  const todayDay = nowDate.getDate();

  memberDefs.forEach((def, idx) => {
    const id = uuid();
    const parts = def.name.split(' ');
    const joiningDate = daysFromToday(-def.renewedDaysAgo);
    const sinceMonth = monthAt(def.sinceOffset);
    const phone = `90000${String(10001 + idx).padStart(5, '0')}`;
    const cand: Row = {
      id,
      candidateId: `MBR-${String(idx + 1).padStart(3, '0')}`,
      fullName: def.name,
      phoneNumber: phone,
      phone,
      email: `${parts[0].toLowerCase()}.${parts[parts.length - 1].toLowerCase()}@example.com`,
      address: 'Hostel Block ' + def.room.charAt(0) + ', Sample Nagar Campus',
      roomNumber: def.room,
      joiningDate,
      endDate: addMonthsISO(joiningDate, 1),
      monthlyRate: def.rate,
      monthlyFee: def.rate,
      status: def.status,
      dietaryPreference: def.diet,
      emergencyContact: `Mr. ${parts[parts.length - 1]} (Guardian)`,
      emergencyPhone: `90000${String(20001 + idx).padStart(5, '0')}`,
      notes: def.notes || '',
      createdAt: `${sinceMonth.y}-${pad(sinceMonth.m)}-01T10:00:00`,
      updatedAt: nowIso,
    };
    if (def.status === 'LEFT') cand.leavingDate = daysFromToday(-(def.leftDaysAgo || 0));
    seed.candidates.push(cand);

    // Monthly fee history for this member
    const leftIso: string | undefined = cand.leavingDate;
    for (let off = def.sinceOffset; off >= 0; off--) {
      const { y, m } = monthAt(off);
      if (leftIso) {
        const ly = Number(leftIso.slice(0, 4));
        const lm = Number(leftIso.slice(5, 7));
        if (y * 12 + m > ly * 12 + lm) continue;
      }
      if (def.status === 'INACTIVE' && off < 2) continue;
      if (off === 0 && (def.status !== 'ACTIVE' || def.unpaidNow)) continue;
      let day = randInt(2, 9);
      if (off === 0) day = Math.max(1, Math.min(day, todayDay));
      const date = dateIn(y, m, day);
      if (!date) continue;
      const method = pick(payMethods);
      seed.fees.push({
        id: uuid(),
        candidateId: id,
        candidateName: def.name,
        collectionDate: date,
        amount: def.rate,
        paymentMonth: MONTH_NAMES[m - 1],
        paymentYear: y,
        paymentMonthNumber: m,
        paymentMethod: method,
        transactionId: method === 'UPI' ? `UPI${digits(12)}` : undefined,
        receiptNumber: `RCPT-${y}${pad(m)}-${String(idx + 1).padStart(3, '0')}`,
        remarks: `Monthly fee for ${MONTH_NAMES[m - 1]} ${y}`,
        createdAt: iso(date),
        updatedAt: iso(date),
      });
    }
  });

  // Attendance + meals for the last week (active members only)
  const activeMembers = seed.candidates.filter((c) => c.status === 'ACTIVE');
  for (let back = 6; back >= 0; back--) {
    const date = daysFromToday(-back);
    activeMembers.forEach((c) => {
      const present = rng() > 0.1;
      seed.attendance.push({
        id: uuid(), candidateId: c.id, attendanceDate: date,
        status: present ? 'IN' : 'ABSENT',
        inTime: present ? '07:45' : undefined, outTime: present && back > 0 ? '21:30' : undefined,
        remarks: '', createdAt: iso(date), updatedAt: iso(date),
      });
      (['BREAKFAST', 'LUNCH', 'DINNER'] as const).forEach((mealType) => {
        if (back === 0 && mealType === 'DINNER') return;
        seed.meals.push({
          id: uuid(), candidateId: c.id, mealDate: date, mealType,
          isTaken: present && rng() > 0.12, mealPreference: c.dietaryPreference === 'NON_VEG' ? 'NON_VEG' : 'VEG',
          remarks: '', createdAt: iso(date), updatedAt: iso(date),
        });
      });
    });
  }

  // ============================================================ STOCK ITEMS
  type StockDef = [string, string, string, number, number, number, number, number | null, string, string?];
  // name, category, unit, current, min, max, unitPrice, expiry days from today, supplier, subCategory
  const stockDefs: StockDef[] = [
    ['Toor Dal', 'PULSES', 'kg', 85, 40, 200, 142, 160, 'Annapurna Provision Store'],
    ['Moong Dal', 'PULSES', 'kg', 22, 30, 120, 118, 140, 'Annapurna Provision Store'],
    ['Chana Dal', 'PULSES', 'kg', 60, 25, 150, 96, 200, 'Annapurna Provision Store'],
    ['Masoor Dal', 'PULSES', 'kg', 48, 20, 120, 88, 150, 'Annapurna Provision Store'],
    ['Basmati Rice', 'GRAINS', 'kg', 240, 100, 600, 92, 300, 'Annapurna Provision Store'],
    ['Wheat Flour (Atta)', 'GRAINS', 'kg', 180, 80, 500, 41, 75, 'Annapurna Provision Store'],
    ['Poha', 'GRAINS', 'kg', 14, 15, 60, 58, 90, 'Annapurna Provision Store'],
    ['Sooji (Rava)', 'GRAINS', 'kg', 35, 15, 80, 46, 120, 'Annapurna Provision Store'],
    ['Sunflower Oil', 'OILS', 'liter', 64, 30, 150, 138, 180, 'Sai Oil Traders'],
    ['Mustard Oil', 'OILS', 'liter', 9, 10, 40, 165, 200, 'Sai Oil Traders'],
    ['Turmeric Powder', 'SPICES', 'kg', 8, 3, 20, 210, 240, 'Masala Mart Wholesale'],
    ['Red Chilli Powder', 'SPICES', 'kg', 11, 4, 25, 260, 220, 'Masala Mart Wholesale'],
    ['Garam Masala', 'SPICES', 'kg', 1.5, 2, 12, 520, 210, 'Masala Mart Wholesale'],
    ['Cumin Seeds', 'SPICES', 'kg', 6, 2.5, 20, 380, 260, 'Masala Mart Wholesale'],
    ['Iodised Salt', 'SPICES', 'kg', 40, 15, 80, 22, 400, 'Annapurna Provision Store'],
    ['Sugar', 'OTHERS', 'kg', 70, 30, 200, 44, 300, 'Annapurna Provision Store', 'Sweeteners'],
    ['Milk (Full Cream)', 'DAIRY', 'liter', 90, 60, 200, 56, 2, 'Fresh Farm Dairy Supplies'],
    ['Paneer', 'DAIRY', 'kg', 12, 5, 30, 340, -2, 'Fresh Farm Dairy Supplies'],
    ['Curd', 'DAIRY', 'kg', 25, 15, 60, 70, 5, 'Fresh Farm Dairy Supplies'],
    ['Ghee', 'DAIRY', 'kg', 18, 6, 40, 620, 120, 'Fresh Farm Dairy Supplies'],
    ['Potato', 'VEGETABLES', 'kg', 120, 50, 300, 28, 10, 'Shree Sai Vegetable Mart'],
    ['Onion', 'VEGETABLES', 'kg', 95, 50, 250, 32, 14, 'Shree Sai Vegetable Mart'],
    ['Tomato', 'VEGETABLES', 'kg', 30, 35, 120, 36, 4, 'Shree Sai Vegetable Mart'],
    ['Tea Powder', 'BEVERAGES', 'kg', 12, 5, 30, 380, 150, 'Annapurna Provision Store'],
    ['Commercial LPG Cylinder (19 kg)', 'OTHERS', 'piece', 3, 2, 8, 1950, null, 'Jyoti Gas Agency (demo)', 'Fuel'],
    ['Dishwash Liquid', 'OTHERS', 'liter', 6, 5, 30, 120, null, 'Clean Mart Supplies', 'Cleaning'],
  ];

  const stockItems: Row[] = stockDefs.map(([name, cat, unit, cur, min, max, price, expDays, supplier, sub], i) => ({
    id: uuid(),
    itemName: name,
    category: cat,
    subCategory: sub || '',
    unit,
    currentStock: cur,
    minimumStockLevel: min,
    maximumStockLevel: max,
    unitPrice: price,
    expiryDate: expDays === null ? undefined : daysFromToday(expDays),
    description: '',
    supplierName: supplier,
    supplierContact: `90000${String(40001 + i).padStart(5, '0')}`,
    status: 'ACTIVE',
    images: [],
    imageUrls: [],
    createdAt: iso(daysFromToday(-100)),
    updatedAt: nowIso,
  }));
  seed.stockItems = stockItems;

  // ~40 transactions over the last 3 months, generated backwards from each item's current stock so the
  // before/after numbers always chain correctly.
  const txCounts: Record<number, number> = { 0: 2, 1: 2, 4: 2, 5: 2, 8: 2, 9: 1, 16: 3, 17: 2, 20: 2, 21: 2, 22: 2, 24: 2, 6: 1, 12: 1, 3: 1, 11: 1, 18: 1, 19: 1, 13: 1, 23: 1, 7: 1, 10: 1, 25: 1, 2: 1, 14: 1, 15: 1 };
  Object.entries(txCounts).forEach(([idxStr, count]) => {
    const item = stockItems[Number(idxStr)];
    const dates = Array.from({ length: count }, () => randInt(1, 88)).sort((a, b) => b - a); // oldest first
    let after = item.currentStock as number;
    const typical = (item.maximumStockLevel as number) * 0.3;
    const built: Row[] = [];
    for (let k = dates.length - 1; k >= 0; k--) {
      let type: 'PURCHASE' | 'USAGE' = rng() < 0.45 ? 'PURCHASE' : 'USAGE';
      const unitInt = item.unit === 'piece';
      let qty = unitInt ? randInt(1, 2) : round(rand(typical * 0.4, typical * 1.1), item.currentStock < 20 ? 0.5 : 1);
      if (qty <= 0) qty = unitInt ? 1 : 1;
      let before = type === 'PURCHASE' ? after - qty : after + qty;
      if (before < 0) {
        type = 'USAGE';
        before = after + qty;
      }
      const date = daysFromToday(-dates[k]);
      built.push({
        id: uuid(),
        stockItemId: item.id,
        stockItemName: item.itemName,
        transactionType: type,
        quantity: qty,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalAmount: round(qty * item.unitPrice, 1),
        stockBefore: before,
        stockAfter: after,
        transactionDate: date,
        referenceNumber: type === 'PURCHASE' ? `PO-${randInt(1000, 9999)}` : 'KITCHEN_USAGE',
        referenceType: type === 'PURCHASE' ? 'PURCHASE_ORDER' : 'KITCHEN',
        remarks: type === 'PURCHASE' ? `Restock from ${item.supplierName}` : 'Daily kitchen consumption',
        enteredBy: 'Demo Visitor',
        createdAt: `${date}T${pad(8 + k)}:00:00`,
      });
      after = before;
    }
    seed.stockTx.push(...built);
  });
  seed.stockTx.sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1));

  // ============================================================ STAFF
  interface StaffDef { name: string; pos: string; salary: number; joinedMonthsAgo: number; address: string }
  const staffDefs: StaffDef[] = [
    { name: 'Suresh Patil', pos: 'HEAD_COOK', salary: 22000, joinedMonthsAgo: 38, address: 'Lane 4, Sample Nagar' },
    { name: 'Lata Shinde', pos: 'ASSISTANT_COOK', salary: 16000, joinedMonthsAgo: 24, address: 'Lane 9, Sample Nagar' },
    { name: 'Manoj Pawar', pos: 'KITCHEN_HELPER', salary: 11000, joinedMonthsAgo: 14, address: 'Old Market Road' },
    { name: 'Savita Gaikwad', pos: 'KITCHEN_HELPER', salary: 10500, joinedMonthsAgo: 9, address: 'Lane 2, Green Park' },
    { name: 'Ganesh More', pos: 'CLEANER', salary: 9000, joinedMonthsAgo: 5, address: 'Station Road' },
    { name: 'Rajesh Kulkarni', pos: 'MESS_MANAGER', salary: 20000, joinedMonthsAgo: 30, address: 'Lane 7, Sample Nagar' },
  ];
  const staffRows: Row[] = staffDefs.map((s, i) => {
    const parts = s.name.split(' ');
    const joiningDate = addMonthsISO(todayISO(), -s.joinedMonthsAgo);
    return {
      id: uuid(),
      staffId: `STF-${String(i + 1).padStart(3, '0')}`,
      fullName: s.name,
      position: s.pos,
      phoneNumber: `90000${String(50001 + i).padStart(5, '0')}`,
      email: `${parts[0].toLowerCase()}.${parts[1].toLowerCase()}@example.com`,
      address: s.address,
      joiningDate,
      baseSalary: s.salary,
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      emergencyContact: `${parts[0]}'s family`,
      emergencyPhone: `90000${String(60001 + i).padStart(5, '0')}`,
      bankName: 'Sample Bank (demo)',
      bankAccountNumber: `0000${digits(10)}`,
      ifscCode: 'SMPL0000001',
      images: [],
      imageUrls: [],
      createdAt: iso(joiningDate),
      updatedAt: nowIso,
    };
  });
  seed.staff = staffRows;

  // Salary payments: one slip per staff member per month for the last 6 months (+ current month once the 28th has passed)
  for (let off = 6; off >= 0; off--) {
    const { y, m } = monthAt(off);
    const payDate = dateIn(y, m, 28);
    if (!payDate) continue;
    staffRows.forEach((s, i) => {
      const joinY = Number(s.joiningDate.slice(0, 4));
      const joinM = Number(s.joiningDate.slice(5, 7));
      if (y * 12 + m < joinY * 12 + joinM) return;
      const bonus = rng() < 0.12 ? round(rand(500, 1500), 100) : 0;
      const deductions = rng() < 0.08 ? round(rand(300, 900), 100) : 0;
      const method = i % 3 === 0 ? 'BANK_TRANSFER' : i % 3 === 1 ? 'UPI' : 'CASH';
      seed.staffPayments.push({
        id: uuid(),
        staffId: s.id,
        staffName: s.fullName,
        paymentDate: payDate,
        amount: s.baseSalary + bonus - deductions,
        paymentMonth: MONTH_NAMES[m - 1],
        paymentYear: y,
        paymentMonthNumber: m,
        bonus,
        deductions,
        paymentMethod: method,
        transactionId: method === 'CASH' ? undefined : `TXN${digits(10)}`,
        remarks: 'Monthly salary disbursed',
        createdAt: iso(payDate),
        updatedAt: iso(payDate),
      });
    });
  }

  // Advances
  const adv = (staffIdx: number, daysAgo: number, amount: number, reason: string, months: number, status: string, repaid: number, remarks = ''): Row => {
    const s = staffRows[staffIdx];
    const date = daysFromToday(-daysAgo);
    return {
      id: uuid(),
      staffId: s.id,
      staffName: s.fullName,
      advanceDate: date,
      amount,
      advanceAmount: amount,
      reason,
      installmentMonths: months,
      monthlyDeduction: Math.round(amount / months),
      status,
      approvedByCandidateId: status === 'APPROVED' || status === 'REPAID' ? 'demo-user' : undefined,
      approvedAt: status === 'APPROVED' || status === 'REPAID' ? iso(date) : undefined,
      repaidAmount: repaid,
      repaymentAmount: repaid,
      remainingAmount: status === 'REPAID' ? 0 : status === 'REJECTED' ? amount : amount - repaid,
      remarks,
      createdAt: iso(date),
      updatedAt: iso(date),
    };
  };
  seed.advances = [
    adv(2, 50, 8000, 'Family medical expense', 4, 'APPROVED', 4000, 'Deducted in instalments'),
    adv(4, 12, 5000, 'Rent deposit', 2, 'APPROVED', 0),
    adv(3, 4, 3000, 'School fees', 1, 'PENDING', 0),
    adv(1, 95, 6000, 'Festival expenses', 3, 'REPAID', 6000),
    adv(0, 30, 4000, 'Travel advance', 2, 'REJECTED', 0, 'Not approved this month'),
  ];

  // ============================================================ EXPENSES
  const vendors = {
    veg: ['Shree Sai Vegetable Mart', '9000001101'],
    grocery: ['Annapurna Provision Store', '9000001102'],
    dairy: ['Fresh Farm Dairy Supplies', '9000001103'],
    gas: ['Jyoti Gas Agency (demo)', '9000001104'],
    power: ['Sample City Power Utility', '9000001105'],
    water: ['Sample Municipal Water Dept.', '9000001106'],
    fix: ['QuickFix Repairs & Services', '9000001107'],
    misc: ['Clean Mart Supplies', '9000001108'],
    oil: ['Sai Oil Traders', '9000001109'],
    spice: ['Masala Mart Wholesale', '9000001110'],
  } as const;
  let invoiceSeq = 100 + randInt(1, 50);
  const addExpense = (
    y: number, m: number, day: number, itemName: string, category: string, unit: string,
    qty: number, rate: number, vendor: readonly [string, string], status = 'PAID', remarks = '',
  ) => {
    const date = dateIn(y, m, day);
    if (!date) return;
    const method = status === 'UNPAID' ? 'CASH' : pick(['CASH', 'UPI', 'UPI', 'BANK_TRANSFER']);
    seed.expenses.push({
      id: uuid(),
      itemName,
      quantity: qty,
      unit,
      rate,
      totalAmount: Math.round(qty * rate * 100) / 100,
      category,
      subCategory: '',
      vendorName: vendor[0],
      vendorPhone: vendor[1],
      invoiceNumber: `INV-${y}-${String(invoiceSeq++).padStart(4, '0')}`,
      expenseDate: date,
      paymentMethod: method,
      paymentStatus: status,
      remarks,
      createdAt: iso(date),
      updatedAt: iso(date),
    });
  };

  for (let off = 6; off >= 0; off--) {
    const { y, m } = monthAt(off);
    const r = (lo: number, hi: number) => round(rand(lo, hi), 0.5);
    if (off <= 2) {
      // detailed months
      addExpense(y, m, 5, 'Mixed Vegetables', 'VEGETABLES', 'kg', randInt(105, 135), r(36, 44), vendors.veg);
      addExpense(y, m, 14, 'Seasonal Vegetables', 'VEGETABLES', 'kg', randInt(105, 135), r(34, 46), vendors.veg, off === 1 ? 'UNPAID' : 'PAID');
      addExpense(y, m, 23, 'Potatoes & Onions', 'VEGETABLES', 'kg', randInt(120, 160), r(26, 32), vendors.veg, off === 0 ? 'UNPAID' : 'PAID');
      addExpense(y, m, 3, 'Basmati Rice', 'GROCERY', 'kg', randInt(140, 170), r(88, 96), vendors.grocery);
      addExpense(y, m, 8, 'Toor & Moong Dal', 'GROCERY', 'kg', randInt(85, 100), r(122, 140), vendors.grocery);
      addExpense(y, m, 12, 'Wheat Flour (Atta)', 'GROCERY', 'kg', randInt(190, 220), r(40, 43), vendors.grocery);
      addExpense(y, m, 10, 'Sunflower Oil', 'GROCERY', 'liter', randInt(55, 65), r(132, 142), vendors.oil);
      addExpense(y, m, 17, 'Assorted Spices', 'GROCERY', 'lot', 1, round(rand(4000, 6200), 50), vendors.spice);
      addExpense(y, m, 2, 'Milk', 'MILK_DAIRY', 'liter', randInt(190, 210), r(54, 58), vendors.dairy);
      addExpense(y, m, 16, 'Milk', 'MILK_DAIRY', 'liter', randInt(190, 210), r(54, 58), vendors.dairy, off === 0 ? 'UNPAID' : 'PAID');
      addExpense(y, m, 20, 'Paneer', 'MILK_DAIRY', 'kg', randInt(14, 18), r(320, 345), vendors.dairy);
      addExpense(y, m, 6, 'Commercial LPG Cylinder (19 kg)', 'GAS_CYLINDER', 'piece', 2, r(1900, 2000), vendors.gas);
      addExpense(y, m, 19, 'Commercial LPG Cylinder (19 kg)', 'GAS_CYLINDER', 'piece', 2, r(1900, 2000), vendors.gas, off === 1 ? 'UNPAID' : 'PAID');
      addExpense(y, m, 25, 'Electricity Bill', 'UTILITIES', 'bill', 1, round(rand(11500, 16000), 10), vendors.power, off === 0 ? 'UNPAID' : 'PAID');
      addExpense(y, m, 25, 'Water Charges', 'UTILITIES', 'bill', 1, round(rand(2600, 3500), 10), vendors.water);
      addExpense(y, m, 13, pick(['Kitchen Equipment Repair', 'Gas Stove Servicing', 'Plumbing Work', 'Exhaust Fan Replacement']), 'MAINTENANCE', 'job', 1, round(rand(1800, 5800), 50), vendors.fix, off === 0 ? 'UNPAID' : 'PAID');
      addExpense(y, m, 21, pick(['Cleaning Supplies', 'Packaging Material', 'Disposable Plates & Cups']), 'MISCELLANEOUS', 'lot', 1, round(rand(1300, 3000), 50), vendors.misc);
    } else {
      // older months: fewer, larger entries
      addExpense(y, m, 6, 'Vegetables (bulk)', 'VEGETABLES', 'kg', randInt(210, 240), r(35, 42), vendors.veg);
      addExpense(y, m, 19, 'Vegetables (bulk)', 'VEGETABLES', 'kg', randInt(200, 240), r(34, 44), vendors.veg);
      addExpense(y, m, 4, 'Rice & Atta', 'GROCERY', 'kg', randInt(440, 480), r(60, 66), vendors.grocery);
      addExpense(y, m, 11, 'Dal, Oil & Spices', 'GROCERY', 'lot', 1, round(rand(23000, 28000), 100), vendors.grocery);
      addExpense(y, m, 9, 'Milk', 'MILK_DAIRY', 'liter', randInt(390, 420), r(53, 57), vendors.dairy);
      addExpense(y, m, 15, 'Paneer & Curd', 'MILK_DAIRY', 'lot', 1, round(rand(6500, 8500), 50), vendors.dairy);
      addExpense(y, m, 7, 'Commercial LPG Cylinder (19 kg)', 'GAS_CYLINDER', 'piece', 4, r(1880, 1980), vendors.gas);
      addExpense(y, m, 25, 'Electricity & Water Bill', 'UTILITIES', 'bill', 1, round(rand(14500, 19000), 10), vendors.power);
      addExpense(y, m, 18, pick(['Kitchen Equipment Repair', 'Pest Control', 'Plumbing Work']), 'MAINTENANCE', 'job', 1, round(rand(1800, 5200), 50), vendors.fix);
      addExpense(y, m, 22, 'Cleaning Supplies', 'MISCELLANEOUS', 'lot', 1, round(rand(1300, 2800), 50), vendors.misc);
    }
  }
  // Two entries logged today so "Today's expense" is not empty
  {
    const { y, m } = monthAt(0);
    addExpense(y, m, todayDay, 'Green Vegetables (daily)', 'VEGETABLES', 'kg', 26, 42, vendors.veg);
    addExpense(y, m, todayDay, 'Milk (evening)', 'MILK_DAIRY', 'liter', 40, 56, vendors.dairy);
  }
  seed.expenses.sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1));

  // ============================================================ PARTIES (catering bookings)
  interface PartyDef {
    day: number; name: string; client: string; type: string; people: number; rate: number; meal: string;
    dept: number; paidPct: number; extras?: Array<[string, number, number, string]>; discount?: number; extraDept?: string; time?: string; req?: string;
  }
  const partyDefs: PartyDef[] = [
    { day: -178, name: "Freshers' Welcome Lunch", client: 'Prof. Anil Deshmukh', type: 'OTHER', people: 140, rate: 150, meal: 'VEG', dept: 0, paidPct: 1, extras: [['Gulab Jamun', 160, 18, 'pcs']], time: '13:00' },
    { day: -141, name: 'Diwali Get-together Dinner', client: 'Ms. Pallavi Sawant', type: 'FESTIVAL', people: 90, rate: 190, meal: 'VEG', dept: 4, paidPct: 1, extras: [['Rasmalai', 100, 30, 'pcs'], ['Soft Drinks', 90, 20, 'bottle']], time: '20:00' },
    { day: -96, name: 'Farewell Dinner - Batch 2026', client: 'Dr. Kavita Menon', type: 'FAREWELL', people: 120, rate: 220, meal: 'BOTH', dept: 5, paidPct: 1, extras: [['Ice Cream', 120, 35, 'cup']], discount: 1000, extraDept: 'ECE, MECH', time: '19:30' },
    { day: -60, name: 'Annual Department Meet', client: 'Mr. Rohit Malhotra', type: 'CORPORATE', people: 75, rate: 240, meal: 'BOTH', dept: 4, paidPct: 1, time: '12:30' },
    { day: -33, name: 'Alumni Reunion Lunch', client: 'Mr. Sameer Khanna', type: 'OTHER', people: 110, rate: 210, meal: 'NON_VEG', dept: 2, paidPct: 0.7, extras: [['Gulab Jamun', 110, 18, 'pcs']], time: '13:30' },
    { day: -12, name: 'Technical Fest Volunteers Dinner', client: 'Ms. Radhika Iyer', type: 'OTHER', people: 60, rate: 170, meal: 'VEG', dept: 1, paidPct: 0.3, time: '21:00', req: 'Less spicy food' },
    { day: 6, name: 'Birthday Celebration - Dr. Neelam', client: 'Dr. Neelam Joshi', type: 'BIRTHDAY', people: 40, rate: 260, meal: 'VEG', dept: 3, paidPct: 0.25, extras: [['Birthday Cake (2 kg)', 1, 1400, 'pc']], time: '19:00' },
    { day: 19, name: 'Placement Drive Lunch', client: 'Prof. Anil Deshmukh', type: 'CORPORATE', people: 180, rate: 160, meal: 'BOTH', dept: 0, paidPct: 0, extras: [['Packaged Water', 180, 10, 'bottle']], time: '13:00' },
  ];
  partyDefs.forEach((p, i) => {
    const dept = departments[p.dept];
    const eventDate = daysFromToday(p.day);
    const extras = (p.extras || []).map(([itemName, quantity, rate, unit]) => ({ itemName, quantity, rate, unit }));
    const bill = p.people * p.rate + extras.reduce((s, e) => s + e.quantity * e.rate, 0) - (p.discount || 0);
    const paid = p.paidPct >= 1 ? bill : Math.round((bill * p.paidPct) / 100) * 100;
    const status = paid >= bill ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';
    const phone = `90000${String(70001 + i).padStart(5, '0')}`;
    const id = uuid();
    seed.parties.push({
      id,
      partyId: `PTY-${String(i + 1).padStart(4, '0')}`,
      partyName: p.name,
      clientName: p.client,
      contactPerson: p.client,
      phoneNumber: phone,
      clientPhone: phone,
      email: `${p.client.replace(/^(Prof\.|Dr\.|Mr\.|Ms\.)\s*/, '').split(' ')[0].toLowerCase()}@sample-college.example`,
      clientEmail: undefined,
      address: `${dept.name}, Sample College Campus`,
      eventDate,
      eventTime: p.time || '19:00',
      partyType: p.type,
      numberOfPeople: p.people,
      mealType: p.meal,
      thaliRate: p.rate,
      advanceAmount: paid,
      discount: p.discount || 0,
      discountType: 'FIXED',
      paymentStatus: status,
      paidAmount: paid,
      paymentMethod: i % 2 ? 'UPI' : 'BANK_TRANSFER',
      specialRequests: p.req || '',
      remarks: '',
      extraItems: extras,
      invoiceNumber: `INV-P-${eventDate.slice(0, 4)}-${String(i + 1).padStart(3, '0')}`,
      totalAmount: bill,
      departmentId: dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      additionalDepartments: p.extraDept || '',
      createdAt: iso(daysFromToday(Math.min(p.day, 0) - 10)),
      updatedAt: nowIso,
    });
    if (paid > 0) {
      const first = status === 'PAID' && paid > 10000 ? Math.round((paid * 0.4) / 100) * 100 : paid;
      const payDate = p.day <= 0 ? eventDate : daysFromToday(-2);
      seed.partyPayments.push({
        id: uuid(), partyId: id, amount: first, paymentDate: daysFromToday(Math.min(p.day, 0) - 7),
        receiptNumber: `REC-PTY-${digits(6)}`, paymentMethod: 'UPI', remarks: 'Advance received', createdAt: nowIso,
      });
      if (paid - first > 0) {
        seed.partyPayments.push({
          id: uuid(), partyId: id, amount: paid - first, paymentDate: payDate,
          receiptNumber: `REC-PTY-${digits(6)}`, paymentMethod: 'BANK_TRANSFER', remarks: 'Balance settled', createdAt: nowIso,
        });
      }
    }
  });

  // ============================================================ COLLEGE BILLING
  const colleges = {
    sunrise: ['Sunrise Institute of Technology', 58],
    lakeview: ['Lakeview College of Commerce', 55],
    greenfield: ['Greenfield Polytechnic', 60],
    riverside: ['Riverside Pharmacy College', 62],
  } as const;
  type CB = [keyof typeof colleges, number, number, 'PAID' | 'PARTIAL' | 'UNPAID']; // college, offset, thalis, status
  const cbDefs: CB[] = [
    ['sunrise', 5, 2960, 'PAID'], ['sunrise', 4, 3020, 'PAID'], ['sunrise', 3, 2890, 'PAID'],
    ['sunrise', 2, 3080, 'PAID'], ['sunrise', 1, 3010, 'PAID'],
    ['lakeview', 3, 2080, 'PAID'], ['lakeview', 2, 2040, 'PAID'], ['lakeview', 1, 2150, 'PARTIAL'],
    ['greenfield', 2, 1560, 'PAID'], ['greenfield', 1, 1620, 'UNPAID'],
    ['riverside', 6, 1290, 'PAID'], ['riverside', 1, 1340, 'UNPAID'],
  ];
  cbDefs.forEach(([key, off, thalis, status]) => {
    const [college, rate] = colleges[key];
    const { y, m } = monthAt(off);
    const next = new Date(y, m, 2); // billed on the 2nd of the following month
    const billingDate = isoDate(next);
    const billable = thalis * rate;
    const received = status === 'PAID' ? billable : status === 'PARTIAL' ? Math.round((billable * 0.6) / 100) * 100 : 0;
    seed.collegeBillings.push({
      id: uuid(),
      college,
      month: m,
      year: y,
      monthName: MONTH_NAMES[m - 1],
      billingDate: billingDate > todayISO() ? todayISO() : billingDate,
      totalStudentAttendance: thalis,
      totalThalisServed: thalis,
      ratePerThali: rate,
      totalBillableAmount: billable,
      amountReceived: received,
      outstandingBalance: billable - received,
      status: status === 'PARTIAL' ? 'PARTIALLY_PAID' : status,
      remarks: status === 'PARTIAL' ? 'Part payment received, balance awaited' : '',
      createdAt: iso(billingDate),
      updatedAt: iso(billingDate),
    });
  });

  // ============================================================ MENUS (current week, lunch + dinner)
  const monday = (() => {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    return addDays(d, -dow);
  })();
  type It = [string, string, boolean];
  const lunches: It[][] = [
    [['Steamed Rice', 'Rice', true], ['Dal Tadka', 'Dal', true], ['Aloo Gobi', 'Main Course', true], ['Chapati', 'Bread', true], ['Salad & Papad', 'Side', true]],
    [['Jeera Rice', 'Rice', true], ['Rajma Masala', 'Main Course', true], ['Bhindi Fry', 'Main Course', true], ['Chapati', 'Bread', true], ['Curd', 'Side', true]],
    [['Steamed Rice', 'Rice', true], ['Sambar', 'Dal', true], ['Cabbage Poriyal', 'Main Course', true], ['Chapati', 'Bread', true], ['Buttermilk', 'Side', true]],
    [['Veg Pulao', 'Rice', true], ['Dal Fry', 'Dal', true], ['Paneer Butter Masala', 'Main Course', true], ['Chapati', 'Bread', true], ['Raita', 'Side', true]],
    [['Steamed Rice', 'Rice', true], ['Chole Masala', 'Main Course', true], ['Mix Veg', 'Main Course', true], ['Puri', 'Bread', true], ['Kheer', 'Dessert', true]],
    [['Egg Curry / Veg Kofta', 'Main Course', false], ['Steamed Rice', 'Rice', true], ['Dal Tadka', 'Dal', true], ['Chapati', 'Bread', true], ['Salad', 'Side', true]],
    [['Veg Biryani', 'Rice', true], ['Dal Makhani', 'Dal', true], ['Mirchi Ka Salan', 'Side', true], ['Boondi Raita', 'Side', true], ['Gulab Jamun', 'Dessert', true]],
  ];
  const dinners: It[][] = [
    [['Steamed Rice', 'Rice', true], ['Moong Dal', 'Dal', true], ['Lauki Sabzi', 'Main Course', true], ['Chapati', 'Bread', true]],
    [['Veg Fried Rice', 'Rice', true], ['Manchurian Gravy', 'Main Course', true], ['Chapati', 'Bread', true]],
    [['Steamed Rice', 'Rice', true], ['Dal Tadka', 'Dal', true], ['Matar Paneer', 'Main Course', true], ['Chapati', 'Bread', true]],
    [['Khichdi', 'Rice', true], ['Kadhi', 'Dal', true], ['Papad & Pickle', 'Side', true]],
    [['Steamed Rice', 'Rice', true], ['Chicken Curry / Paneer Bhurji', 'Main Course', false], ['Dal Fry', 'Dal', true], ['Chapati', 'Bread', true]],
    [['Pav Bhaji', 'Main Course', true], ['Jeera Rice', 'Rice', true], ['Sweet Lassi', 'Side', true]],
    [['Steamed Rice', 'Rice', true], ['Dal Tadka', 'Dal', true], ['Aloo Matar', 'Main Course', true], ['Chapati', 'Bread', true], ['Sheera', 'Dessert', true]],
  ];
  for (let d = 0; d < 7; d++) {
    const menuDate = isoDate(addDays(monday, d));
    (['LUNCH', 'DINNER'] as const).forEach((mealType) => {
      const list = mealType === 'LUNCH' ? lunches[d] : dinners[d];
      const menuId = uuid();
      seed.menus.push({
        id: menuId,
        menuDate,
        mealType,
        menuName: `${mealType === 'LUNCH' ? 'Lunch' : 'Dinner'} - ${MONTH_NAMES[Number(menuDate.slice(5, 7)) - 1].slice(0, 3)} ${Number(menuDate.slice(8, 10))}`,
        description: 'Regular mess menu',
        isSpecial: d === 6 && mealType === 'LUNCH',
        specialRemarks: d === 6 && mealType === 'LUNCH' ? 'Sunday special' : '',
        status: 'ACTIVE',
        createdByCandidateId: 'demo-user',
        items: list.map(([itemName, category, isVegetarian], k) => ({
          id: uuid(), itemName, category, isVegetarian, isAvailable: true, displayOrder: k + 1,
        })),
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });
  }

  return seed;
}
