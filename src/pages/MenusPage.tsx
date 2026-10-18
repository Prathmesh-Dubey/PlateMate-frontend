// src/pages/MenusPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Printer,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
} from 'lucide-react';
interface MenusPageProps {
  searchTerm: string;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

type MealKey = 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';

const DAYS: Array<{ label: string; offset: number }> = [
  { label: 'Monday', offset: 0 },
  { label: 'Tuesday', offset: 1 },
  { label: 'Wednesday', offset: 2 },
  { label: 'Thursday', offset: 3 },
  { label: 'Friday', offset: 4 },
  { label: 'Saturday', offset: 5 },
  { label: 'Sunday', offset: 6 },
];

const ALL_MEALS: Array<{ key: MealKey; label: string }> = [
  { key: 'BREAKFAST', label: 'Breakfast' },
  { key: 'LUNCH', label: 'Lunch' },
  { key: 'SNACKS', label: 'Evening' },
  { key: 'DINNER', label: 'Dinner' },
];

type CellMap = Record<string, Partial<Record<MealKey, string>>>;

const CELLS_KEY = 'messMenuCells_v2';
const VENDOR_KEY = 'messMenuVendor_v2';
const LOC_KEY = 'messMenuLocation_v2';
const DOC_NO_KEY = 'messMenuDocNo_v1';
const REV_NO_KEY = 'messMenuRevNo_v1';

// ---------- Date helpers ----------
const mondayOfWeek = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

const getDayISO = (weekStart: string, offset: number): string => {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const shiftWeek = (weekStart: string, deltaDays: number): string => {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split('T')[0];
};

const fmtDDMMYYYY = (iso: string): string => {
  const d = new Date(iso + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Matches the doc-info box on the official template, which uses a 2-digit year (e.g. 03/08/26)
const fmtDDMMYY = (iso: string): string => {
  const d = new Date(iso + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

// ============================================================
// COMPONENT
// ============================================================
export const MenusPage: React.FC<MenusPageProps> = ({ showToast }) => {
  const [weekStart, setWeekStart] = useState<string>(mondayOfWeek());

  const [cells, setCells] = useState<CellMap>(() => {
    try {
      const raw = localStorage.getItem(CELLS_KEY);
      return raw ? (JSON.parse(raw) as CellMap) : {};
    } catch {
      return {};
    }
  });

  const [vendorName, setVendorName] = useState<string>(
    () => localStorage.getItem(VENDOR_KEY) || 'Om Sai Caterers'
  );
  const [location, setLocation] = useState<string>(
    () => localStorage.getItem(LOC_KEY) || 'PCCOE, Girls Hostel'
  );
  const [docNo, setDocNo] = useState<string>(
    () => localStorage.getItem(DOC_NO_KEY) || 'CAM/DI/0'
  );
  const [revNo, setRevNo] = useState<string>(
    () => localStorage.getItem(REV_NO_KEY) || '0.0'
  );

  useEffect(() => {
    try { localStorage.setItem(CELLS_KEY, JSON.stringify(cells)); } catch { /* noop */ }
  }, [cells]);
  useEffect(() => { localStorage.setItem(VENDOR_KEY, vendorName); }, [vendorName]);
  useEffect(() => { localStorage.setItem(LOC_KEY, location); }, [location]);
  useEffect(() => { localStorage.setItem(DOC_NO_KEY, docNo); }, [docNo]);
  useEffect(() => { localStorage.setItem(REV_NO_KEY, revNo); }, [revNo]);

  const weekEndISO = useMemo(() => getDayISO(weekStart, 6), [weekStart]);
  const weekRangeText = `${fmtDDMMYYYY(weekStart)} To ${fmtDDMMYYYY(weekEndISO)}`;
  const docDate = fmtDDMMYY(weekStart);

  const setCell = (dateISO: string, meal: MealKey, value: string) => {
    setCells((prev) => {
      const day = { ...(prev[dateISO] || {}) };
      day[meal] = value;
      return { ...prev, [dateISO]: day };
    });
  };

  const clearWeek = () => {
    if (!window.confirm('Clear all dishes for this week?')) return;
    setCells((prev) => {
      const next = { ...prev };
      DAYS.forEach((d) => delete next[getDayISO(weekStart, d.offset)]);
      return next;
    });
    showToast('info', 'Week cleared');
  };

  const copyPrevWeek = () => {
    const prevStart = shiftWeek(weekStart, -7);
    let copied = 0;
    setCells((prev) => {
      const next = { ...prev };
      DAYS.forEach((d) => {
        const from = getDayISO(prevStart, d.offset);
        const to = getDayISO(weekStart, d.offset);
        if (prev[from]) {
          next[to] = { ...prev[from] };
          copied++;
        }
      });
      return next;
    });
    showToast(
      copied > 0 ? 'success' : 'info',
      copied > 0 ? `Copied ${copied} day(s) from previous week` : 'No data last week'
    );
  };

  const copyNextWeek = () => {
    const nextStart = shiftWeek(weekStart, 7);
    let copied = 0;
    setCells((prev) => {
      const next = { ...prev };
      DAYS.forEach((d) => {
        const from = getDayISO(weekStart, d.offset);
        const to = getDayISO(nextStart, d.offset);
        if (prev[from]) {
          next[to] = { ...prev[from] };
          copied++;
        }
      });
      return next;
    });
    showToast(
      copied > 0 ? 'success' : 'info',
      copied > 0 ? `Copied ${copied} day(s) to next week` : 'Nothing to copy'
    );
  };

  // ============================================================
  // PRINT — native browser print with a dedicated @media print
  // stylesheet. No popups, no canvas rendering, no async image
  // races — this always opens the OS print dialog, from which
  // "Save as PDF" is available on every major browser.
  // ============================================================
  const handlePrint = () => {
    window.print();
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      {/* ==================== ALL STYLES ==================== */}
      <style>{`
        #printable-menu {
          font-family: 'Times New Roman', Times, serif;
          color: #000;
          background: #fff;
          padding: 18px;
          max-width: 1100px;
          margin: 0 auto;
          box-sizing: border-box;
        }
        #printable-menu .outer {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
          table-layout: fixed;
        }
        #printable-menu .outer td,
        #printable-menu .outer th {
          border: 1px solid #000;
          padding: 4px 6px;
          vertical-align: middle;
          box-sizing: border-box;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        /* Column widths measured from the official template (public/full.png) */
        #printable-menu .outer col.c-day       { width: 12%; }
        #printable-menu .outer col.c-breakfast { width: 14.3%; }
        #printable-menu .outer col.c-lunch     { width: 31.2%; }
        #printable-menu .outer col.c-evening   { width: 15.4%; }
        #printable-menu .outer col.c-dinner    { width: 27.1%; }

        #printable-menu .logo-cell {
          text-align: center;
          vertical-align: middle;
          padding: 6px 5px;
        }
        #printable-menu .logo-cell img {
          width: 100%;
          max-width: 96px;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        #printable-menu .trust-title {
          text-align: center;
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 26px;
          font-weight: bold;
          line-height: 1.15;
          padding: 4px 4px 2px 4px;
        }
        #printable-menu .trust-sub {
          text-align: center;
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 13px;
          font-weight: bold;
          margin-top: 2px;
          padding: 0 4px 4px 4px;
        }
        #printable-menu .doc-info {
          font-size: 12px;
          line-height: 1.55;
          padding: 6px 10px;
          white-space: nowrap;
          vertical-align: top;
          text-align: left;
        }
        #printable-menu .weekly-title {
          text-align: center;
          font-size: 17px;
          font-weight: bold;
          padding: 5px 6px;
          background: #fff;
        }
        #printable-menu .vendor-row td {
          font-size: 13px;
          font-weight: bold;
          padding: 6px 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #printable-menu .col-head th {
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          padding: 6px 4px;
          background: #fff;
        }
        #printable-menu .day-cell {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          background: #fff;
          vertical-align: middle;
          white-space: nowrap;
          padding-left: 2px !important;
          padding-right: 2px !important;
        }
        #printable-menu .meal-cell {
          padding: 0 !important;
          vertical-align: top;
          height: 82px;
        }
        #printable-menu .cell-input {
          width: 100%;
          height: 100%;
          min-height: 82px;
          border: none;
          outline: none;
          resize: none;
          padding: 6px 8px;
          background: transparent;
          font-family: 'Times New Roman', Times, serif;
          font-size: 14px;
          line-height: 1.4;
          color: #000;
          box-sizing: border-box;
          white-space: pre-wrap;
          display: block;
        }
        #printable-menu .cell-input:focus {
          background: #fffbe6;
        }
        #printable-menu .signatures {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 45px;
          padding: 0 12px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 13px;
          font-weight: bold;
        }
        #printable-menu .signatures > div {
          text-align: center;
          white-space: nowrap;
        }

        /* ---- Print / Save-as-PDF ----
           Native browser print: hides everything except the menu table,
           so "Print / Save PDF" always works with no popups or canvas
           rendering involved. */
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          #printable-menu,
          #printable-menu * {
            visibility: visible;
          }
          #printable-menu {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
          }
          #printable-menu .cell-input:focus {
            background: transparent;
          }
          #printable-menu .day-cell {
            font-size: 13px;
          }
        }
      `}</style>

      {/* ==================== TOOLBAR ==================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Weekly Menu Planner — PCCOE Format
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Type directly into the table cells. Auto-saves to this browser.
              Click Print → Save as PDF.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyPrevWeek}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Prev Week</span>
            </button>
            <button
              onClick={copyNextWeek}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy to Next Week</span>
            </button>
            <button
              onClick={clearWeek}
              className="inline-flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-2 rounded-lg text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Week</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg text-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Week navigation + editable vendor / location */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setWeekStart(shiftWeek(weekStart, -7))}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Week: <strong className="text-slate-900">{weekRangeText}</strong>
            </div>
            <button
              onClick={() => setWeekStart(shiftWeek(weekStart, 7))}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekStart(mondayOfWeek())}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700"
            >
              This Week
            </button>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              title="Pick any Monday"
            />
          </div>

          <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-2 lg:pl-4 lg:border-l lg:border-slate-200">
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              Vendor:
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-36 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              Location:
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-36 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              Doc. No.:
              <input
                type="text"
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                className="w-24 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              Rev. No.:
              <input
                type="text"
                value={revNo}
                onChange={(e) => setRevNo(e.target.value)}
                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ==================== EDITABLE TABLE (this is what prints) ==================== */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl shadow-sm p-4">
        <div
          id="printable-menu"
          className="bg-white shadow-inner mx-auto"
          style={{ maxWidth: 1100 }}
        >
          <table className="outer">
            <colgroup>
              <col className="c-day" />
              <col className="c-breakfast" />
              <col className="c-lunch" />
              <col className="c-evening" />
              <col className="c-dinner" />
            </colgroup>

            <thead>
              <tr>
                <th rowSpan={2} className="logo-cell" style={{ fontWeight: 'normal' }}>
                  <img src="/images.png" alt="Pimpri Chinchwad Education Trust" />
                </th>
                <th
                  colSpan={3}
                  style={{ border: '1px solid #000', padding: 0, fontWeight: 'normal' }}
                >
                  <div className="trust-title">
                    Pimpri Chinchwad Education Trust’s
                  </div>
                  <div className="trust-sub">
                    Sector No. 26, Pradhikaran, Nigdi, Pune -411044
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className="doc-info"
                  style={{ fontWeight: 'normal', textAlign: 'left' }}
                >
                  <div>Doc. No. : {docNo}</div>
                  <div>Rev. No. : {revNo}</div>
                  <div>Date : {docDate}</div>
                </th>
              </tr>

              <tr>
                <td
                  colSpan={3}
                  className="weekly-title"
                  style={{ border: '1px solid #000' }}
                >
                  Weekly Menu
                </td>
              </tr>

              <tr className="vendor-row">
                <td colSpan={2} style={{ border: '1px solid #000' }}>
                  Vendor Name – {vendorName}
                </td>
                <td style={{ border: '1px solid #000' }}>
                  Location – {location}
                </td>
                <td colSpan={2} style={{ border: '1px solid #000' }}>
                  Date- {weekRangeText}
                </td>
              </tr>

              <tr className="col-head">
                <th style={{ border: '1px solid #000' }}>Days</th>
                <th style={{ border: '1px solid #000' }}>Breakfast</th>
                <th style={{ border: '1px solid #000' }}>Lunch</th>
                <th style={{ border: '1px solid #000' }}>Evening</th>
                <th style={{ border: '1px solid #000' }}>Dinner</th>
              </tr>
            </thead>

            <tbody>
              {DAYS.map((day) => {
                const dateISO = getDayISO(weekStart, day.offset);
                const dayCells = cells[dateISO] || {};

                return (
                  <tr key={day.label}>
                    <td className="day-cell" style={{ border: '1px solid #000' }}>
                      {day.label}
                    </td>
                    {ALL_MEALS.map((meal) => (
                      <td
                        key={meal.key}
                        className="meal-cell"
                        style={{ border: '1px solid #000' }}
                      >
                        <textarea
                          className="cell-input"
                          rows={4}
                          value={dayCells[meal.key] || ''}
                          onChange={(e) =>
                            setCell(dateISO, meal.key, e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="signatures">
            <div>Student Repr. Sign</div>
            <div>Mess Repr. Sign</div>
            <div>Warden Sign</div>
            <div>Food Safety &amp; QC Exec. Sign</div>
            <div>Campus In-charge Sign</div>
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="text-[11px] text-slate-500 text-center">
        Tip: Type into the cells • Auto-saves • Click <strong>Print / Save PDF</strong> → Choose <strong>A4 Portrait</strong>.
      </div>
    </div>
  );
};

export default MenusPage;