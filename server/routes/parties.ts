// server/routes/parties.ts
import { Router } from 'express';
import { parties, uid } from '../db';
import type { Party, PartyPayment } from '../../src/types';

export const partiesRouter = Router();

// Generate Party ID
partiesRouter.get('/generate-id', (req, res) => {
  const curYear = new Date().getFullYear();
  const nextNum = parties.length + 1;
  res.json({ partyId: `PTY-${curYear}-${String(nextNum).padStart(2, '0')}` });
});

// Generate Invoice
partiesRouter.get('/generate-invoice', (req, res) => {
  const nextNum = parties.length + 1;
  res.json({ invoiceNumber: `INV-PTY-${String(nextNum).padStart(3, '0')}` });
});

// Summary
partiesRouter.get('/summary', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = parties.filter(p => {
    if (startDate && p.eventDate < startDate) return false;
    if (endDate && p.eventDate > endDate) return false;
    return true;
  });

  const totalParties = filtered.length;
  let totalRevenue = 0;
  let totalPaid = 0;

  filtered.forEach(p => {
    const base = p.numberOfPeople * p.thaliRate;
    const extras = p.extraItems?.reduce((s, i) => s + i.quantity * i.rate, 0) || 0;
    const disc = p.discount || 0;
    const finalAmount = Math.max(0, base + extras - disc);
    totalRevenue += finalAmount;
    totalPaid += p.paidAmount || 0;
  });

  const totalOutstanding = Math.max(0, totalRevenue - totalPaid);
  res.json({ totalParties, totalRevenue, totalPaid, totalOutstanding });
});

// Total billing
partiesRouter.get('/total-billing', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = parties.filter(p => {
    if (startDate && p.eventDate < startDate) return false;
    if (endDate && p.eventDate > endDate) return false;
    return true;
  });

  const total = filtered.reduce((sum, p) => {
    const base = p.numberOfPeople * p.thaliRate;
    const extras = p.extraItems?.reduce((s, i) => s + i.quantity * i.rate, 0) || 0;
    const disc = p.discount || 0;
    return sum + Math.max(0, base + extras - disc);
  }, 0);

  res.json({ total });
});

// Outstanding parties
partiesRouter.get('/outstanding', (req, res) => {
  const outstandingParties = parties.filter(p => p.paymentStatus !== 'PAID');
  let totalOutstanding = 0;

  outstandingParties.forEach(p => {
    const base = p.numberOfPeople * p.thaliRate;
    const extras = p.extraItems?.reduce((s, i) => s + i.quantity * i.rate, 0) || 0;
    const disc = p.discount || 0;
    const finalBill = Math.max(0, base + extras - disc);
    totalOutstanding += Math.max(0, finalBill - (p.paidAmount || 0));
  });

  res.json({ totalOutstanding, parties: outstandingParties });
});

// Monthly billing
partiesRouter.get('/monthly-billing', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const monthlyData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const matched = parties.filter(p => {
      const d = new Date(p.eventDate);
      return d.getFullYear() === year && d.getMonth() + 1 === m;
    });

    const total = matched.reduce((s, p) => {
      const base = p.numberOfPeople * p.thaliRate;
      const extras = p.extraItems?.reduce((ex, i) => ex + i.quantity * i.rate, 0) || 0;
      return s + Math.max(0, base + extras - (p.discount || 0));
    }, 0);

    return { month: m, total, count: matched.length };
  });

  res.json(monthlyData);
});

// Revenue report
partiesRouter.get('/revenue-report', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  let totalRevenue = 0;

  const monthlyData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const matched = parties.filter(p => {
      const d = new Date(p.eventDate);
      return d.getFullYear() === year && d.getMonth() + 1 === m;
    });

    const revenue = matched.reduce((s, p) => s + (p.paidAmount || 0), 0);
    totalRevenue += revenue;
    return { month: m, revenue, count: matched.length };
  });

  res.json({ totalRevenue, monthlyData });
});

// By payment status
partiesRouter.get('/payment-status/:status', (req, res) => {
  res.json(parties.filter(p => p.paymentStatus === req.params.status));
});

// By date range
partiesRouter.get('/range', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  res.json(parties.filter(p => {
    if (startDate && p.eventDate < startDate) return false;
    if (endDate && p.eventDate > endDate) return false;
    return true;
  }));
});

// By date
partiesRouter.get('/date/:date', (req, res) => {
  res.json(parties.filter(p => p.eventDate === req.params.date));
});

// By partyId
partiesRouter.get('/party-id/:partyId', (req, res) => {
  const p = parties.find(item => item.partyId === req.params.partyId);
  if (!p) return res.status(404).json({ message: 'Party not found' });
  res.json(p);
});

// Make payment
partiesRouter.post('/payments', (req, res) => {
  const data: PartyPayment = req.body;
  const p = parties.find(item => item.id === data.partyId || item.partyId === data.partyId);
  if (!p) return res.status(404).json({ message: 'Party not found' });

  p.paidAmount = (p.paidAmount || 0) + Number(data.amount);
  const base = p.numberOfPeople * p.thaliRate;
  const extras = p.extraItems?.reduce((s, i) => s + i.quantity * i.rate, 0) || 0;
  const finalBill = Math.max(0, base + extras - (p.discount || 0));

  if (p.paidAmount >= finalBill) {
    p.paymentStatus = 'PAID';
  } else if (p.paidAmount > 0) {
    p.paymentStatus = 'PARTIAL';
  }
  p.updatedAt = new Date().toISOString();

  res.json(data);
});

// Mark paid
partiesRouter.patch('/:id/mark-paid', (req, res) => {
  const p = parties.find(item => item.id === req.params.id);
  if (!p) return res.status(404).json({ message: 'Party not found' });

  const base = p.numberOfPeople * p.thaliRate;
  const extras = p.extraItems?.reduce((s, i) => s + i.quantity * i.rate, 0) || 0;
  const finalBill = Math.max(0, base + extras - (p.discount || 0));

  p.paidAmount = finalBill;
  p.paymentStatus = 'PAID';
  p.updatedAt = new Date().toISOString();
  res.json(p);
});

// Update payment status
partiesRouter.patch('/:id/payment-status', (req, res) => {
  const p = parties.find(item => item.id === req.params.id);
  if (!p) return res.status(404).json({ message: 'Party not found' });
  p.paymentStatus = (req.query.status as any) || p.paymentStatus;
  p.updatedAt = new Date().toISOString();
  res.json(p);
});

// Get all
partiesRouter.get('/', (req, res) => {
  res.json(parties);
});

// Create
partiesRouter.post('/', (req, res) => {
  const data: Party = req.body;
  const curYear = new Date().getFullYear();
  const newParty: Party = {
    ...data,
    id: data.id || uid('party'),
    partyId: data.partyId || `PTY-${curYear}-${String(parties.length + 1).padStart(2, '0')}`,
    invoiceNumber: data.invoiceNumber || `INV-PTY-${String(parties.length + 1).padStart(3, '0')}`,
    paidAmount: Number(data.paidAmount) || 0,
    paymentStatus: data.paymentStatus || 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  parties.unshift(newParty);
  res.status(201).json(newParty);
});

// Get by ID
partiesRouter.get('/:id', (req, res) => {
  const p = parties.find(item => item.id === req.params.id);
  if (!p) return res.status(404).json({ message: 'Party not found' });
  res.json(p);
});

// Update
partiesRouter.put('/:id', (req, res) => {
  const idx = parties.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Party not found' });
  parties[idx] = { ...parties[idx], ...req.body, updatedAt: new Date().toISOString() };
  res.json(parties[idx]);
});

// Delete
partiesRouter.delete('/:id', (req, res) => {
  const idx = parties.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Party not found' });
  parties.splice(idx, 1);
  res.status(204).send();
});
