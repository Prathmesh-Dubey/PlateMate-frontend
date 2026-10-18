// src/pages/AttendancePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  CheckCheck,
  UserX,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import api from '../api';
import type { Candidate, Attendance } from '../types';

interface AttendancePageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ searchTerm, showToast }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  const [loading, setLoading] = useState(true);

  // Summary boxes are calculated from the two lists below, not fetched from the backend
  const summary = useMemo(() => {
    const present = attendances.filter(
      (a) => a.status === 'IN' || a.status === 'HALF_DAY'
    ).length;
    return { present, absent: Math.max(0, candidates.length - present), total: candidates.length };
  }, [attendances, candidates]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Roster comes from the shared candidate list (already cached by the Dashboard),
      // so this page only costs one new request: that day's attendance.
      const [all, attList] = await Promise.all([
        api.candidate.getAll(),
        api.attendance.getByDate(selectedDate),
      ]);
      setCandidates((Array.isArray(all) ? all : []).filter((c) => c.status === 'ACTIVE'));
      setAttendances(Array.isArray(attList) ? attList : []);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleMark = async (candidateId: string, status: 'IN' | 'ABSENT' | 'HALF_DAY') => {
    try {
      await api.attendance.mark({
        candidateId,
        attendanceDate: selectedDate,
        status,
        inTime: status === 'IN' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      });
      showToast('success', `Attendance updated to ${status}`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update attendance');
    }
  };

  const handleBulkMarkAllPresent = async () => {
    try {
      const activeIds = candidates.map(c => c.id || '');
      await api.attendance.bulkMark({
        attendanceDate: selectedDate,
        presentCandidateIds: activeIds,
        absentCandidateIds: [],
      });
      showToast('success', `Marked all ${activeIds.length} candidates present`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Bulk mark failed');
    }
  };

  const handleAutoMarkAbsent = async () => {
    try {
      const res = await api.attendance.autoMarkAbsent();
      showToast('success', res.message);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Auto mark absent failed');
    }
  };

  const getCandidateAttendance = (cid?: string) => {
    if (!cid) return null;
    return attendances.find(a => a.candidateId === cid);
  };

  const filteredCandidates = candidates.filter(c => {
    const att = getCandidateAttendance(c.id);
    const isPresent = att?.status === 'IN' || att?.status === 'HALF_DAY';
    const isAbsent = att?.status === 'ABSENT';

    if (statusFilter === 'PRESENT' && !isPresent) return false;
    if (statusFilter === 'ABSENT' && !isAbsent) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.phoneNumber.toLowerCase().includes(q) ||
        (c.candidateId && c.candidateId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Date & Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <label className="text-xs font-semibold text-slate-700">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBulkMarkAllPresent}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-xs font-medium transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Mark All Present</span>
          </button>

          <button
            onClick={handleAutoMarkAbsent}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors"
          >
            <UserX className="w-3.5 h-3.5 text-slate-600" />
            <span>Auto-Mark Unrecorded as Absent</span>
          </button>

          <button
            onClick={() => { api.clearCache(); loadData(); }}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Active Members</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{candidates.length}</div>
          </div>
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-green-700 font-medium">Present in Mess</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{summary.present}</div>
          </div>
          <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-rose-700 font-medium">Absent / On Leave</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">{summary.absent}</div>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1.5 bg-slate-100/80 border border-slate-200/60 p-1 rounded-lg w-fit">
        {(['ALL', 'PRESENT', 'ABSENT'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === tab
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'ALL' && `All Members (${candidates.length})`}
            {tab === 'PRESENT' && `Present (${summary.present})`}
            {tab === 'ABSENT' && `Absent (${summary.absent})`}
          </button>
        ))}
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Candidate</th>
              <th className="py-3 px-4">Room & Phone</th>
              <th className="py-3 px-4">Recorded Status</th>
              <th className="py-3 px-4">In-Time</th>
              <th className="py-3 px-4">Quick Mark Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredCandidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No records found for {selectedDate}.
                </td>
              </tr>
            ) : (
              filteredCandidates.map(c => {
                const att = getCandidateAttendance(c.id);
                const status = att ? att.status : 'UNRECORDED';

                return (
                  <tr key={c.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{c.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{c.candidateId}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800">{c.address}</div>
                      <div className="text-[11px] text-slate-500">{c.phoneNumber}</div>
                    </td>

                    <td className="py-3 px-4">
                      {status === 'IN' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-green-700" /> Present (In)
                        </span>
                      )}
                      {status === 'ABSENT' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-200">
                          <XCircle className="w-3 h-3 mr-1 text-rose-600" /> Absent
                        </span>
                      )}
                      {status === 'HALF_DAY' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          Half Day
                        </span>
                      )}
                      {status === 'UNRECORDED' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Not Recorded
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {att?.inTime ? (
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1 text-slate-400" /> {att.inTime}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleMark(c.id!, 'IN')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            status === 'IN'
                              ? 'bg-green-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-green-50 hover:text-green-800'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => handleMark(c.id!, 'ABSENT')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            status === 'ABSENT'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800'
                          }`}
                        >
                          Absent
                        </button>
                        <button
                          onClick={() => handleMark(c.id!, 'HALF_DAY')}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            status === 'HALF_DAY'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                          }`}
                        >
                          Half Day
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
