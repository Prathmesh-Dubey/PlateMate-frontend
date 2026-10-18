// src/components/PrintableWeeklyMenu.tsx
import React from 'react';
import type { Menu, MealType } from '../types';

interface PrintableWeeklyMenuProps {
    menus: Menu[];
    weekStartDate: string;         // ISO: "YYYY-MM-DD" (Monday)
    vendorName?: string;
    location?: string;
    docNo?: string;
    revNo?: string;
    docDate?: string;
}

const DAYS: Array<{ label: string; offset: number }> = [
    { label: 'Monday', offset: 0 },
    { label: 'Tuesday', offset: 1 },
    { label: 'Wednesday', offset: 2 },
    { label: 'Thursday', offset: 3 },
    { label: 'Friday', offset: 4 },
    { label: 'Saturday', offset: 5 },
    { label: 'Sunday', offset: 6 },
];

const MEAL_COLUMNS: Array<{ key: MealType; label: string }> = [
    { key: 'BREAKFAST', label: 'Breakfast' },
    { key: 'LUNCH', label: 'Lunch' },
    { key: 'SNACKS', label: 'Evening' },
    { key: 'DINNER', label: 'Dinner' },
];

const getDayISO = (weekStart: string, offset: number): string => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
};

const formatDDMMYYYY = (iso: string): string => {
    const d = new Date(iso + 'T00:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
};

const getDishes = (menus: Menu[], date: string, mealType: MealType): string => {
    const matches = menus.filter(
        (m) => m.menuDate === date && m.mealType === mealType && m.status !== 'INACTIVE'
    );
    if (matches.length === 0) return '';
    const items = matches.flatMap((m) => m.items?.map((i) => i.itemName) || []);
    return items.join(', ');
};

export const PrintableWeeklyMenu: React.FC<PrintableWeeklyMenuProps> = ({
    menus,
    weekStartDate,
    vendorName = 'Om Sai Caterers',
    location = 'PCCOE, Girls Hostel',
    docNo = 'CAM/DI/0',
    revNo = '0.0',
    docDate,
}) => {
    const weekEndISO = getDayISO(weekStartDate, 6);
    const weekStartFmt = formatDDMMYYYY(weekStartDate);
    const weekEndFmt = formatDDMMYYYY(weekEndISO);
    const todayFmt = formatDDMMYYYY(new Date().toISOString().split('T')[0]);
    const finalDocDate = docDate || todayFmt;

    return (
        <div className="printable-menu" id="printable-menu">
            <style>{`
        /* ============ SCREEN STYLES ============ */
        .printable-menu {
          font-family: 'Times New Roman', Times, serif;
          color: #000;
          background: #fff;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 20px;
          box-sizing: border-box;
        }
        .printable-menu .outer-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
        }
        .printable-menu .outer-table td,
        .printable-menu .outer-table th {
          border: 1px solid #000;
          padding: 6px 8px;
          vertical-align: middle;
        }
        .printable-menu .trust-title {
          text-align: center;
          font-size: 22px;
          font-weight: bold;
          font-family: 'Georgia', 'Times New Roman', serif;
        }
        .printable-menu .trust-subtitle {
          text-align: center;
          font-size: 13px;
          font-weight: bold;
          margin-top: 4px;
        }
        .printable-menu .doc-block {
          font-size: 11px;
          text-align: left;
          line-height: 1.5;
          white-space: nowrap;
        }
        .printable-menu .weekly-title {
          text-align: center;
          font-size: 15px;
          font-weight: bold;
          padding: 4px 6px;
        }
        .printable-menu .vendor-row td {
          font-size: 14px;
          font-weight: bold;
          padding: 6px 8px;
        }
        .printable-menu .spacer-row td {
          height: 12px;
          border-left: none;
          border-right: none;
          border-top: none;
          padding: 0;
        }
        .printable-menu .menu-header th {
          background: #fff;
          font-size: 15px;
          font-weight: bold;
          text-align: center;
          padding: 8px;
        }
        .printable-menu .day-cell {
          font-size: 15px;
          font-weight: bold;
          text-align: center;
          width: 110px;
          vertical-align: middle;
        }
        .printable-menu .meal-cell {
          font-size: 12px;
          text-align: left;
          vertical-align: top;
          padding: 8px;
          height: 80px;
          color: #222;
        }
        .printable-menu .logocell {
          width: 140px;
          text-align: center;
          vertical-align: middle;
          padding: 6px;
        }
        .printable-menu .logo-img {
          max-width: 130px;
          max-height: 110px;
          display: block;
          margin: 0 auto;
        }
        .printable-menu .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 50px;
          padding: 0 20px;
          font-size: 14px;
          font-weight: bold;
        }
        .printable-menu .signatures > div {
          text-align: center;
          white-space: nowrap;
        }

        /* ============ PRINT STYLES ============ */
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 8mm;
          }
          body * { visibility: hidden; }
          #printable-menu, #printable-menu * { visibility: visible; }
          #printable-menu {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            max-width: none;
          }
          .no-print { display: none !important; }
          .printable-menu .outer-table { border-width: 1.5px; }
          .printable-menu .menu-header th,
          .printable-menu .day-cell,
          .printable-menu .meal-cell {
            font-size: 11px;
          }
          .printable-menu .meal-cell { height: 70px; }
        }
      `}</style>

            {/* ================= MAIN TABLE ================= */}
            <table className="outer-table">
                <tbody>
                    {/* --- Row 1: Logo | Trust Header | Doc info --- */}
                    <tr>
                        <td rowSpan={2} className="logocell">
                            <img
                                src="/pccoe-logo.png"
                                alt="PCCOE Logo"
                                className="logo-img"
                            />
                        </td>
                        <td colSpan={2}>
                            <div className="trust-title">
                                Pimpri Chinchwad Education Trust&apos;s
                            </div>
                            <div className="trust-subtitle">
                                Sector No. 26, Pradhikaran, Nigdi, Pune - 411044
                            </div>
                        </td>
                        <td className="doc-block">
                            <div>Doc. No. : {docNo}</div>
                            <div>Rev. No. : {revNo}</div>
                            <div>Date : {finalDocDate}</div>
                        </td>
                    </tr>

                    {/* --- Row 2: Weekly Menu centered across middle cols --- */}
                    <tr>
                        <td colSpan={2} className="weekly-title">
                            Weekly Menu
                        </td>
                        <td></td>
                    </tr>

                    {/* --- Row 3: Vendor / Location / Week Date --- */}
                    <tr className="vendor-row">
                        <td colSpan={2}>Vendor Name – {vendorName}</td>
                        <td>Location – {location}</td>
                        <td>
                            Date - {weekStartFmt} To {weekEndFmt}
                        </td>
                    </tr>

                    {/* --- Row 4: Spacer (thin line) --- */}
                    <tr className="spacer-row">
                        <td colSpan={4}>&nbsp;</td>
                    </tr>

                    {/* --- Row 5: Column headers --- */}
                    <tr className="menu-header">
                        <th>Days</th>
                        <th>Breakfast</th>
                        <th>Lunch</th>
                        <th>Evening</th>
                        <th>Dinner</th>
                    </tr>
                </tbody>

                {/* --- Day rows (each is a separate tbody for clean borders) --- */}
                {DAYS.map((day) => {
                    const dateISO = getDayISO(weekStartDate, day.offset);
                    return (
                        <tbody key={day.label}>
                            <tr>
                                <td className="day-cell">{day.label}</td>
                                <td className="meal-cell">
                                    {getDishes(menus, dateISO, 'BREAKFAST')}
                                </td>
                                <td className="meal-cell">
                                    {getDishes(menus, dateISO, 'LUNCH')}
                                </td>
                                <td className="meal-cell">
                                    {getDishes(menus, dateISO, 'SNACKS')}
                                </td>
                                <td className="meal-cell">
                                    {getDishes(menus, dateISO, 'DINNER')}
                                </td>
                            </tr>
                        </tbody>
                    );
                })}
            </table>

            {/* ================= SIGNATURES ================= */}
            <div className="signatures">
                <div>Student Repr. Sign</div>
                <div>Mess Repr. Sign</div>
                <div>Warden Sign</div>
                <div>Food Safety &amp; QC Exec. Sign</div>
                <div>Campus In-charge Sign</div>
            </div>
        </div>
    );
};

export default PrintableWeeklyMenu;