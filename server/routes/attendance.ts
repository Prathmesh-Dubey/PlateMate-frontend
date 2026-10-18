// server/routes/attendance.ts
import { Router } from 'express';
import { attendances, candidates, uid } from '../db';
import type { Attendance, BulkAttendance } from '../../src/types';

export const attendanceRouter = Router();

// Stats today
attendanceRouter.get('/stats/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = attendances.filter(a => a.attendanceDate === today);
  const present = todayRecords.filter(a => a.status === 'IN' || a.status === 'HALF_DAY').length;
  const absent = todayRecords.filter(a => a.status === 'ABSENT').length;
  const total = candidates.filter(c => c.status === 'ACTIVE').length;
  res.json({ present, absent, total });
});

// Daily summary
attendanceRouter.get('/summary/daily', (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const dateRecords = attendances.filter(a => a.attendanceDate === date);
  const present = dateRecords.filter(a => a.status === 'IN' || a.status === 'HALF_DAY').length;
  const absent = dateRecords.filter(a => a.status === 'ABSENT').length;
  const total = candidates.filter(c => c.status === 'ACTIVE').length;
  res.json({ present, absent, total });
});

// Monthly summary for candidate
attendanceRouter.get('/monthly-summary', (req, res) => {
  const { candidateId, month, year } = req.query;
  const m = Number(month);
  const y = Number(year);

  const matched = attendances.filter(a => {
    if (a.candidateId !== candidateId) return false;
    const d = new Date(a.attendanceDate);
    return d.getMonth() + 1 === m && d.getFullYear() === y;
  });

  const present = matched.filter(a => a.status === 'IN').length;
  const absent = matched.filter(a => a.status === 'ABSENT').length;
  const total = matched.length;

  res.json({ present, absent, total });
});

// Present on date
attendanceRouter.get('/present/:date', (req, res) => {
  const date = req.params.date;
  const presentIds = attendances
    .filter(a => a.attendanceDate === date && (a.status === 'IN' || a.status === 'HALF_DAY'))
    .map(a => a.candidateId);
  const matched = candidates.filter(c => presentIds.includes(c.id || '') || presentIds.includes(c.candidateId || ''));
  res.json(matched);
});

// Absent on date
attendanceRouter.get('/absent/:date', (req, res) => {
  const date = req.params.date;
  const absentIds = attendances
    .filter(a => a.attendanceDate === date && a.status === 'ABSENT')
    .map(a => a.candidateId);
  const matched = candidates.filter(c => absentIds.includes(c.id || '') || absentIds.includes(c.candidateId || ''));
  res.json(matched);
});

// Get by date
attendanceRouter.get('/date/:date', (req, res) => {
  res.json(attendances.filter(a => a.attendanceDate === req.params.date));
});

// Get by candidate and range
attendanceRouter.get('/candidate/:candidateId/range', (req, res) => {
  const { candidateId } = req.params;
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const records = attendances.filter(a => {
    if (a.candidateId !== candidateId) return false;
    if (startDate && a.attendanceDate < startDate) return false;
    if (endDate && a.attendanceDate > endDate) return false;
    return true;
  });
  res.json(records);
});

// Get by candidate
attendanceRouter.get('/candidate/:candidateId', (req, res) => {
  res.json(attendances.filter(a => a.candidateId === req.params.candidateId));
});

// Bulk mark
attendanceRouter.post('/bulk', (req, res) => {
  const data: BulkAttendance = req.body;
  const { attendanceDate, presentCandidateIds, absentCandidateIds } = data;

  presentCandidateIds?.forEach(cid => {
    const existing = attendances.find(a => a.attendanceDate === attendanceDate && a.candidateId === cid);
    if (existing) {
      existing.status = 'IN';
      existing.updatedAt = new Date().toISOString();
    } else {
      attendances.push({
        id: uid('att'),
        candidateId: cid,
        attendanceDate,
        status: 'IN',
        inTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  absentCandidateIds?.forEach(cid => {
    const existing = attendances.find(a => a.attendanceDate === attendanceDate && a.candidateId === cid);
    if (existing) {
      existing.status = 'ABSENT';
      existing.updatedAt = new Date().toISOString();
    } else {
      attendances.push({
        id: uid('att'),
        candidateId: cid,
        attendanceDate,
        status: 'ABSENT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  res.json({ success: true, message: 'Bulk attendance recorded successfully' });
});

// Auto mark absent for unrecorded active candidates today
attendanceRouter.post('/auto-mark-absent', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const activeCandidates = candidates.filter(c => c.status === 'ACTIVE');
  let count = 0;

  activeCandidates.forEach(cand => {
    const cid = cand.id!;
    const exists = attendances.some(a => a.candidateId === cid && a.attendanceDate === today);
    if (!exists) {
      attendances.push({
        id: uid('att'),
        candidateId: cid,
        attendanceDate: today,
        status: 'ABSENT',
        remarks: 'Auto-marked absent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      count++;
    }
  });

  res.json({ success: true, message: `Auto-marked ${count} candidates as absent for today` });
});

// Mark single
attendanceRouter.post('/mark', (req, res) => {
  const data: Attendance = req.body;
  const existingIndex = attendances.findIndex(
    a => a.candidateId === data.candidateId && a.attendanceDate === data.attendanceDate
  );

  if (existingIndex >= 0) {
    attendances[existingIndex] = {
      ...attendances[existingIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return res.json(attendances[existingIndex]);
  }

  const record: Attendance = {
    ...data,
    id: data.id || uid('att'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  attendances.push(record);
  res.status(201).json(record);
});

// Get by ID
attendanceRouter.get('/:id', (req, res) => {
  const att = attendances.find(a => a.id === req.params.id);
  if (!att) return res.status(404).json({ message: 'Attendance record not found' });
  res.json(att);
});

// Update
attendanceRouter.put('/:id', (req, res) => {
  const idx = attendances.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Attendance not found' });
  attendances[idx] = {
    ...attendances[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(attendances[idx]);
});

// Delete
attendanceRouter.delete('/:id', (req, res) => {
  const idx = attendances.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Attendance not found' });
  attendances.splice(idx, 1);
  res.status(204).send();
});
