// server/routes/candidates.ts
import { Router } from 'express';
import { candidates, uid } from '../db';
import type { Candidate } from '../../src/types';

export const candidatesRouter = Router();

// Stats
candidatesRouter.get('/stats', (req, res) => {
  const total = candidates.length;
  const active = candidates.filter(c => c.status === 'ACTIVE').length;
  const left = candidates.filter(c => c.status === 'LEFT').length;
  res.json({ total, active, left });
});

// Active
candidatesRouter.get('/active', (req, res) => {
  res.json(candidates.filter(c => c.status === 'ACTIVE'));
});

// Left
candidatesRouter.get('/left', (req, res) => {
  res.json(candidates.filter(c => c.status === 'LEFT'));
});

// Get by candidateId
candidatesRouter.get('/by-id/:candidateId', (req, res) => {
  const c = candidates.find(item => item.candidateId === req.params.candidateId);
  if (!c) return res.status(404).json({ message: 'Candidate not found' });
  res.json(c);
});

// Get by ID
candidatesRouter.get('/:id', (req, res) => {
  const c = candidates.find(item => item.id === req.params.id);
  if (!c) return res.status(404).json({ message: 'Candidate not found' });
  res.json(c);
});

// Get all
candidatesRouter.get('/', (req, res) => {
  res.json(candidates);
});

// Create
candidatesRouter.post('/', (req, res) => {
  const data: Candidate = req.body;
  const newCandidate: Candidate = {
    ...data,
    id: data.id || uid('cand'),
    candidateId: data.candidateId || `CAND-00${candidates.length + 1}`,
    status: data.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  candidates.unshift(newCandidate);
  res.status(201).json(newCandidate);
});

// Update
candidatesRouter.put('/:id', (req, res) => {
  const idx = candidates.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Candidate not found' });
  candidates[idx] = {
    ...candidates[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(candidates[idx]);
});

// Mark Left
candidatesRouter.patch('/:id/mark-left', (req, res) => {
  const idx = candidates.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Candidate not found' });
  const leavingDate = (req.query.leavingDate as string) || new Date().toISOString().split('T')[0];
  candidates[idx] = {
    ...candidates[idx],
    status: 'LEFT',
    leavingDate,
    updatedAt: new Date().toISOString(),
  };
  res.json(candidates[idx]);
});

// Delete
candidatesRouter.delete('/:id', (req, res) => {
  const idx = candidates.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Candidate not found' });
  candidates.splice(idx, 1);
  res.status(204).send();
});
