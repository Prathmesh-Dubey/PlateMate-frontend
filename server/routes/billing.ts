// server/routes/billing.ts
import { Router } from 'express';
import {
  feeCollections,
  candidates,
  expenses,
  staffPayments,
  parties,
  attendances,
  meals,
  stockItems,
  staffList,
  uid
} from '../db';
import type { FeeCollection, BulkFeeCollection } from '../../src/types';

export const billingRouter = Router();

// Dashboard summary
billingRouter.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const curMonth = new Date().getMonth() + 1;
  const curYear = new Date().getFullYear();

  // Today attendance
  const todayAtt = attendances.filter(a => a.attendanceDate === today);
  const attPresent = todayAtt.filter(a => a.status === 'IN' || a.status === 'HALF_DAY').length;
  const attAbsent = todayAtt.filter(a => a.status === 'ABSENT').length;
  const attTotal = candidates.filter(c => c.status === 'ACTIVE').length;

  // Today meals
  const todayMeals = meals.filter(m => m.mealDate === today);
  const mealsTaken = todayMeals.filter(m => m.isTaken).length;
  const mealsTotal = todayMeals.length;

  // Today expenses
  const todayExps = expenses.filter(e => e.expenseDate === today);
  const expTodayTotal = todayExps.reduce((sum, e) => sum + e.quantity * e.rate, 0);

  // Current month financial calculations
  const monthFees = feeCollections
    .filter(f => f.paymentMonthNumber === curMonth && f.paymentYear === curYear)
    .reduce((sum, f) => sum + f.amount, 0);

  const monthParties = parties
    .filter(p => {
      const d = new Date(p.eventDate);
      return d.getMonth() + 1 === curMonth && d.getFullYear() === curYear;
    })
    .reduce((sum, p) => sum + p.paidAmount, 0);

  const monthIncome = monthFees + monthParties;

  const monthExpenses = expenses
    .filter(e => {
      const d = new Date(e.expenseDate);
      return d.getMonth() + 1 === curMonth && d.getFullYear() === curYear;
    })
    .reduce((sum, e) => sum + e.quantity * e.rate, 0);

  const monthStaffSalary = staffPayments
    .filter(p => p.paymentMonthNumber === curMonth && p.paymentYear === curYear)
    .reduce((sum, p) => sum + p.amount, 0);

  const monthProfit = monthIncome - monthExpenses - monthStaffSalary;

  // Current year financial
  const yearFees = feeCollections
    .filter(f => f.paymentYear === curYear)
    .reduce((sum, f) => sum + f.amount, 0);

  const yearParties = parties
    .filter(p => new Date(p.eventDate).getFullYear() === curYear)
    .reduce((sum, p) => sum + p.paidAmount, 0);

  const yearIncome = yearFees + yearParties;

  const yearExpenses = expenses
    .filter(e => new Date(e.expenseDate).getFullYear() === curYear)
    .reduce((sum, e) => sum + e.quantity * e.rate, 0);

  const yearStaffSalary = staffPayments
    .filter(p => p.paymentYear === curYear)
    .reduce((sum, p) => sum + p.amount, 0);

  const yearProfit = yearIncome - yearExpenses - yearStaffSalary;

  const activeCandidates = candidates.filter(c => c.status === 'ACTIVE').length;
  const totalStaff = staffList.filter(s => s.status === 'ACTIVE').length;
  const pendingParties = parties.filter(p => p.paymentStatus !== 'PAID').length;
  const lowStockItems = stockItems.filter(i => i.currentStock <= i.minimumStockLevel).length;

  res.json({
    today: {
      attendance: { present: attPresent, absent: attAbsent, total: attTotal },
      meals: { total: mealsTotal, taken: mealsTaken, notTaken: Math.max(0, mealsTotal - mealsTaken) },
      expenses: { total: expTodayTotal, count: todayExps.length },
    },
    currentMonth: {
      income: monthIncome,
      expenses: monthExpenses,
      staffSalary: monthStaffSalary,
      profit: monthProfit,
      feeCollected: monthFees,
      partyRevenue: monthParties,
    },
    currentYear: {
      income: yearIncome,
      expenses: yearExpenses,
      staffSalary: yearStaffSalary,
      profit: yearProfit,
    },
    activeCandidates,
    totalStaff,
    pendingParties,
    lowStockItems,
  });
});

// Current month profit
billingRouter.get('/current-month-profit', (req, res) => {
  const curMonth = new Date().getMonth() + 1;
  const curYear = new Date().getFullYear();

  const fees = feeCollections
    .filter(f => f.paymentMonthNumber === curMonth && f.paymentYear === curYear)
    .reduce((s, f) => s + f.amount, 0);

  const partyRev = parties
    .filter(p => {
      const d = new Date(p.eventDate);
      return d.getMonth() + 1 === curMonth && d.getFullYear() === curYear;
    })
    .reduce((s, p) => s + p.paidAmount, 0);

  const income = fees + partyRev;

  const exp = expenses
    .filter(e => {
      const d = new Date(e.expenseDate);
      return d.getMonth() + 1 === curMonth && d.getFullYear() === curYear;
    })
    .reduce((s, e) => s + e.quantity * e.rate, 0);

  const staff = staffPayments
    .filter(p => p.paymentMonthNumber === curMonth && p.paymentYear === curYear)
    .reduce((s, p) => s + p.amount, 0);

  res.json({ profit: income - exp - staff, income, expenses: exp, staffSalary: staff });
});

// Current year profit
billingRouter.get('/current-year-profit', (req, res) => {
  const curYear = new Date().getFullYear();

  const fees = feeCollections.filter(f => f.paymentYear === curYear).reduce((s, f) => s + f.amount, 0);
  const partyRev = parties.filter(p => new Date(p.eventDate).getFullYear() === curYear).reduce((s, p) => s + p.paidAmount, 0);
  const income = fees + partyRev;

  const exp = expenses.filter(e => new Date(e.expenseDate).getFullYear() === curYear).reduce((s, e) => s + e.quantity * e.rate, 0);
  const staff = staffPayments.filter(p => p.paymentYear === curYear).reduce((s, p) => s + p.amount, 0);

  res.json({ profit: income - exp - staff, income, expenses: exp, staffSalary: staff });
});

// Income expense comparison for chart
billingRouter.get('/income-expense-comparison', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const incomeArr: number[] = [];
  const expensesArr: number[] = [];
  const staffSalaryArr: number[] = [];
  const profitArr: number[] = [];

  months.forEach(m => {
    const feeInc = feeCollections
      .filter(f => f.paymentYear === year && f.paymentMonthNumber === m)
      .reduce((s, f) => s + f.amount, 0);

    const partyInc = parties
      .filter(p => {
        const d = new Date(p.eventDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, p) => s + p.paidAmount, 0);

    const inc = feeInc + partyInc;

    const exp = expenses
      .filter(e => {
        const d = new Date(e.expenseDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, e) => s + e.quantity * e.rate, 0);

    const sal = staffPayments
      .filter(p => p.paymentYear === year && p.paymentMonthNumber === m)
      .reduce((s, p) => s + p.amount, 0);

    incomeArr.push(inc);
    expensesArr.push(exp);
    staffSalaryArr.push(sal);
    profitArr.push(inc - exp - sal);
  });

  res.json({
    months,
    income: incomeArr,
    expenses: expensesArr,
    staffSalary: staffSalaryArr,
    profit: profitArr,
  });
});

// Profit loss chart
billingRouter.get('/profit-loss-chart', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const chartData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const feeInc = feeCollections
      .filter(f => f.paymentYear === year && f.paymentMonthNumber === m)
      .reduce((s, f) => s + f.amount, 0);

    const partyInc = parties
      .filter(p => {
        const d = new Date(p.eventDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, p) => s + p.paidAmount, 0);

    const exp = expenses
      .filter(e => {
        const d = new Date(e.expenseDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, e) => s + e.quantity * e.rate, 0);

    const sal = staffPayments
      .filter(p => p.paymentYear === year && p.paymentMonthNumber === m)
      .reduce((s, p) => s + p.amount, 0);

    const net = feeInc + partyInc - exp - sal;
    return {
      month: m,
      profit: net > 0 ? net : 0,
      loss: net < 0 ? Math.abs(net) : 0,
    };
  });

  res.json(chartData);
});

// Generate monthly dues
billingRouter.post('/generate', (req, res) => {
  const m = Number(req.query.month);
  const y = Number(req.query.year);
  const active = candidates.filter(c => c.status === 'ACTIVE');
  const billings = active.map(c => ({
    candidateId: c.id!,
    amount: c.monthlyRate,
  }));
  res.json({ success: true, message: `Generated dues for ${billings.length} candidates for ${m}/${y}`, billings });
});

// Generate all monthly
billingRouter.post('/generate-all', (req, res) => {
  const curMonth = new Date().getMonth() + 1;
  const curYear = new Date().getFullYear();
  const active = candidates.filter(c => c.status === 'ACTIVE');
  let generated = 0;

  active.forEach(c => {
    const exists = feeCollections.some(
      f => f.candidateId === c.id && f.paymentMonthNumber === curMonth && f.paymentYear === curYear
    );
    if (!exists) {
      generated++;
    }
  });

  res.json({ success: true, message: `Generated fee notices for ${generated} candidates`, generated });
});

// Monthly report details
billingRouter.get('/monthly', (req, res) => {
  const m = Number(req.query.month) || (new Date().getMonth() + 1);
  const y = Number(req.query.year) || new Date().getFullYear();

  const matchedFees = feeCollections.filter(f => f.paymentMonthNumber === m && f.paymentYear === y);
  const feeTotal = matchedFees.reduce((s, f) => s + f.amount, 0);

  const matchedParties = parties.filter(p => {
    const d = new Date(p.eventDate);
    return d.getMonth() + 1 === m && d.getFullYear() === y;
  });
  const partyTotal = matchedParties.reduce((s, p) => s + p.paidAmount, 0);

  const matchedExpenses = expenses.filter(e => {
    const d = new Date(e.expenseDate);
    return d.getMonth() + 1 === m && d.getFullYear() === y;
  });
  const expTotal = matchedExpenses.reduce((s, e) => s + e.quantity * e.rate, 0);

  const matchedStaff = staffPayments.filter(p => p.paymentMonthNumber === m && p.paymentYear === y);
  const staffTotal = matchedStaff.reduce((s, p) => s + p.amount, 0);

  const totalIncome = feeTotal + partyTotal;
  const totalExpenses = expTotal;
  const totalStaffSalary = staffTotal;
  const netProfit = totalIncome - totalExpenses - totalStaffSalary;

  res.json({
    totalIncome,
    totalExpenses,
    totalStaffSalary,
    netProfit,
    details: {
      feeCollection: { total: feeTotal, count: matchedFees.length, candidates: matchedFees },
      expenses: { total: expTotal, count: matchedExpenses.length, details: matchedExpenses },
      staffSalary: { total: staffTotal, count: matchedStaff.length, payments: matchedStaff },
      partyRevenue: { total: partyTotal, count: matchedParties.length, parties: matchedParties },
    },
  });
});

// Yearly
billingRouter.get('/yearly/:year', (req, res) => {
  const year = Number(req.params.year);
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const feeInc = feeCollections
      .filter(f => f.paymentYear === year && f.paymentMonthNumber === m)
      .reduce((s, f) => s + f.amount, 0);

    const partyInc = parties
      .filter(p => {
        const d = new Date(p.eventDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, p) => s + p.paidAmount, 0);

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
    return {
      month: m,
      income,
      expenses: exp,
      staffSalary: sal,
      profit: income - exp - sal,
    };
  });
  res.json(data);
});

// Yearly Report
billingRouter.get('/report/yearly/:year', (req, res) => {
  const year = Number(req.params.year);
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalStaffSalary = 0;

  const yearlyData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const feeInc = feeCollections
      .filter(f => f.paymentYear === year && f.paymentMonthNumber === m)
      .reduce((s, f) => s + f.amount, 0);

    const partyInc = parties
      .filter(p => {
        const d = new Date(p.eventDate);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      })
      .reduce((s, p) => s + p.paidAmount, 0);

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
    yearlyData,
    totalIncome,
    totalExpenses,
    totalStaffSalary,
    totalProfit: totalIncome - totalExpenses - totalStaffSalary,
  });
});

// ================= Fees =================

billingRouter.get('/fees/summary', (req, res) => {
  const month = Number(req.query.month) || (new Date().getMonth() + 1);
  const year = Number(req.query.year) || new Date().getFullYear();

  const fees = feeCollections.filter(f => f.paymentMonthNumber === month && f.paymentYear === year);
  const totalCollected = fees.reduce((s, f) => s + f.amount, 0);
  const totalCandidates = candidates.filter(c => c.status === 'ACTIVE').length;
  const paid = fees.length;
  const pending = Math.max(0, totalCandidates - paid);

  res.json({ totalCollected, totalCandidates, paid, pending });
});

billingRouter.get('/fees/month', (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  res.json(feeCollections.filter(f => f.paymentMonthNumber === month && f.paymentYear === year));
});

billingRouter.get('/fees/candidate/:candidateId', (req, res) => {
  res.json(feeCollections.filter(f => f.candidateId === req.params.candidateId));
});

billingRouter.get('/fees/:id', (req, res) => {
  const fee = feeCollections.find(f => f.id === req.params.id);
  if (!fee) return res.status(404).json({ message: 'Fee record not found' });
  res.json(fee);
});

billingRouter.post('/fees/bulk', (req, res) => {
  const data: BulkFeeCollection = req.body;
  const created: FeeCollection[] = [];

  data.candidateFees?.forEach(cf => {
    const record: FeeCollection = {
      id: uid('fee'),
      candidateId: cf.candidateId,
      collectionDate: data.collectionDate,
      amount: cf.amount,
      paymentMonth: data.paymentMonth,
      paymentYear: data.paymentYear,
      paymentMonthNumber: data.paymentMonthNumber,
      paymentMethod: data.paymentMethod,
      remarks: cf.remarks,
      collectedByCandidateId: data.collectedByCandidateId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    feeCollections.unshift(record);
    created.push(record);
  });

  res.json({ success: true, message: `Collected fees for ${created.length} candidates`, fees: created });
});

billingRouter.post('/fees', (req, res) => {
  const data: FeeCollection = req.body;
  const newFee: FeeCollection = {
    ...data,
    id: data.id || uid('fee'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  feeCollections.unshift(newFee);
  res.status(201).json(newFee);
});

billingRouter.delete('/fees/:id', (req, res) => {
  const idx = feeCollections.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Fee record not found' });
  feeCollections.splice(idx, 1);
  res.status(204).send();
});
