// src/pages/MealsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  Coffee,
  Sun,
  Moon,
  Cookie,
  CheckCheck,
  RefreshCw,
  Search,
  Filter,
  UserX
} from 'lucide-react';
import api from '../api';
import type { Candidate, Meal } from '../types';

interface MealsPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const MealsPage: React.FC<MealsPageProps> = ({ searchTerm, showToast }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [mealType, setMealType] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACKS'>('LUNCH');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  // KPI cards are calculated from the roster and meal log below, not fetched separately.
  // "Missed" = active members with a meal record for this date/slot that is marked not taken.
  const missedList = useMemo(
    () => candidates.filter((c) => meals.some((m) => m.candidateId === c.id && !m.isTaken)),
    [candidates, meals]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      // Roster comes from the shared candidate list (cached by the Dashboard), so the
      // only new request here is the meal log for the chosen date and slot.
      const [all, mList] = await Promise.all([
        api.candidate.getAll(),
        api.meal.getByTypeAndDate(mealType, selectedDate),
      ]);
      setCandidates((Array.isArray(all) ? all : []).filter((c) => c.status === 'ACTIVE'));
      setMeals(Array.isArray(mList) ? mList : []);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load meal tracker data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, mealType]);

  const handleMarkMeal = async (candidateId: string, isTaken: boolean, pref: 'VEG' | 'NON_VEG' = 'VEG') => {
    try {
      await api.meal.mark({
        candidateId,
        mealDate: selectedDate,
        mealType,
        isTaken,
        mealPreference: pref,
        remarks: isTaken ? 'Recorded at counter' : 'Opted out',
      });
      showToast('success', `Meal status updated`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update meal');
    }
  };

  const handleBulkMarkAll = async (preference: 'VEG' | 'NON_VEG' = 'VEG') => {
    try {
      const activeIds = candidates.map(c => c.id || '');
      await api.meal.bulkMark({
        mealDate: selectedDate,
        mealType,
        candidateIds: activeIds,
        mealPreference: preference,
      });
      showToast('success', `Marked ${mealType} served for all active candidates`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Bulk mark failed');
    }
  };

  const getCandidateMeal = (cid?: string) => {
    if (!cid) return null;
    return meals.find(m => m.candidateId === cid);
  };

  const filteredCandidates = candidates.filter(c => {
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

  const mealIcons = {
    BREAKFAST: Coffee,
    LUNCH: Sun,
    SNACKS: Cookie,
    DINNER: Moon,
  };

  const CurrentMealIcon = mealIcons[mealType];

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-700">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Meal selector buttons */}
          <div className="flex items-center space-x-1 bg-slate-100/80 border border-slate-200/60 p-1 rounded-lg">
            {(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as const).map(type => {
              const Icon = mealIcons[type];
              const isSelected = mealType === type;
              return (
                <button
                  key={type}
                  onClick={() => setMealType(type)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{type}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleBulkMarkAll('VEG')}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-xs font-medium transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Mark All (Veg) Served</span>
          </button>

          <button
            onClick={() => { api.clearCache(); loadData(); }}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Candidates In Mess</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{candidates.length}</div>
          </div>
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
            <CurrentMealIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-green-700 font-medium">{mealType} Consumed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {meals.filter(m => m.isTaken).length}
            </div>
          </div>
          <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-rose-700 font-medium">Missed / Not Served</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">
              {missedList.length}
            </div>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <UserX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Meals Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Candidate</th>
              <th className="py-3 px-4">Dietary Preference</th>
              <th className="py-3 px-4">Meal Log</th>
              <th className="py-3 px-4">Remarks</th>
              <th className="py-3 px-4 text-right">Quick Mark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredCandidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No candidates found for {mealType}.
                </td>
              </tr>
            ) : (
              filteredCandidates.map(c => {
                const meal = getCandidateMeal(c.id);
                const isTaken = meal?.isTaken || false;
                const pref = meal?.mealPreference || (c.notes?.toLowerCase().includes('non-veg') ? 'NON_VEG' : 'VEG');

                return (
                  <tr key={c.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{c.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{c.candidateId} • {c.address}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        pref === 'NON_VEG'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-green-100 text-green-800 border border-green-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${pref === 'NON_VEG' ? 'bg-rose-600' : 'bg-green-600'}`}></span>
                        {pref === 'NON_VEG' ? 'Non-Veg' : 'Pure Veg'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {isTaken ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-700" /> Served
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle className="w-3.5 h-3.5 mr-1 text-slate-400" /> Not Taken
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {meal?.remarks || c.notes || 'Standard mess plate'}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleMarkMeal(c.id!, true, 'VEG')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          isTaken && pref === 'VEG'
                            ? 'bg-green-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-green-50 hover:text-green-800'
                        }`}
                      >
                        Veg Plate
                      </button>

                      <button
                        onClick={() => handleMarkMeal(c.id!, true, 'NON_VEG')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          isTaken && pref === 'NON_VEG'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800'
                        }`}
                      >
                        Non-Veg
                      </button>

                      <button
                        onClick={() => handleMarkMeal(c.id!, false)}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                          !isTaken
                            ? 'bg-slate-200 text-slate-800 font-semibold'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        Skipped
                      </button>
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
