import React, { useState, useMemo, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
  ComposedChart,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  CreditCard,
  DollarSign,
  Activity,
  Upload,
  Settings,
  FileSpreadsheet,
  Download,
  Plus,
  LayoutDashboard,
  Table as TableIcon,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  X,
  Save,
  PlusCircle,
  CalendarDays,
  Rocket,
  TrendingDown,
  Gauge,
  Percent,
  Info,
  HelpCircle,
  BarChart3,
} from 'lucide-react';

// --- VISUAL CONFIGURATION ---
const COLORS = {
  equity: '#8b5cf6', // Violet
  cash: '#10b981', // Emerald
  fixed: '#3b82f6', // Blue
  liability: '#ef4444', // Red
  other: '#f59e0b', // Amber
  drawdown: '#f43f5e', // Rose (Risk)
  bg: '#020617', // Slate 950
  card: '#1e293b', // Slate 800
  contribution: '#38bdf8',
  returns: '#f472b6',
};

const CATEGORIES = {
  equity: {
    label: 'Equity',
    color: COLORS.equity,
    keywords: [
      'fidelity',
      'robinhood',
      'stock',
      'broker',
      'uhc',
      'fund',
      'etf',
      'invest',
      '401',
      '403',
      'contribution',
      'ira',
      'roth',
      'schwab',
      'vanguard',
    ],
  },
  fixed: {
    label: 'Fixed Income',
    color: COLORS.fixed,
    keywords: [
      'certificate',
      'bond',
      'treasury',
      'cd',
      'deposit',
      'stanford',
      'plazo',
      'fixed',
    ],
  },
  liability: {
    label: 'Liability',
    color: COLORS.liability,
    keywords: [
      'card',
      'debt',
      'loan',
      'mortgage',
      'hipoteca',
      'credit',
      'amex',
      'visa',
      'mastercard',
      'liab',
    ],
  },
  cash: {
    label: 'Cash / Liquid',
    color: COLORS.cash,
    keywords: [
      'checking',
      'paypal',
      'marcus',
      'cash',
      'bank',
      'sbu',
      'ahorro',
      'savings',
      'cuenta',
      'hysa',
      'sfcu',
    ],
  },
  other: { label: 'Other Assets', color: COLORS.other, keywords: [] },
};

// --- UTILS ---
const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
const formatK = (val) => `$${(val / 1000).toFixed(0)}k`;
const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;
const formatDelta = (val) =>
  val > 0 ? `+${formatCurrency(val)}` : formatCurrency(val);

const cleanNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.toString().trim();
  if (['$ -', '-', '', '$-', 'null'].includes(clean)) return 0;
  const isNegative = clean.startsWith('(') && clean.endsWith(')');
  clean = clean.replace(/[^0-9.]/g, '');
  let num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
};

const parseCSVLine = (text) => {
  const result = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  result.push(cell.trim());
  return result.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
};

// --- COMPONENTS ---

const KpiCard = ({
  title,
  value,
  subvalue,
  trendPct,
  trendAmt,
  icon: Icon,
  color,
  isNegativeBad = false,
}) => {
  const isPositive = trendAmt >= 0;
  const trendColor = isNegativeBad
    ? isPositive
      ? 'text-rose-400'
      : 'text-emerald-400'
    : isPositive
    ? 'text-emerald-400'
    : 'text-rose-400';
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm p-5 rounded-xl border border-slate-700/50 shadow-xl flex flex-col justify-between hover:border-slate-600 transition-all group min-h-[140px]">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-white tracking-tight font-mono">
            {value}
          </h3>
        </div>
        <div
          className={`p-2.5 rounded-lg bg-slate-900/50 group-hover:bg-slate-800 transition-colors shadow-inner`}
          style={{ color }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">
            {subvalue || 'Change'}
          </span>
          <div
            className={`flex items-center text-xs font-bold font-mono ${trendColor}`}
          >
            <TrendIcon className="w-3 h-3 mr-1" />
            {formatDelta(trendAmt)}
          </div>
        </div>
        {trendPct !== undefined && (
          <div
            className={`text-xs font-bold px-2 py-1 rounded-full bg-slate-900/80 border border-slate-700 ${trendColor}`}
          >
            {formatPercent(Math.abs(trendPct))}
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectionCard = ({ metrics, growthRate, setGrowthRate }) => {
  const {
    currentNW,
    monthlyContribution,
    crossoverDate,
    yearsToCrossover,
    phaseProgress,
  } = metrics.compound;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-700 p-6 flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

      <div className="relative z-10 flex-none mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Rocket className="w-6 h-6 text-orange-400" /> Compound Phase
          </h3>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-slate-400 hover:text-white relative"
          >
            <HelpCircle className="w-4 h-4" />
            {showInfo && (
              <div className="absolute right-0 top-6 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg text-[10px] text-slate-300 shadow-xl z-50 text-left">
                <p className="mb-2">
                  <strong className="text-emerald-400">Linear Phase:</strong>{' '}
                  Work income {'>'} Returns.
                </p>
                <p className="mb-2">
                  <strong className="text-orange-400">
                    Exponential Phase:
                  </strong>{' '}
                  Returns {'>'} Work income.
                </p>
              </div>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 mb-6">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold whitespace-nowrap">
            Exp. Return:
          </span>
          <input
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={growthRate}
            onChange={(e) => setGrowthRate(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-600 font-mono font-bold text-violet-400 text-xs w-12 text-center">
            {growthRate}%
          </span>
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wider">
            <span>Linear Phase</span>
            <span>Exponential Phase</span>
          </div>
          {/* THICKER BAR */}
          <div className="h-6 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-orange-500 transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, phaseProgress)}%` }}
            ></div>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_3px_rgba(255,255,255,0.8)]"
              style={{ left: `${Math.min(100, phaseProgress)}%` }}
            ></div>
          </div>
          <div className="text-center mt-2">
            <span className="text-xs text-slate-400">Current Progress: </span>
            <span className="text-sm text-white font-bold">
              {phaseProgress.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-center shadow-sm hover:bg-slate-800/80 transition-colors">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">
              Contribution (Real)
            </p>
            <p className="text-xl font-bold text-blue-400 font-mono truncate">
              {formatCurrency(monthlyContribution)}
            </p>
            <p className="text-[9px] text-slate-600 mt-1">Monthly Avg</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-center shadow-sm hover:bg-slate-800/80 transition-colors">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">
              Return (Est.)
            </p>
            <p className="text-xl font-bold text-pink-400 font-mono truncate">
              {formatCurrency(currentNW * (growthRate / 100 / 12))}
            </p>
            <p className="text-[9px] text-slate-600 mt-1">This Month</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-600 text-center shrink-0 relative overflow-hidden mt-auto shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50 pointer-events-none"></div>
        <div className="relative z-10">
          <p className="text-slate-400 text-[10px] mb-0.5 uppercase tracking-widest font-bold">
            Est. Crossover Time
          </p>
          <div className="text-4xl font-bold text-white tracking-tighter leading-tight mb-1">
            {yearsToCrossover}{' '}
            <span className="text-lg font-normal text-slate-500">Years</span>
          </div>
          <p className="text-xs text-emerald-400 font-mono font-bold">
            {crossoverDate.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

// [ConfigModal and EntryModal]
const ConfigModal = ({ isOpen, onClose, columns, setColumns }) => {
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('equity');
  if (!isOpen) return null;
  const updateType = (id, type) =>
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, type } : c)));
  const addColumn = () => {
    if (!newColName) return;
    setColumns((prev) => [
      ...prev,
      {
        id: `col_custom_${Date.now()}`,
        name: newColName,
        type: newColType,
        isCustom: true,
      },
    ]);
    setNewColName('');
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-4xl border border-slate-700 shadow-2xl p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" /> Account Management
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-6 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-400 block mb-1">
              New Account Name
            </label>
            <input
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none"
              placeholder="e.g. Bitcoin, Art..."
            />
          </div>
          <div className="w-1/3">
            <label className="text-xs text-slate-400 block mb-1">Type</label>
            <select
              value={newColType}
              onChange={(e) => setNewColType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none"
            >
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={addColumn}
            className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-700/50 rounded-xl bg-slate-900/30">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-300 uppercase font-bold text-xs sticky top-0 z-10 shadow-md">
              <tr>
                <th className="px-6 py-4">Account</th>
                <th className="px-6 py-4">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {columns.map((col) => (
                <tr key={col.id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-3 text-white font-mono text-xs">
                    {col.name}
                  </td>
                  <td className="px-6 py-3">
                    <select
                      value={col.type}
                      onChange={(e) => updateType(col.id, e.target.value)}
                      className="bg-transparent text-xs border border-slate-700 rounded px-2 py-1 text-slate-300 focus:bg-slate-800 outline-none"
                    >
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

const EntryModal = ({ isOpen, onClose, columns, onSave, onAddColumn }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [values, setValues] = useState({});
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('equity');
  if (!isOpen) return null;
  const handleSubmit = (e) => {
    e.preventDefault();
    const numericValues = {};
    columns.forEach((col) => {
      numericValues[col.id] = parseFloat(values[col.id]) || 0;
    });
    const [y, m, d] = date.split('-');
    onSave({ date: new Date(y, m - 1, d), label: date, ...numericValues });
    onClose();
  };
  const handleQuickAdd = () => {
    if (!newColName) return;
    onAddColumn(newColName, newColType);
    setNewColName('');
    setIsAddingAccount(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-4xl border border-slate-700 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-400" /> New Monthly
            Entry
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex justify-between items-end mb-6">
            <div className="flex-1 mr-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none w-full"
              />
            </div>
            {!isAddingAccount ? (
              <button
                onClick={() => setIsAddingAccount(true)}
                className="text-blue-400 text-xs flex items-center gap-1 hover:text-blue-300 pb-3"
              >
                <Plus className="w-3 h-3" /> Add New Account
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 flex-1">
                <input
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="Name"
                  className="bg-transparent text-white text-xs outline-none w-full"
                />
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value)}
                  className="bg-slate-800 text-white text-xs rounded"
                >
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleQuickAdd}
                  className="text-emerald-400 font-bold text-xs"
                >
                  OK
                </button>
              </div>
            )}
          </div>
          <form
            id="entryForm"
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {columns.map((col) => (
              <div key={col.id}>
                <label
                  className="block text-[10px] text-slate-400 mb-1 truncate"
                  title={col.name}
                >
                  {col.name}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-600">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-6 pr-3 text-white text-sm focus:border-emerald-500 outline-none font-mono"
                    value={values[col.id] || ''}
                    onChange={(e) =>
                      setValues({ ...values, [col.id]: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          </form>
        </div>
        <div className="p-6 border-t border-slate-700 bg-slate-800 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            form="entryForm"
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [timeFrame, setTimeFrame] = useState('month');
  const [selectedYear, setSelectedYear] = useState('all');
  const [columns, setColumns] = useState([]);
  const [records, setRecords] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [expectedGrowth, setExpectedGrowth] = useState(7.0);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) return alert('Invalid CSV');
        const headers = parseCSVLine(lines[0]);
        const yearIdx = headers.findIndex((h) => h.toLowerCase() === 'year');
        const monthIdx = headers.findIndex((h) => h.toLowerCase() === 'month');
        const totalIdx = headers.findIndex((h) => h.toLowerCase() === 'total');
        const detectedCols = [];
        headers.forEach((h, idx) => {
          if ([yearIdx, monthIdx].includes(idx)) return;
          if (idx === totalIdx || h.toLowerCase().includes('total')) return;
          let type = 'equity';
          const lower = h.toLowerCase();
          for (const [key, val] of Object.entries(CATEGORIES)) {
            if (val.keywords.some((k) => lower.includes(k))) {
              type = key;
              break;
            }
          }
          detectedCols.push({
            id: `col_${idx}`,
            name: h.replace(/\n/g, ' '),
            index: idx,
            type,
          });
        });
        const newRecords = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i]);
          if (row.length < 2) continue;
          let dateObj = null;
          if (yearIdx !== -1 && monthIdx !== -1) {
            const y = parseInt(row[yearIdx]);
            const mVal = row[monthIdx];
            if (y && mVal) {
              if (mVal.includes('/')) {
                const [m, d] = mVal.split('/');
                dateObj = new Date(y, parseInt(m) - 1, parseInt(d) || 1);
              } else {
                const num = parseFloat(mVal);
                if (num > 20000) {
                  const serialDate = new Date((num - 25569) * 86400 * 1000);
                  dateObj = new Date(y, serialDate.getMonth(), 1);
                } else {
                  dateObj = new Date(y, num - 1, 1);
                }
              }
            }
          }
          if (!dateObj || isNaN(dateObj.getTime())) continue;
          const record = {
            date: dateObj,
            label: dateObj.toISOString().split('T')[0],
          };
          detectedCols.forEach((col) => {
            if (row[col.index] !== undefined)
              record[col.id] = cleanNumber(row[col.index]);
            else record[col.id] = 0;
          });
          newRecords.push(record);
        }
        newRecords.sort((a, b) => a.date - b.date);
        setColumns(detectedCols);
        setRecords(newRecords);
      } catch (error) {
        console.error(error);
        alert('CSV Error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddRecord = (newRecord) => {
    const exists = records.findIndex(
      (r) => r.date.getTime() === newRecord.date.getTime()
    );
    let updated = [...records];
    if (exists >= 0) {
      if (confirm('Overwrite date?')) updated[exists] = newRecord;
      else return;
    } else updated.push(newRecord);
    updated.sort((a, b) => a.date - b.date);
    setRecords(updated);
  };

  const handleAddColumnFromModal = (name, type) => {
    const newId = `col_custom_${Date.now()}`;
    setColumns((prev) => [...prev, { id: newId, name, type, isCustom: true }]);
  };

  const handleExport = () => {
    if (!records.length) return;
    const headerRow = [
      'Year',
      'Month',
      ...columns.map((c) => c.name),
      'Total',
    ].join(',');
    const rows = records.map((r) => {
      const y = r.date.getFullYear();
      const m = r.date.getMonth() + 1;
      const d = r.date.getDate();
      const dateStr = `${m}/${d}`;
      let netW = 0;
      const colVals = columns.map((c) => {
        const val = r[c.id] || 0;
        if (c.type === 'liability') netW -= Math.abs(val);
        else netW += val;
        return val;
      });
      return [`${y}`, dateStr, ...colVals, netW].join(',');
    });
    const csvContent = [headerRow, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `finance_db_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FILTERING ---
  const filteredRecords = useMemo(() => {
    if (selectedYear === 'all') return records;
    return records.filter(
      (r) => r.date.getFullYear().toString() === selectedYear
    );
  }, [records, selectedYear]);

  const availableYears = useMemo(() => {
    const years = new Set(records.map((r) => r.date.getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [records]);

  // --- ENGINE ---
  const data = useMemo(() => {
    if (!filteredRecords.length) return [];
    const computed = filteredRecords.map((r) => {
      const stats = { equity: 0, fixed: 0, cash: 0, liability: 0, other: 0 };
      columns.forEach((col) => {
        const val = r[col.id] || 0;
        if (col.type === 'liability') stats.liability += Math.abs(val);
        else stats[col.type] += val;
      });
      const liquidity = stats.cash + stats.fixed;
      const totalAssets = stats.equity + stats.fixed + stats.cash + stats.other;
      const netWorth = totalAssets - stats.liability;
      return { ...r, ...stats, totalAssets, netWorth, liquidity };
    });

    if (timeFrame === 'month') {
      return computed.map((c) => ({
        ...c,
        displayDate: c.date.toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
      }));
    }

    const groups = {};
    computed.forEach((c) => {
      const y = c.date.getFullYear();
      let key = '';
      if (timeFrame === 'year') key = `${y}`;
      else {
        const q = Math.floor(c.date.getMonth() / 3) + 1;
        key = `Q${q} '${y.toString().slice(2)}`;
      }
      groups[key] = { ...c, displayDate: key };
    });
    return Object.values(groups).sort((a, b) => a.date - b.date);
  }, [filteredRecords, columns, timeFrame]);

  // --- METRICS ---
  const metrics = useMemo(() => {
    if (!data.length) return null;
    const curr = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : null;
    const yearStart =
      data.find((d) => d.date.getFullYear() === curr.date.getFullYear()) ||
      data[0];

    const calc = (key) => {
      const v1 = curr[key];
      const v0 = prev ? prev[key] : 0;
      return {
        val: v1,
        amt: v1 - v0,
        pct: v0 !== 0 ? (v1 - v0) / Math.abs(v0) : 0,
      };
    };

    const debtToAssets =
      curr.totalAssets > 0 ? curr.liability / curr.totalAssets : 0;
    const debtToEquity = curr.netWorth > 0 ? curr.liability / curr.netWorth : 0;

    // Compound Engine
    const sortedRecords = [...records].sort((a, b) => a.date - b.date);
    const recent = sortedRecords.slice(-12);
    let totalContribution = 0;
    let monthsCount = 0;
    for (let i = 1; i < recent.length; i++) {
      const prevR = recent[i - 1];
      const currR = recent[i];
      let nwPrev = 0,
        nwCurr = 0;
      columns.forEach((col) => {
        const valP = prevR[col.id] || 0;
        const valC = currR[col.id] || 0;
        if (col.type === 'liability') {
          nwPrev -= Math.abs(valP);
          nwCurr -= Math.abs(valC);
        } else {
          nwPrev += valP;
          nwCurr += valC;
        }
      });
      const diffTime = currR.date - prevR.date;
      const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
      if (diffMonths > 0.5) {
        const expectedMarketGrowth =
          nwPrev * ((expectedGrowth / 100 / 12) * diffMonths);
        totalContribution +=
          (nwCurr - nwPrev - expectedMarketGrowth) / diffMonths;
        monthsCount++;
      }
    }
    const monthlyContribution =
      monthsCount > 0 ? totalContribution / monthsCount : 0;
    const currentMonthlyReturn = curr.netWorth * (expectedGrowth / 100 / 12);
    const phaseProgress =
      monthlyContribution > 0
        ? (currentMonthlyReturn / monthlyContribution) * 100
        : 100;

    let projectedNW = curr.netWorth;
    let monthsToCross = 0;
    while (
      projectedNW * (expectedGrowth / 100 / 12) < monthlyContribution &&
      monthsToCross < 600
    ) {
      projectedNW +=
        monthlyContribution + projectedNW * (expectedGrowth / 100 / 12);
      monthsToCross++;
    }
    const crossoverDate = new Date();
    crossoverDate.setMonth(crossoverDate.getMonth() + monthsToCross);
    const yearsToCrossover = (monthsToCross / 12).toFixed(1);

    // Advanced Metrics (Calculated on full unfiltered dataset to be accurate)
    // CAGR & MaxDD
    let maxDD = 0;
    let maxNW = -Infinity;
    const fullHistory = sortedRecords.map((r) => {
      let nw = 0;
      columns.forEach((col) => {
        const val = r[col.id] || 0;
        if (col.type === 'liability') nw -= Math.abs(val);
        else nw += val;
      });
      if (nw > maxNW) maxNW = nw;
      const dd = maxNW > 0 ? (nw - maxNW) / maxNW : 0;
      if (dd < maxDD) maxDD = dd;
      return { ...r, netWorth: nw };
    });
    const fullYears = Math.max(
      1,
      (curr.date - fullHistory[0].date) / (1000 * 60 * 60 * 24 * 365.25)
    );
    const cagr =
      fullHistory[0].netWorth > 0 && curr.netWorth > 0
        ? Math.pow(curr.netWorth / fullHistory[0].netWorth, 1 / fullYears) - 1
        : 0;

    // DD Series for Chart (Local View)
    let localMaxNW = -Infinity;
    const ddSeries = data.map((d) => {
      if (d.netWorth > localMaxNW) localMaxNW = d.netWorth;
      // Use global maxDD logic or local? Ideally Risk Profile should show global context, but user filtered view.
      // Let's use local calc for chart consistency
      return {
        ...d,
        drawdown: localMaxNW > 0 ? (d.netWorth - localMaxNW) / localMaxNW : 0,
      };
    });

    return {
      nw: calc('netWorth'),
      assets: calc('totalAssets'),
      debt: calc('liability'),
      liquidity: calc('liquidity'),
      ratios: { debtToAssets, debtToEquity },
      advanced: {
        maxDD: maxDD,
        cagr: cagr,
        ytd: curr.netWorth - yearStart.netWorth,
      },
      allocation: [
        { name: 'Equity', value: curr.equity, color: COLORS.equity },
        { name: 'Fixed Income', value: curr.fixed, color: COLORS.fixed },
        { name: 'Cash', value: curr.cash, color: COLORS.cash },
        { name: 'Other', value: curr.other, color: COLORS.other },
      ].filter((x) => x.value > 0),
      compound: {
        currentNW: curr.netWorth,
        monthlyContribution,
        crossoverDate,
        yearsToCrossover,
        phaseProgress,
      },
      ddSeries,
    };
  }, [data, records, expectedGrowth, columns]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans pb-20 selection:bg-violet-500 selection:text-white">
      <nav className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-violet-900/20">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">
                CFO Ultimate
              </h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-1">
                Wealth Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {records.length > 0 && (
              <>
                <div className="hidden md:flex items-center bg-slate-900/50 rounded-lg border border-slate-800 p-1">
                  <button
                    onClick={() => setSelectedYear('all')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                      selectedYear === 'all'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  {availableYears.map((y) => (
                    <button
                      key={y}
                      onClick={() => setSelectedYear(y.toString())}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                        selectedYear === y.toString()
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowEntry(true)}
                  className="hidden md:flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-lg shadow-emerald-900/20"
                >
                  <PlusCircle className="w-4 h-4" /> New
                </button>
                <button
                  onClick={handleExport}
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Export CSV"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowConfig(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Manage Accounts"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </>
            )}
            <label className="group relative bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-violet-900/30 cursor-pointer flex items-center gap-2 transition-all hover:translate-y-[-1px] active:translate-y-[1px]">
              <Upload className="w-4 h-4" />{' '}
              <span className="hidden sm:inline">Import</span>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!metrics ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in duration-700">
            <div className="relative w-28 h-28 mb-8 group">
              <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl group-hover:bg-violet-500/30 transition-all duration-1000"></div>
              <div className="relative w-full h-full bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center shadow-2xl shadow-black/50 rotate-3 group-hover:rotate-6 transition-transform">
                <FileSpreadsheet className="w-12 h-12 text-violet-500" />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
              Financial Intelligence
            </h2>
            <p className="text-slate-400 max-w-lg text-lg leading-relaxed">
              Upload your{' '}
              <code className="text-violet-300 font-mono bg-violet-900/30 px-2 py-0.5 rounded">
                NW.csv
              </code>{' '}
              file.
            </p>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
            {/* CONTROL BAR */}
            <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-900/40 p-2 rounded-2xl border border-slate-800/60 backdrop-blur-sm">
              <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                {['month', 'quarter', 'year'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeFrame(t)}
                    className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                      timeFrame === t
                        ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                    activeView === 'dashboard'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveView('comparison')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                    activeView === 'comparison'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Compare
                </button>
                <button
                  onClick={() => setActiveView('data')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                    activeView === 'data'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Data
                </button>
              </div>
              <div className="px-6 flex items-center gap-6 text-xs font-mono border-l border-slate-800/50">
                <div>
                  <span className="text-slate-500 block mb-1">CAGR</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {formatPercent(metrics.advanced.cagr)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">
                    Max Drawdown
                  </span>
                  <span className="text-rose-500 font-bold text-sm">
                    {formatPercent(metrics.advanced.maxDD)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">YTD Growth</span>
                  <span className="text-violet-400 font-bold text-sm">
                    {formatDelta(metrics.advanced.ytd)}
                  </span>
                </div>
              </div>
            </div>

            {/* KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <KpiCard
                title="Net Worth"
                value={formatCurrency(metrics.nw.val)}
                subvalue="Total Equity"
                trendAmt={metrics.nw.amt}
                trendPct={metrics.nw.pct}
                color={COLORS.equity}
                icon={TrendingUp}
              />
              <KpiCard
                title="Total Assets"
                value={formatCurrency(metrics.assets.val)}
                subvalue="Gross Assets"
                trendAmt={metrics.assets.amt}
                trendPct={metrics.assets.pct}
                color={COLORS.fixed}
                icon={Briefcase}
              />
              <KpiCard
                title="Total Debt"
                value={formatCurrency(metrics.debt.val)}
                subvalue="Liabilities"
                trendAmt={metrics.debt.amt}
                trendPct={metrics.debt.pct}
                color={COLORS.liability}
                icon={CreditCard}
                isNegativeBad={true}
              />
              <KpiCard
                title="Total Liquidity"
                value={formatCurrency(metrics.liquidity.val)}
                subvalue="Cash + HYSA"
                trendAmt={metrics.liquidity.amt}
                trendPct={metrics.liquidity.pct}
                color={COLORS.cash}
                icon={DollarSign}
              />
            </div>

            {/* DEBT RATIOS CENTERED */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/60 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">
                    Debt Ratio (Solvency)
                  </p>
                  <p className="text-xl font-mono font-bold text-white mt-1">
                    {formatPercent(metrics.ratios.debtToAssets)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Target: &lt; 30% (Leverage)
                  </p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full shadow-lg ${
                    metrics.ratios.debtToAssets < 0.3
                      ? 'bg-emerald-500 shadow-emerald-500/20'
                      : 'bg-amber-500 shadow-amber-500/20'
                  }`}
                ></div>
              </div>
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/60 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">
                    Debt-to-Equity
                  </p>
                  <p className="text-xl font-mono font-bold text-white mt-1">
                    {formatPercent(metrics.ratios.debtToEquity)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Target: &lt; 50% (Leverage)
                  </p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full shadow-lg ${
                    metrics.ratios.debtToEquity < 0.5
                      ? 'bg-emerald-500 shadow-emerald-500/20'
                      : 'bg-amber-500 shadow-amber-500/20'
                  }`}
                ></div>
              </div>
            </div>

            {activeView === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* NET WORTH & RISK (RESTORED COMPOSED CHART) */}
                <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-sm rounded-3xl border border-slate-800/60 p-6 flex flex-col h-[500px] shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <Activity className="w-5 h-5 text-violet-400" /> Net
                        Worth & Risk Profile
                      </h3>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={metrics.ddSeries}
                        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorNW"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={COLORS.equity}
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor={COLORS.equity}
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorDD"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={COLORS.drawdown}
                              stopOpacity={0.1}
                            />
                            <stop
                              offset="95%"
                              stopColor={COLORS.drawdown}
                              stopOpacity={0.3}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e293b"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="displayDate"
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          minTickGap={40}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          tickFormatter={formatK}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#f43f5e"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                          tickLine={false}
                          axisLine={false}
                          domain={[-0.3, 0]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '12px',
                          }}
                          itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                          formatter={(val, name) =>
                            name === 'Drawdown'
                              ? formatPercent(val)
                              : formatCurrency(val)
                          }
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="netWorth"
                          name="Net Worth"
                          stroke={COLORS.equity}
                          strokeWidth={3}
                          fill="url(#colorNW)"
                        />
                        <Area
                          yAxisId="right"
                          type="step"
                          dataKey="drawdown"
                          name="Drawdown"
                          stroke={COLORS.drawdown}
                          strokeWidth={1}
                          fill="url(#colorDD)"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="h-[500px]">
                  <ProjectionCard
                    metrics={metrics}
                    growthRate={expectedGrowth}
                    setGrowthRate={setExpectedGrowth}
                  />
                </div>

                {/* PIE CHART RESTORED */}
                <div className="bg-slate-900/40 backdrop-blur-sm rounded-3xl border border-slate-800/60 p-6 h-[400px] flex flex-col shadow-2xl">
                  <h3 className="font-bold text-white text-lg mb-2 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" /> Asset
                    Allocation
                  </h3>
                  <div className="flex-1 min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metrics.allocation}
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={4}
                          cornerRadius={6}
                          dataKey="value"
                          stroke="none"
                        >
                          {metrics.allocation.map((e, i) => (
                            <Cell key={i} fill={e.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '12px',
                          }}
                          formatter={formatCurrency}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                        Total Assets
                      </span>
                      <span className="text-white font-bold text-2xl tracking-tighter mt-1">
                        {formatK(metrics.assets.val)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {metrics.allocation.map((x) => (
                      <div
                        key={x.name}
                        className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/50 p-2 rounded"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: x.color }}
                        />
                        <span className="flex-1">{x.name}</span>
                        <span className="font-mono">
                          {((x.value / metrics.assets.val) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TREND COMPOSITION WITH LIABILITY LINE */}
                <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-sm rounded-3xl border border-slate-800/60 p-6 h-[400px] flex flex-col shadow-2xl">
                  <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-400" /> Composition
                    Trend
                  </h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={metrics.ddSeries}
                        stackOffset="expand"
                        margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e293b"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="displayDate"
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                          minTickGap={30}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          tickFormatter={formatPercent}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '12px',
                          }}
                          formatter={(val, name) => [formatCurrency(val), name]}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ paddingTop: '20px' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="equity"
                          name="Equity"
                          stackId="1"
                          stroke={COLORS.equity}
                          fill={COLORS.equity}
                          fillOpacity={0.9}
                        />
                        <Area
                          type="monotone"
                          dataKey="fixed"
                          name="Fixed Income"
                          stackId="1"
                          stroke={COLORS.fixed}
                          fill={COLORS.fixed}
                          fillOpacity={0.9}
                        />
                        <Area
                          type="monotone"
                          dataKey="cash"
                          name="Cash"
                          stackId="1"
                          stroke={COLORS.cash}
                          fill={COLORS.cash}
                          fillOpacity={0.9}
                        />
                        <Area
                          type="monotone"
                          dataKey="other"
                          name="Other"
                          stackId="1"
                          stroke={COLORS.other}
                          fill={COLORS.other}
                          fillOpacity={0.9}
                        />
                        <Line
                          type="monotone"
                          dataKey="liability"
                          name="Total Debt (Line)"
                          stroke={COLORS.liability}
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'comparison' && (
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-slate-900/40 backdrop-blur-sm rounded-3xl border border-slate-800/60 p-6 h-[500px] flex flex-col shadow-2xl">
                  <h3 className="font-bold text-white text-lg mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" /> Assets
                    Breakdown vs Liabilities
                  </h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={metrics.ddSeries}
                        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e293b"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="displayDate"
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          minTickGap={30}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          tickFormatter={formatK}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '12px',
                          }}
                          formatter={formatCurrency}
                        />
                        <Legend />
                        <Bar
                          dataKey="equity"
                          name="Equity"
                          stackId="a"
                          fill={COLORS.equity}
                        />
                        <Bar
                          dataKey="fixed"
                          name="Fixed Inc"
                          stackId="a"
                          fill={COLORS.fixed}
                        />
                        <Bar
                          dataKey="cash"
                          name="Cash"
                          stackId="a"
                          fill={COLORS.cash}
                        />
                        <Bar
                          dataKey="other"
                          name="Other"
                          stackId="a"
                          fill={COLORS.other}
                        />
                        <Bar
                          dataKey="liability"
                          name="Liabilities"
                          stackId="b"
                          fill={COLORS.liability}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'data' && (
              <div className="bg-slate-900/40 backdrop-blur-sm rounded-3xl border border-slate-800/60 shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-slate-200 uppercase font-bold text-xs sticky top-0 z-20">
                      <tr>
                        <th className="px-6 py-5 bg-slate-950 whitespace-nowrap border-b border-slate-800">
                          Date
                        </th>
                        {columns.map((c) => (
                          <th
                            key={c.id}
                            className="px-6 py-5 bg-slate-950 whitespace-nowrap min-w-[140px] border-b border-slate-800"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-white">{c.name}</span>
                              <span className="text-[10px] text-slate-500 font-normal bg-slate-900 px-1.5 py-0.5 rounded w-fit">
                                {CATEGORIES[c.type].label}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="px-6 py-5 bg-slate-950 text-right sticky right-0 z-30 shadow-2xl text-emerald-400 border-b border-slate-800 border-l border-slate-800/50">
                          Net Worth
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {[...data].reverse().map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-800/30 transition-colors group"
                        >
                          <td className="px-6 py-4 font-mono text-white whitespace-nowrap text-xs">
                            {row.displayDate}
                          </td>
                          {columns.map((c) => (
                            <td
                              key={c.id}
                              className="px-6 py-4 font-mono text-xs"
                            >
                              {row[c.id] !== 0 ? (
                                <span
                                  className={
                                    row[c.id] < 0
                                      ? 'text-rose-400'
                                      : 'text-slate-300'
                                  }
                                >
                                  {formatCurrency(row[c.id])}
                                </span>
                              ) : (
                                <span className="opacity-10">-</span>
                              )}
                            </td>
                          ))}
                          <td className="px-6 py-4 font-mono text-right font-bold text-emerald-400 text-xs sticky right-0 bg-[#020617] group-hover:bg-slate-900/40 shadow-xl border-l border-slate-800/50">
                            {formatCurrency(row.netWorth)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <ConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        columns={columns}
        setColumns={setColumns}
      />
      <EntryModal
        isOpen={showEntry}
        onClose={() => setShowEntry(false)}
        columns={columns}
        onSave={handleAddRecord}
        onAddColumn={handleAddColumnFromModal}
      />
    </div>
  );
}
