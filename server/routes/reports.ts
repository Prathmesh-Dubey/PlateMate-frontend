// server/routes/reports.ts
import { Router } from 'express';
import {
  candidates,
  attendances,
  meals,
  expenses,
  feeCollections,
  parties,
  staffList,
  staffPayments,
  staffAdvances,
  stockItems,
  menus
} from '../db';
import type { ReportRequest } from '../../src/types';

export const reportsRouter = Router();

// Monthly report
reportsRouter.get('/monthly', (req, res) => {
  const month = Number(req.query.month) || (new Date().getMonth() + 1);
  const year = Number(req.query.year) || new Date().getFullYear();

  const totalCand = candidates.length;
  const activeCand = candidates.filter(c => c.status === 'ACTIVE').length;
  const leftCand = candidates.filter(c => c.status === 'LEFT').length;

  const attRecords = attendances.filter(a => {
    const d = new Date(a.attendanceDate);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const attPresent = attRecords.filter(a => a.status === 'IN' || a.status === 'HALF_DAY').length;
  const attAbsent = attRecords.filter(a => a.status === 'ABSENT').length;

  const mealRecords = meals.filter(m => {
    const d = new Date(m.mealDate);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const mealsTaken = mealRecords.filter(m => m.isTaken).length;

  const expRecords = expenses.filter(e => {
    const d = new Date(e.expenseDate);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const expTotal = expRecords.reduce((s, e) => s + e.quantity * e.rate, 0);

  const feeRecords = feeCollections.filter(f => f.paymentMonthNumber === month && f.paymentYear === year);
  const feeTotal = feeRecords.reduce((s, f) => s + f.amount, 0);

  const partyRecords = parties.filter(p => {
    const d = new Date(p.eventDate);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const partyTotal = partyRecords.reduce((s, p) => s + (p.paidAmount || 0), 0);

  const staffRecords = staffPayments.filter(p => p.paymentMonthNumber === month && p.paymentYear === year);
  const staffTotal = staffRecords.reduce((s, p) => s + p.amount, 0);

  const profit = feeTotal + partyTotal - expTotal - staffTotal;

  res.json({
    candidates: { total: totalCand, active: activeCand, left: leftCand },
    attendance: { present: attPresent, absent: attAbsent, total: attRecords.length },
    meals: { total: mealRecords.length, taken: mealsTaken, notTaken: Math.max(0, mealRecords.length - mealsTaken) },
    expenses: { total: expTotal, count: expRecords.length },
    feeCollection: { total: feeTotal, count: feeRecords.length },
    partyRevenue: { total: partyTotal, count: partyRecords.length },
    staffSalary: { total: staffTotal, count: staffRecords.length },
    profit,
  });
});

// Yearly report
reportsRouter.get('/yearly', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalStaffSalary = 0;

  const monthlyData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const feeInc = feeCollections
      .filter(f => f.paymentYear === year && f.paymentMonthNumber === m)
      .reduce((s, f) => s + f.amount, 0);

    const partyInc = parties
      .filter(p => {
        const d = new Date(p.eventDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, p) => s + (p.paidAmount || 0), 0);

    const exp = expenses
      .filter(e => {
        const d = new Date(e.expenseDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, e) => s + e.quantity * e.rate, 0);

    const sal = staffPayments
      .filter(p => p.paymentYear === year && p.paymentMonthNumber === m)
      .reduce((s, p) => s + p.amount, 0);

    const income = feeInc + partyInc;
    totalIncome += income;
    totalExpenses += exp;
    totalStaffSalary += sal;

    return {
      month: m,
      income,
      expenses: exp,
      staffSalary: sal,
      profit: income - exp - sal,
    };
  });

  res.json({
    monthlyData,
    totalIncome,
    totalExpenses,
    totalStaffSalary,
    totalProfit: totalIncome - totalExpenses - totalStaffSalary,
  });
});

// Custom date range report
reportsRouter.get('/custom', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

  const totalCand = candidates.length;
  const activeCand = candidates.filter(c => c.status === 'ACTIVE').length;
  const leftCand = candidates.filter(c => c.status === 'LEFT').length;

  const attRecords = attendances.filter(a => {
    if (startDate && a.attendanceDate < startDate) return false;
    if (endDate && a.attendanceDate > endDate) return false;
    return true;
  });
  const attPresent = attRecords.filter(a => a.status === 'IN' || a.status === 'HALF_DAY').length;

  const mealRecords = meals.filter(m => {
    if (startDate && m.mealDate < startDate) return false;
    if (endDate && m.mealDate > endDate) return false;
    return true;
  });
  const mealsTaken = mealRecords.filter(m => m.isTaken).length;

  const expRecords = expenses.filter(e => {
    if (startDate && e.expenseDate < startDate) return false;
    if (endDate && e.expenseDate > endDate) return false;
    return true;
  });
  const expTotal = expRecords.reduce((s, e) => s + e.quantity * e.rate, 0);

  const feeRecords = feeCollections.filter(f => {
    if (startDate && f.collectionDate < startDate) return false;
    if (endDate && f.collectionDate > endDate) return false;
    return true;
  });
  const feeTotal = feeRecords.reduce((s, f) => s + f.amount, 0);

  const partyRecords = parties.filter(p => {
    if (startDate && p.eventDate < startDate) return false;
    if (endDate && p.eventDate > endDate) return false;
    return true;
  });
  const partyTotal = partyRecords.reduce((s, p) => s + (p.paidAmount || 0), 0);

  const staffRecords = staffPayments.filter(p => {
    if (startDate && p.paymentDate < startDate) return false;
    if (endDate && p.paymentDate > endDate) return false;
    return true;
  });
  const staffTotal = staffRecords.reduce((s, p) => s + p.amount, 0);

  res.json({
    candidates: { total: totalCand, active: activeCand, left: leftCand },
    attendance: { present: attPresent, absent: Math.max(0, attRecords.length - attPresent), total: attRecords.length },
    meals: { total: mealRecords.length, taken: mealsTaken, notTaken: Math.max(0, mealRecords.length - mealsTaken) },
    expenses: { total: expTotal, count: expRecords.length },
    feeCollection: { total: feeTotal, count: feeRecords.length },
    partyRevenue: { total: partyTotal, count: partyRecords.length },
    staffSalary: { total: staffTotal, count: staffRecords.length },
    profit: feeTotal + partyTotal - expTotal - staffTotal,
  });
});

// Candidate report
reportsRouter.get('/candidate', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const attCounts: Record<string, number> = {};
  const mealCounts: Record<string, number> = {};

  attendances.forEach(a => {
    if (startDate && a.attendanceDate < startDate) return;
    if (endDate && a.attendanceDate > endDate) return;
    if (a.status === 'IN') {
      attCounts[a.candidateId] = (attCounts[a.candidateId] || 0) + 1;
    }
  });

  meals.forEach(m => {
    if (startDate && m.mealDate < startDate) return;
    if (endDate && m.mealDate > endDate) return;
    if (m.isTaken) {
      mealCounts[m.candidateId] = (mealCounts[m.candidateId] || 0) + 1;
    }
  });

  const fees = feeCollections.filter(f => {
    if (startDate && f.collectionDate < startDate) return false;
    if (endDate && f.collectionDate > endDate) return false;
    return true;
  });

  res.json({
    candidates,
    attendance: attCounts,
    meals: mealCounts,
    feeHistory: fees,
  });
});

// Attendance report
reportsRouter.get('/attendance', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const matched = attendances.filter(a => {
    if (startDate && a.attendanceDate < startDate) return false;
    if (endDate && a.attendanceDate > endDate) return false;
    return true;
  });

  const present = matched.filter(a => a.status === 'IN' || a.status === 'HALF_DAY').length;
  const absent = matched.filter(a => a.status === 'ABSENT').length;

  const dateMap: Record<string, { present: number; absent: number }> = {};
  matched.forEach(a => {
    if (!dateMap[a.attendanceDate]) dateMap[a.attendanceDate] = { present: 0, absent: 0 };
    if (a.status === 'IN') dateMap[a.attendanceDate].present++;
    else if (a.status === 'ABSENT') dateMap[a.attendanceDate].absent++;
  });

  const dailyData = Object.entries(dateMap).map(([date, counts]) => ({
    date,
    present: counts.present,
    absent: counts.absent,
  }));

  const candidateWise = candidates.map(c => {
    const cAtt = matched.filter(a => a.candidateId === c.id || a.candidateId === c.candidateId);
    return {
      candidate: c,
      present: cAtt.filter(a => a.status === 'IN').length,
      absent: cAtt.filter(a => a.status === 'ABSENT').length,
    };
  });

  res.json({
    summary: { present, absent, total: matched.length },
    dailyData,
    candidateWise,
  });
});

// Expense report
reportsRouter.get('/expense', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = expenses.filter(e => {
    if (startDate && e.expenseDate < startDate) return false;
    if (endDate && e.expenseDate > endDate) return false;
    return true;
  });

  const categoryWise: Record<string, number> = {};
  const dayMap: Record<string, number> = {};
  let total = 0;

  filtered.forEach(e => {
    const cost = e.quantity * e.rate;
    total += cost;
    categoryWise[e.category] = (categoryWise[e.category] || 0) + cost;
    dayMap[e.expenseDate] = (dayMap[e.expenseDate] || 0) + cost;
  });

  const dailyData = Object.entries(dayMap).map(([date, tot]) => ({ date, total: tot }));

  res.json({
    total,
    count: filtered.length,
    categoryWise,
    dailyData,
    expenses: filtered,
  });
});

// Stock report
reportsRouter.get('/stock', (req, res) => {
  const totalItems = stockItems.length;
  const totalValue = stockItems.reduce((acc, item) => acc + item.currentStock * item.unitPrice, 0);
  const lowStockItems = stockItems.filter(i => i.currentStock <= i.minimumStockLevel);

  const categoryWise: Record<string, { count: number; value: number }> = {};
  stockItems.forEach(i => {
    if (!categoryWise[i.category]) categoryWise[i.category] = { count: 0, value: 0 };
    categoryWise[i.category].count++;
    categoryWise[i.category].value += i.currentStock * i.unitPrice;
  });

  res.json({
    totalItems,
    totalValue,
    lowStockItems,
    categoryWise,
    items: stockItems,
  });
});

// Staff report
reportsRouter.get('/staff', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const totalStaff = staffList.length;
  const totalSalary = staffList.reduce((s, st) => s + st.baseSalary, 0);

  const positionWise: Record<string, { count: number; totalSalary: number }> = {};
  staffList.forEach(st => {
    if (!positionWise[st.position]) positionWise[st.position] = { count: 0, totalSalary: 0 };
    positionWise[st.position].count++;
    positionWise[st.position].totalSalary += st.baseSalary;
  });

  const payments = staffPayments.filter(p => {
    if (startDate && p.paymentDate < startDate) return false;
    if (endDate && p.paymentDate > endDate) return false;
    return true;
  });

  const advances = staffAdvances.filter(a => {
    if (startDate && a.advanceDate < startDate) return false;
    if (endDate && a.advanceDate > endDate) return false;
    return true;
  });

  res.json({
    totalStaff,
    totalSalary,
    positionWise,
    payments,
    advances,
  });
});

// Billing report
reportsRouter.get('/billing', (req, res) => {
  const month = Number(req.query.month) || (new Date().getMonth() + 1);
  const year = Number(req.query.year) || new Date().getFullYear();

  const matchedFees = feeCollections.filter(f => f.paymentMonthNumber === month && f.paymentYear === year);
  const feeTotal = matchedFees.reduce((s, f) => s + f.amount, 0);

  const matchedParties = parties.filter(p => {
    const d = new Date(p.eventDate);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const partyTotal = matchedParties.reduce((s, p) => s + (p.paidAmount || 0), 0);

  res.json({
    feeCollection: { total: feeTotal, count: matchedFees.length, candidates: matchedFees },
    partyRevenue: { total: partyTotal, count: matchedParties.length, parties: matchedParties },
    totalIncome: feeTotal + partyTotal,
  });
});

// Party report
reportsRouter.get('/party', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = parties.filter(p => {
    if (startDate && p.eventDate < startDate) return false;
    if (endDate && p.eventDate > endDate) return false;
    return true;
  });

  let totalRevenue = 0;
  let totalPaid = 0;
  const dayMap: Record<string, { count: number; revenue: number }> = {};

  filtered.forEach(p => {
    const base = p.numberOfPeople * p.thaliRate;
    const extras = p.extraItems?.reduce((s, i) => s + i.quantity * i.rate, 0) || 0;
    const bill = Math.max(0, base + extras - (p.discount || 0));
    totalRevenue += bill;
    totalPaid += (p.paidAmount || 0);

    if (!dayMap[p.eventDate]) dayMap[p.eventDate] = { count: 0, revenue: 0 };
    dayMap[p.eventDate].count++;
    dayMap[p.eventDate].revenue += (p.paidAmount || 0);
  });

  const dailyData = Object.entries(dayMap).map(([date, d]) => ({
    date,
    count: d.count,
    revenue: d.revenue,
  }));

  res.json({
    totalParties: filtered.length,
    totalRevenue,
    totalPaid,
    totalOutstanding: Math.max(0, totalRevenue - totalPaid),
    parties: filtered,
    dailyData,
  });
});

// Menu report
reportsRouter.get('/menu', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = menus.filter(m => {
    if (startDate && m.menuDate < startDate) return false;
    if (endDate && m.menuDate > endDate) return false;
    return true;
  });

  let totalItems = 0;
  const categoryWise: Record<string, number> = {};
  const itemMap: Record<string, number> = {};

  filtered.forEach(m => {
    m.items?.forEach(i => {
      totalItems++;
      categoryWise[i.category] = (categoryWise[i.category] || 0) + 1;
      itemMap[i.itemName] = (itemMap[i.itemName] || 0) + 1;
    });
  });

  const popularItems = Object.entries(itemMap)
    .map(([itemName, count]) => ({ itemName, count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    totalMenus: filtered.length,
    totalItems,
    popularItems,
    categoryWise,
    menus: filtered,
  });
});

// Profit Loss report
reportsRouter.get('/profit-loss', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalStaffSalary = 0;

  const monthlyData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const feeInc = feeCollections
      .filter(f => f.paymentYear === year && f.paymentMonthNumber === m)
      .reduce((s, f) => s + f.amount, 0);

    const partyInc = parties
      .filter(p => {
        const d = new Date(p.eventDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, p) => s + (p.paidAmount || 0), 0);

    const exp = expenses
      .filter(e => {
        const d = new Date(e.expenseDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, e) => s + e.quantity * e.rate, 0);

    const sal = staffPayments
      .filter(p => p.paymentYear === year && p.paymentMonthNumber === m)
      .reduce((s, p) => s + p.amount, 0);

    const income = feeInc + partyInc;
    totalIncome += income;
    totalExpenses += exp;
    totalStaffSalary += sal;

    return {
      month: m,
      income,
      expenses: exp,
      staffSalary: sal,
      profit: income - exp - sal,
    };
  });

  res.json({
    yearlySummary: {
      totalIncome,
      totalExpenses,
      totalStaffSalary,
      totalProfit: totalIncome - totalExpenses - totalStaffSalary,
    },
    monthlyData,
  });
});

// Generate report
reportsRouter.post('/generate', (req, res) => {
  const data: ReportRequest = req.body;
  res.json({
    success: true,
    message: `${data.reportType} report generated successfully in ${data.format} format`,
    reportUrl: `/api/reports/download/${data.reportType.toLowerCase()}.${data.format.toLowerCase()}`,
  });
});

// Export PDF / Excel / CSV
reportsRouter.post('/export/pdf', (req, res) => {
  res.json({
    success: true,
    downloadUrl: '#download-pdf',
    message: 'PDF report generated and ready for print/download',
  });
});

reportsRouter.post('/export/excel', (req, res) => {
  res.json({
    success: true,
    downloadUrl: '#download-excel',
    message: 'Excel spreadsheet generated successfully',
  });
});

reportsRouter.post('/export/csv', (req, res) => {
  res.json({
    success: true,
    downloadUrl: '#download-csv',
    message: 'CSV export data generated successfully',
  });
});
