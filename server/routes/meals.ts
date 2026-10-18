// server/routes/meals.ts
import { Router } from 'express';
import { meals, candidates, uid } from '../db';
import type { Meal, BulkMeal } from '../../src/types';

export const mealsRouter = Router();

// Stats today
mealsRouter.get('/stats/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = meals.filter(m => m.mealDate === today);
  const total = todayMeals.length;
  const taken = todayMeals.filter(m => m.isTaken).length;
  const notTaken = todayMeals.filter(m => !m.isTaken).length;
  res.json({ total, taken, notTaken });
});

// Daily summary
mealsRouter.get('/summary/daily', (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const dateMeals = meals.filter(m => m.mealDate === date);
  const total = dateMeals.length;
  const taken = dateMeals.filter(m => m.isTaken).length;
  const notTaken = dateMeals.filter(m => !m.isTaken).length;
  res.json({ total, taken, notTaken });
});

// Candidate summary for a month
mealsRouter.get('/candidate-summary', (req, res) => {
  const { candidateId, month, year } = req.query;
  const m = Number(month);
  const y = Number(year);

  const matched = meals.filter(meal => {
    if (meal.candidateId !== candidateId) return false;
    const d = new Date(meal.mealDate);
    return d.getMonth() + 1 === m && d.getFullYear() === y;
  });

  const total = matched.length;
  const taken = matched.filter(meal => meal.isTaken).length;
  const notTaken = total - taken;

  res.json({ total, taken, notTaken });
});

// Missed meals
mealsRouter.get('/missed', (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const mealType = req.query.mealType as string;

  const missedCandidateIds = meals
    .filter(m => m.mealDate === date && (!mealType || m.mealType === mealType) && !m.isTaken)
    .map(m => m.candidateId);

  const matchedCandidates = candidates.filter(c => missedCandidateIds.includes(c.id || ''));
  res.json(matchedCandidates);
});

// By type and date
mealsRouter.get('/type/:mealType/date/:date', (req, res) => {
  const { mealType, date } = req.params;
  res.json(meals.filter(m => m.mealType === mealType && m.mealDate === date));
});

// By date
mealsRouter.get('/date/:date', (req, res) => {
  res.json(meals.filter(m => m.mealDate === req.params.date));
});

// By candidate and date
mealsRouter.get('/candidate/:candidateId/date/:date', (req, res) => {
  const { candidateId, date } = req.params;
  res.json(meals.filter(m => m.candidateId === candidateId && m.mealDate === date));
});

// By candidate and range
mealsRouter.get('/candidate/:candidateId/range', (req, res) => {
  const { candidateId } = req.params;
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const records = meals.filter(m => {
    if (m.candidateId !== candidateId) return false;
    if (startDate && m.mealDate < startDate) return false;
    if (endDate && m.mealDate > endDate) return false;
    return true;
  });
  res.json(records);
});

// By candidate
mealsRouter.get('/candidate/:candidateId', (req, res) => {
  res.json(meals.filter(m => m.candidateId === req.params.candidateId));
});

// Bulk mark
mealsRouter.post('/bulk', (req, res) => {
  const data: BulkMeal = req.body;
  const { mealDate, mealType, candidateIds, mealPreference } = data;

  candidateIds?.forEach(cid => {
    const existing = meals.find(m => m.mealDate === mealDate && m.mealType === mealType && m.candidateId === cid);
    if (existing) {
      existing.isTaken = true;
      if (mealPreference) existing.mealPreference = mealPreference;
      existing.updatedAt = new Date().toISOString();
    } else {
      meals.push({
        id: uid('meal'),
        candidateId: cid,
        mealDate,
        mealType,
        isTaken: true,
        mealPreference: mealPreference || 'VEG',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  res.json({ success: true, message: `Marked meals for ${candidateIds?.length || 0} candidates` });
});

// Mark single
mealsRouter.post('/mark', (req, res) => {
  const data: Meal = req.body;
  const existingIdx = meals.findIndex(
    m => m.candidateId === data.candidateId && m.mealDate === data.mealDate && m.mealType === data.mealType
  );

  if (existingIdx >= 0) {
    meals[existingIdx] = {
      ...meals[existingIdx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return res.json(meals[existingIdx]);
  }

  const record: Meal = {
    ...data,
    id: data.id || uid('meal'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  meals.push(record);
  res.status(201).json(record);
});

// Get by ID
mealsRouter.get('/:id', (req, res) => {
  const m = meals.find(item => item.id === req.params.id);
  if (!m) return res.status(404).json({ message: 'Meal record not found' });
  res.json(m);
});

// Update
mealsRouter.put('/:id', (req, res) => {
  const idx = meals.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Meal not found' });
  meals[idx] = {
    ...meals[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(meals[idx]);
});

// Delete
mealsRouter.delete('/:id', (req, res) => {
  const idx = meals.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Meal not found' });
  meals.splice(idx, 1);
  res.status(204).send();
});
