// server/routes/expenses.ts
import { Router } from 'express';
import { expenses, uid } from '../db';
import type { Expense } from '../../src/types';

export const expensesRouter = Router();

// Total today
expensesRouter.get('/total/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const total = expenses
    .filter(e => e.expenseDate === today)
    .reduce((sum, e) => sum + (e.quantity * e.rate), 0);
  res.json({ total });
});

// Total range
expensesRouter.get('/total', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = expenses.filter(e => {
    if (startDate && e.expenseDate < startDate) return false;
    if (endDate && e.expenseDate > endDate) return false;
    return true;
  });
  const total = filtered.reduce((sum, e) => sum + (e.quantity * e.rate), 0);
  res.json({ total });
});

// Summary
expensesRouter.get('/summary', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = expenses.filter(e => {
    if (startDate && e.expenseDate < startDate) return false;
    if (endDate && e.expenseDate > endDate) return false;
    return true;
  });

  const categories: Record<string, number> = {};
  let total = 0;

  filtered.forEach(e => {
    const cost = e.quantity * e.rate;
    total += cost;
    categories[e.category] = (categories[e.category] || 0) + cost;
  });

  res.json({ total, count: filtered.length, categories });
});

// Category wise
expensesRouter.get('/category-wise', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = expenses.filter(e => {
    if (startDate && e.expenseDate < startDate) return false;
    if (endDate && e.expenseDate > endDate) return false;
    return true;
  });

  const categories: Record<string, number> = {};
  filtered.forEach(e => {
    const cost = e.quantity * e.rate;
    categories[e.category] = (categories[e.category] || 0) + cost;
  });

  res.json(categories);
});

// Monthly for a year
expensesRouter.get('/monthly', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const monthlyTotals: Array<{ month: number; total: number }> = [];

  for (let m = 1; m <= 12; m++) {
    const total = expenses
      .filter(e => {
        const d = new Date(e.expenseDate);
        return d.getFullYear() === year && (d.getMonth() + 1) === m;
      })
      .reduce((sum, e) => sum + (e.quantity * e.rate), 0);
    monthlyTotals.push({ month: m, total });
  }

  res.json(monthlyTotals);
});

// Daily for month and year
expensesRouter.get('/daily/:month/:year', (req, res) => {
  const m = Number(req.params.month);
  const y = Number(req.params.year);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dailyTotals: Array<{ day: number; total: number }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const total = expenses
      .filter(e => e.expenseDate === dayStr)
      .reduce((sum, e) => sum + (e.quantity * e.rate), 0);
    dailyTotals.push({ day: d, total });
  }

  res.json(dailyTotals);
});

// Category and date range
expensesRouter.get('/category/:category/range', (req, res) => {
  const { category } = req.params;
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = expenses.filter(e => {
    if (e.category.toLowerCase() !== decodeURIComponent(category).toLowerCase()) return false;
    if (startDate && e.expenseDate < startDate) return false;
    if (endDate && e.expenseDate > endDate) return false;
    return true;
  });
  res.json(filtered);
});

// By category
expensesRouter.get('/category/:category', (req, res) => {
  const { category } = req.params;
  res.json(expenses.filter(e => e.category.toLowerCase() === decodeURIComponent(category).toLowerCase()));
});

// Range
expensesRouter.get('/range', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = expenses.filter(e => {
    if (startDate && e.expenseDate < startDate) return false;
    if (endDate && e.expenseDate > endDate) return false;
    return true;
  });
  res.json(filtered);
});

// By date
expensesRouter.get('/date/:date', (req, res) => {
  res.json(expenses.filter(e => e.expenseDate === req.params.date));
});

// Get all
expensesRouter.get('/', (req, res) => {
  res.json(expenses);
});

// Create
expensesRouter.post('/', (req, res) => {
  const data: Expense = req.body;
  const newExp: Expense = {
    ...data,
    id: data.id || uid('exp'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  expenses.unshift(newExp);
  res.status(201).json(newExp);
});

// Get by ID
expensesRouter.get('/:id', (req, res) => {
  const e = expenses.find(item => item.id === req.params.id);
  if (!e) return res.status(404).json({ message: 'Expense not found' });
  res.json(e);
});

// Update
expensesRouter.put('/:id', (req, res) => {
  const idx = expenses.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Expense not found' });
  expenses[idx] = {
    ...expenses[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(expenses[idx]);
});

// Delete
expensesRouter.delete('/:id', (req, res) => {
  const idx = expenses.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Expense not found' });
  expenses.splice(idx, 1);
  res.status(204).send();
});
