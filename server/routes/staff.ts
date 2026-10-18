// server/routes/staff.ts
import { Router } from 'express';
import { staffList, staffPayments, staffAdvances, uid } from '../db';
import type { Staff, StaffPayment, StaffAdvance } from '../../src/types';

export const staffRouter = Router();

// Generate staff ID
staffRouter.get('/generate-id', (req, res) => {
  const nextNum = staffList.length + 1;
  res.json({ staffId: `STF-${String(nextNum).padStart(2, '0')}` });
});

// Summary
staffRouter.get('/summary', (req, res) => {
  const totalStaff = staffList.length;
  const totalMonthlySalary = staffList
    .filter(s => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + s.baseSalary, 0);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const totalPaidThisMonth = staffPayments
    .filter(p => p.paymentMonthNumber === currentMonth && p.paymentYear === currentYear)
    .reduce((sum, p) => sum + p.amount, 0);

  res.json({ totalStaff, totalMonthlySalary, totalPaidThisMonth });
});

// Summary for specific staff
staffRouter.get('/summary/:staffId', (req, res) => {
  const staff = staffList.find(s => s.id === req.params.staffId || s.staffId === req.params.staffId);
  if (!staff) return res.status(404).json({ message: 'Staff member not found' });

  const payments = staffPayments.filter(p => p.staffId === staff.id || p.staffId === staff.staffId);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const lastPayment = payments[0];

  const advances = staffAdvances.filter(a => (a.staffId === staff.id || a.staffId === staff.staffId) && a.status === 'APPROVED');
  const outstandingAdvances = advances.reduce((sum, a) => sum + (a.remainingAmount || 0), 0);

  res.json({ staff, totalPaid, outstandingAdvances, lastPayment });
});

// Monthly report
staffRouter.get('/report/monthly', (req, res) => {
  const month = Number(req.query.month) || (new Date().getMonth() + 1);
  const year = Number(req.query.year) || new Date().getFullYear();

  const payments = staffPayments.filter(p => p.paymentMonthNumber === month && p.paymentYear === year);
  const totalSalary = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalBonus = payments.reduce((sum, p) => sum + (p.bonus || 0), 0);
  const totalDeductions = payments.reduce((sum, p) => sum + (p.deductions || 0), 0);
  const netPayable = totalSalary + totalBonus - totalDeductions;

  res.json({ totalSalary, totalBonus, totalDeductions, netPayable });
});

// Yearly report
staffRouter.get('/report/yearly', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const result: Array<{ month: number; totalPaid: number }> = [];

  for (let m = 1; m <= 12; m++) {
    const totalPaid = staffPayments
      .filter(p => p.paymentYear === year && p.paymentMonthNumber === m)
      .reduce((sum, p) => sum + p.amount, 0);
    result.push({ month: m, totalPaid });
  }

  res.json(result);
});

// Active staff
staffRouter.get('/active', (req, res) => {
  res.json(staffList.filter(s => s.status === 'ACTIVE'));
});

// By position
staffRouter.get('/position/:position', (req, res) => {
  const pos = decodeURIComponent(req.params.position).toLowerCase();
  res.json(staffList.filter(s => s.position.toLowerCase() === pos));
});

// By Staff ID string
staffRouter.get('/staff-id/:staffId', (req, res) => {
  const s = staffList.find(item => item.staffId === req.params.staffId);
  if (!s) return res.status(404).json({ message: 'Staff member not found' });
  res.json(s);
});

// ================= Payments =================

staffRouter.get('/payments', (req, res) => {
  res.json(staffPayments);
});

staffRouter.get('/payments/total', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const payments = staffPayments.filter(p => {
    if (startDate && p.paymentDate < startDate) return false;
    if (endDate && p.paymentDate > endDate) return false;
    return true;
  });
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  res.json({ total });
});

staffRouter.get('/payments/range', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  res.json(staffPayments.filter(p => {
    if (startDate && p.paymentDate < startDate) return false;
    if (endDate && p.paymentDate > endDate) return false;
    return true;
  }));
});

staffRouter.get('/payments/staff/:staffId/year/:year', (req, res) => {
  const { staffId, year } = req.params;
  res.json(staffPayments.filter(p => (p.staffId === staffId) && p.paymentYear === Number(year)));
});

staffRouter.get('/payments/staff/:staffId', (req, res) => {
  res.json(staffPayments.filter(p => p.staffId === req.params.staffId));
});

staffRouter.get('/payments/:id', (req, res) => {
  const p = staffPayments.find(item => item.id === req.params.id);
  if (!p) return res.status(404).json({ message: 'Staff payment not found' });
  res.json(p);
});

staffRouter.post('/payments', (req, res) => {
  const data: StaffPayment = req.body;
  const newPay: StaffPayment = {
    ...data,
    id: data.id || uid('spay'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  staffPayments.unshift(newPay);
  res.status(201).json(newPay);
});

staffRouter.delete('/payments/:id', (req, res) => {
  const idx = staffPayments.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Payment not found' });
  staffPayments.splice(idx, 1);
  res.status(204).send();
});

// ================= Advances =================

staffRouter.get('/advances', (req, res) => {
  res.json(staffAdvances);
});

staffRouter.get('/advances/pending', (req, res) => {
  res.json(staffAdvances.filter(a => a.status === 'PENDING'));
});

staffRouter.get('/advances/outstanding/:staffId', (req, res) => {
  const { staffId } = req.params;
  const advances = staffAdvances.filter(a => a.staffId === staffId && a.status === 'APPROVED');
  const totalOutstanding = advances.reduce((sum, a) => sum + (a.remainingAmount || 0), 0);
  res.json({ totalOutstanding, advances });
});

staffRouter.get('/advances/staff/:staffId', (req, res) => {
  res.json(staffAdvances.filter(a => a.staffId === req.params.staffId));
});

staffRouter.get('/advances/:id', (req, res) => {
  const adv = staffAdvances.find(a => a.id === req.params.id);
  if (!adv) return res.status(404).json({ message: 'Advance record not found' });
  res.json(adv);
});

staffRouter.post('/advances', (req, res) => {
  const data: StaffAdvance = req.body;
  const newAdv: StaffAdvance = {
    ...data,
    id: data.id || uid('sadv'),
    status: data.status || 'PENDING',
    remainingAmount: data.amount,
    repaidAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  staffAdvances.unshift(newAdv);
  res.status(201).json(newAdv);
});

staffRouter.put('/advances/:id', (req, res) => {
  const idx = staffAdvances.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Advance not found' });
  staffAdvances[idx] = { ...staffAdvances[idx], ...req.body, updatedAt: new Date().toISOString() };
  res.json(staffAdvances[idx]);
});

staffRouter.patch('/advances/:id/approve', (req, res) => {
  const idx = staffAdvances.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Advance not found' });
  staffAdvances[idx].status = 'APPROVED';
  staffAdvances[idx].approvedByCandidateId = req.query.approvedByCandidateId as string;
  staffAdvances[idx].approvedAt = new Date().toISOString();
  staffAdvances[idx].updatedAt = new Date().toISOString();
  res.json(staffAdvances[idx]);
});

staffRouter.patch('/advances/:id/reject', (req, res) => {
  const idx = staffAdvances.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Advance not found' });
  staffAdvances[idx].status = 'REJECTED';
  staffAdvances[idx].updatedAt = new Date().toISOString();
  res.json(staffAdvances[idx]);
});

staffRouter.patch('/advances/:id/repay', (req, res) => {
  const idx = staffAdvances.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Advance not found' });
  const repaymentAmount = Number(req.query.repaymentAmount) || 0;
  const adv = staffAdvances[idx];

  adv.repaidAmount = (adv.repaidAmount || 0) + repaymentAmount;
  adv.remainingAmount = Math.max(0, adv.amount - adv.repaidAmount);
  if (adv.remainingAmount <= 0) {
    adv.status = 'REPAID';
  }
  adv.updatedAt = new Date().toISOString();
  res.json(adv);
});

staffRouter.delete('/advances/:id', (req, res) => {
  const idx = staffAdvances.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Advance not found' });
  staffAdvances.splice(idx, 1);
  res.status(204).send();
});

// ================= Staff CRUD =================

staffRouter.get('/', (req, res) => {
  res.json(staffList);
});

staffRouter.post('/', (req, res) => {
  const data: Staff = req.body;
  const newStaff: Staff = {
    ...data,
    id: data.id || uid('staff'),
    staffId: data.staffId || `STF-${String(staffList.length + 1).padStart(2, '0')}`,
    status: data.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  staffList.unshift(newStaff);
  res.status(201).json(newStaff);
});

staffRouter.get('/:id', (req, res) => {
  const s = staffList.find(item => item.id === req.params.id);
  if (!s) return res.status(404).json({ message: 'Staff member not found' });
  res.json(s);
});

staffRouter.put('/:id', (req, res) => {
  const idx = staffList.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Staff member not found' });
  staffList[idx] = { ...staffList[idx], ...req.body, updatedAt: new Date().toISOString() };
  res.json(staffList[idx]);
});

staffRouter.patch('/:id/toggle', (req, res) => {
  const idx = staffList.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Staff member not found' });
  staffList[idx].status = staffList[idx].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  staffList[idx].updatedAt = new Date().toISOString();
  res.json(staffList[idx]);
});

staffRouter.delete('/:id', (req, res) => {
  const idx = staffList.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Staff member not found' });
  staffList.splice(idx, 1);
  res.status(204).send();
});
