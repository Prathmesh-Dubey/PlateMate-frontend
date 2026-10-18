// src/pages/ReportsPage.tsx
import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Printer,
  PieChart,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import api from '../api';

interface ReportsPageProps {
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ showToast }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [reportType, setReportType] = useState<'PROFIT_LOSS' | 'STOCK' | 'OPERATIONS'>('PROFIT_LOSS');
  const [yearlyData, setYearlyData] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pnl, stock, mon] = await Promise.all([
        api.report.getProfitLoss(selectedYear),
        api.report.getStock(),
        api.report.getMonthly(new Date().getMonth() + 1, selectedYear),
      ]);
      setYearlyData(pnl);
      setStockReport(stock);
      setMonthlyData(mon);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const handleExport = async (format: 'PDF' | 'EXCEL' | 'CSV') => {
    try {
      if (format === 'PDF') {
        window.print();
        showToast('success', 'Print / PDF dialog opened');
      } else if (format === 'EXCEL') {
        const res = await api.report.exportExcel({ reportType: 'YEARLY', year: selectedYear, format: 'EXCEL' });
        showToast('success', res.message);
      } else {
        const res = await api.report.exportCSV({ reportType: 'YEARLY', year: selectedYear, format: 'CSV' });
        showToast('success', res.message);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Export failed');
    }
  };

  const summary = yearlyData?.yearlySummary || {
    totalIncome: 0,
    totalExpenses: 0,
    totalStaffSalary: 0,
    totalProfit: 0,
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-6">
      {/* Top Header & Export Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-700">Financial Year:</span>
            <input
              type="number"
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setReportType('PROFIT_LOSS')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                reportType === 'PROFIT_LOSS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Profit & Loss
            </button>
            <button
              onClick={() => setReportType('STOCK')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                reportType === 'STOCK' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock Valuation
            </button>
            <button
              onClick={() => setReportType('OPERATIONS')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                reportType === 'OPERATIONS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Operations
            </button>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('PDF')}
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={() => handleExport('EXCEL')}
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => handleExport('CSV')}
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Main Content by Selected Report Type */}
      {reportType === 'PROFIT_LOSS' && (
        <>
          {/* Yearly Financial Performance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Annual Gross Income</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">₹{summary.totalIncome.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400 mt-1">Candidate Fees + Parties</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-rose-700 font-medium">Kitchen Groceries & Bills</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">₹{summary.totalExpenses.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400 mt-1">Mandi, dairy, gas, etc.</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-rose-700 font-medium">Staff Payroll Paid</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">₹{summary.totalStaffSalary.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400 mt-1">Cooks & helpers salaries</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-emerald-700 font-medium">Net Operating Profit</div>
              <div className={`text-2xl font-bold mt-1 ${summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ₹{summary.totalProfit.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Net Mess Operating Surplus</div>
            </div>
          </div>

          {/* Month-by-Month Statement Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Monthly Financial Breakdown ({selectedYear})</h3>
                <p className="text-xs text-slate-500">Realized revenues vs operating outflows</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Month</th>
                    <th className="py-3 px-4">Total Revenue (₹)</th>
                    <th className="py-3 px-4">Kitchen Expenses (₹)</th>
                    <th className="py-3 px-4">Staff Payroll (₹)</th>
                    <th className="py-3 px-4">Net Surplus (₹)</th>
                    <th className="py-3 px-4">Operating Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {yearlyData?.monthlyData?.map((item: any) => {
                    const margin = item.income > 0 ? Math.round((item.profit / item.income) * 100) : 0;
                    return (
                      <tr key={item.month} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {monthNames[item.month - 1]} {selectedYear}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          ₹{item.income.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-rose-600">
                          ₹{item.expenses.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-rose-600">
                          ₹{item.staffSalary.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-sm">
                          <span className={item.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            ₹{item.profit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            margin >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {reportType === 'STOCK' && stockReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Total Pantry Value</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">₹{stockReport.totalValue.toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Tracked Pantry SKUs</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stockReport.totalItems} items</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-rose-700 font-medium">Low Stock Items</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">{stockReport.lowStockItems.length} items</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">
              Category-Wise Stock Valuation
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(stockReport.categoryWise || {}).map(([cat, data]: [string, any]) => (
                <div key={cat} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-xs font-semibold text-slate-700">{cat}</div>
                  <div className="text-base font-bold text-slate-900 mt-1">₹{data.value.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{data.count} distinct items</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportType === 'OPERATIONS' && monthlyData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2">Attendance & Residents</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Active Candidates Enrolled:</span>
                <span className="font-bold text-slate-900">{monthlyData.candidates?.active}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Total Recorded Check-ins:</span>
                <span className="font-bold text-slate-900">{monthlyData.attendance?.total}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Present Rate:</span>
                <span className="font-bold text-emerald-600">{monthlyData.attendance?.present} days</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2">Kitchen Production & Meals</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Plates Consumed:</span>
                <span className="font-bold text-slate-900">{monthlyData.meals?.taken}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Skipped Plates:</span>
                <span className="font-bold text-slate-400">{monthlyData.meals?.notTaken}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-slate-500">Net Surplus for Month:</span>
                <span className="font-bold text-emerald-600">₹{monthlyData.profit?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
