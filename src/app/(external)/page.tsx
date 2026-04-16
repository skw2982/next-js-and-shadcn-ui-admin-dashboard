"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface Stock {
  market: string;
  account: string;
  name: string;
  qty: number;
  avg: number;
  current: number;
}
interface Asset {
  id: number;
  name: string;
  value: number;
}
interface Debt {
  id: number;
  name: string;
  value: number;
}
interface Saving {
  id: number;
  name: string;
  monthly: number;
  current: number;
  maturityDate: string;
  transferDay: number;
  interestRate: number;
}
interface Realized {
  date: string;
  name: string;
  qty: number;
  profit: number;
  yieldRate: number;
  note: string;
}
type TabKey = "overview" | "stocks" | "realestate" | "savings" | "realized";

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const STOCK_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";
const REALIZED_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=817751922&single=true&output=csv";

const DEFAULT_ASSETS: Asset[] = [
  { id: 1, name: "힐스테이트 오피스텔", value: 250000000 },
  { id: 2, name: "자동차", value: 35000000 },
];
const DEFAULT_DEBTS: Debt[] = [
  { id: 1, name: "마이너스 통장", value: 40000000 },
];
const DEFAULT_SAVINGS: Saving[] = [
  {
    id: 1,
    name: "청년도약계좌",
    monthly: 700000,
    current: 8400000,
    maturityDate: "2028-06-25",
    transferDay: 25,
    interestRate: 6.0,
  },
];

const TABS: { key: TabKey; label: string; num: string }[] = [
  { key: "overview", label: "통합 요약", num: "1" },
  { key: "stocks", label: "계좌별 주식", num: "2" },
  { key: "realestate", label: "실물 / 부채", num: "3" },
  { key: "savings", label: "예적금", num: "4" },
  { key: "realized", label: "실현 손익", num: "5" },
];

const ACCOUNT_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444", "#f97316"];
const MARKET_COLORS = { domestic: "#6366f1", overseas: "#f59e0b" };

// ═══════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════
const cleanNum = (val: any): number => {
  if (!val) return 0;
  const cleaned = val.toString().replace(/[^0-9.\-]+/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const fmt = (num: number): string => Math.round(num).toLocaleString();

const fmtShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e8) return (n / 1e8).toFixed(1) + "억";
  if (abs >= 1e4) return (n / 1e4).toFixed(0) + "만";
  return fmt(n);
};

const pctColor = (v: number) => (v >= 0 ? "text-rose-500" : "text-blue-500");
const pctSign = (v: number) => (v >= 0 ? "+" : "");
const pctArrow = (v: number) => (v >= 0 ? "▲" : "▼");

const parseCSVRow = (row: string): string[] =>
  row
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((v) => v.replace(/"/g, "").trim());

// localStorage helpers
function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// ═══════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-900 rounded-[30px] border border-slate-800 shadow-xl ${className}`}
    >
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "danger" | "success";
}) {
  const colorMap = {
    default: "bg-slate-900 border-slate-800",
    danger: "bg-rose-900/20 border-rose-900/50",
    success: "bg-emerald-900/20 border-emerald-900/50",
  };
  const textMap = {
    default: "text-white",
    danger: "text-rose-400",
    success: "text-emerald-400",
  };
  const labelMap = {
    default: "text-slate-500",
    danger: "text-rose-400/70",
    success: "text-emerald-400/70",
  };

  return (
    <div className={`p-6 rounded-3xl border ${colorMap[variant]}`}>
      <p className={`text-[10px] font-black uppercase mb-1 ${labelMap[variant]}`}>
        {label}
      </p>
      <p className={`text-xl font-bold ${textMap[variant]}`}>{value}</p>
      {sub && (
        <p className={`text-xs mt-1 opacity-70 ${textMap[variant]}`}>{sub}</p>
      )}
    </div>
  );
}

function EditableList({
  title,
  titleColor = "text-white",
  items,
  onUpdate,
  onAdd,
  onRemove,
  addColor = "bg-blue-600",
  borderColor = "border-slate-800",
  inputColor = "text-blue-400",
  containerClass = "bg-slate-900 border-slate-800",
}: {
  title: string;
  titleColor?: string;
  items: { id: number; name: string; value: number }[];
  onUpdate: (id: number, field: "name" | "value", val: string) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
  addColor?: string;
  borderColor?: string;
  inputColor?: string;
  containerClass?: string;
}) {
  return (
    <div className={`p-8 rounded-[40px] border ${containerClass}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className={`text-xl font-black italic ${titleColor}`}>{title}</h3>
        <button
          onClick={onAdd}
          className={`${addColor} px-3 py-1 rounded-full text-[10px] font-bold text-white hover:opacity-80 transition-opacity`}
        >
          + 추가
        </button>
      </div>
      <div className="space-y-4">
        {items.map((a) => (
          <div
            key={a.id}
            className={`flex gap-4 items-center bg-slate-950 p-4 rounded-2xl border ${borderColor} transition-all`}
          >
            <input
              type="text"
              value={a.name}
              onChange={(e) => onUpdate(a.id, "name", e.target.value)}
              className="w-1/3 bg-transparent font-bold border-b border-slate-700 outline-none text-slate-200"
              placeholder="이름"
            />
            <input
              type="text"
              value={a.value.toLocaleString()}
              onChange={(e) => onUpdate(a.id, "value", e.target.value)}
              className={`w-1/2 bg-transparent text-right font-bold border-b border-slate-700 outline-none ${inputColor}`}
              placeholder="금액"
            />
            <button
              onClick={() => onRemove(a.id)}
              className="text-slate-600 hover:text-red-500 transition-colors text-lg"
            >
              ×
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-slate-600 text-center py-4 text-sm">
            항목이 없습니다
          </p>
        )}
      </div>
    </div>
  );
}

function ToastMessage({
  message,
  type,
}: {
  message: string;
  type: "error" | "success" | "info";
}) {
  const colors = {
    error: "bg-red-900/80 border-red-500/30 text-red-300",
    success: "bg-emerald-900/80 border-emerald-500/30 text-emerald-300",
    info: "bg-blue-900/80 border-blue-500/30 text-blue-300",
  };
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl border text-sm font-bold animate-in fade-in slide-in-from-top duration-300 ${colors[type]}`}
    >
      {message}
    </div>
  );
}

// Custom tooltip for recharts
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm shadow-xl">
      <p className="text-white font-bold">{payload[0]?.name || label}</p>
      <p className="text-slate-400">{fmt(payload[0]?.value)}원</p>
    </div>
  );
};

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════
export default function AssetMasterV2() {
  // --- Core State ---
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isClient, setIsClient] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [realized, setRealized] = useState<Realized[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1350);
  const [targetDate, setTargetDate] = useState("2026-12-31");
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" | "info" } | null>(null);

  // --- Persisted State (localStorage) ---
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [debts, setDebts] = useState<Debt[]>(DEFAULT_DEBTS);
  const [savings, setSavings] = useState<Saving[]>(DEFAULT_SAVINGS);

  const [realizedSortOrder, setRealizedSortOrder] = useState<"desc" | "asc">("desc");

  // --- Toast helper ---
  const showToast = useCallback(
    (msg: string, type: "error" | "success" | "info" = "info") => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // --- Load persisted data on mount ---
  useEffect(() => {
    setIsClient(true);
    setAssets(loadLocal("am_assets", DEFAULT_ASSETS));
    setDebts(loadLocal("am_debts", DEFAULT_DEBTS));
    setSavings(loadLocal("am_savings", DEFAULT_SAVINGS));
  }, []);

  // --- Save to localStorage on change ---
  useEffect(() => {
    if (isClient) saveLocal("am_assets", assets);
  }, [assets, isClient]);
  useEffect(() => {
    if (isClient) saveLocal("am_debts", debts);
  }, [debts, isClient]);
  useEffect(() => {
    if (isClient) saveLocal("am_savings", savings);
  }, [savings, isClient]);

  // --- Data Fetch ---
  const fetchAllData = useCallback(async () => {
    try {
      // Exchange rate
      const rateRes = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!rateRes.ok) throw new Error("환율 API 오류");
      const rateData = await rateRes.json();
      if (rateData?.rates?.KRW) setExchangeRate(rateData.rates.KRW);

      // Stock + Realized CSV
      const [sRes, rRes] = await Promise.all([
        fetch(`${STOCK_CSV_URL}&t=${Date.now()}`),
        fetch(`${REALIZED_CSV_URL}&t=${Date.now()}`),
      ]);

      if (!sRes.ok || !rRes.ok) throw new Error("구글 시트 로드 실패");

      // Parse stocks
      const sText = await sRes.text();
      const sRows = sText.split("\n").map((r) => r.trim()).filter(Boolean);
      if (sRows.length >= 2) {
        setStocks(
          sRows.slice(1).map((row) => {
            const c = parseCSVRow(row);
            return {
              market: c[0] || "국내",
              account: c[1] || "미분류",
              name: c[2] || "알 수 없음",
              avg: cleanNum(c[5]),
              current: cleanNum(c[6]),
              qty: cleanNum(c[7]),
            };
          }).filter((s) => s.qty > 0)
        );
      }

      // Parse realized
      const rText = await rRes.text();
      const rRows = rText.split("\n").map((r) => r.trim()).filter(Boolean);
      if (rRows.length >= 2) {
        setRealized(
          rRows.slice(1).map((row) => {
            const c = parseCSVRow(row);
            return {
              date: c[0],
              name: c[1],
              qty: cleanNum(c[2]),
              profit: cleanNum(c[3]),
              yieldRate: cleanNum(c[4]),
              note: c[5],
            };
          }).filter((r) => r.date)
        );
      }

      setLastUpdated(new Date().toLocaleTimeString("ko-KR"));
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      showToast(e.message || "데이터 로드에 실패했습니다", "error");
    }
  }, [showToast]);

  useEffect(() => {
    fetchAllData();
    const timer = setInterval(fetchAllData, 60000);
    return () => clearInterval(timer);
  }, [fetchAllData]);

  // ═══════════════════════════════════════
  // Computed Values (memoized)
  // ═══════════════════════════════════════
  const stockSummary = useMemo(() => {
    let domVal = 0, domInv = 0, osVal = 0, osInv = 0;
    stocks.forEach((s) => {
      const isOS = s.market.includes("해외");
      const rate = isOS ? exchangeRate : 1;
      if (isOS) {
        osVal += s.current * rate * s.qty;
        osInv += s.avg * rate * s.qty;
      } else {
        domVal += s.current * s.qty;
        domInv += s.avg * s.qty;
      }
    });
    return {
      dom: { val: domVal, profit: domVal - domInv, yieldPct: domInv > 0 ? ((domVal - domInv) / domInv) * 100 : 0 },
      os: { val: osVal, profit: osVal - osInv, yieldPct: osInv > 0 ? ((osVal - osInv) / osInv) * 100 : 0 },
    };
  }, [stocks, exchangeRate]);

  const totalStockVal = stockSummary.dom.val + stockSummary.os.val;
  const totalAssetsVal = assets.reduce((a, b) => a + b.value, 0);
  const totalSavingsVal = savings.reduce((a, b) => a + b.current, 0);
  const totalDebtsVal = debts.reduce((a, b) => a + b.value, 0);
  const netWorth = totalStockVal + totalAssetsVal + totalSavingsVal - totalDebtsVal;

  // --- Account groups ---
  const grouped = useMemo(() => {
    const acc: Record<string, { items: Stock[]; total: number; profit: number }> = {};
    stocks.forEach((s) => {
      if (!acc[s.account]) acc[s.account] = { items: [], total: 0, profit: 0 };
      const isOS = s.market.includes("해외");
      const rate = isOS ? exchangeRate : 1;
      acc[s.account].items.push(s);
      acc[s.account].total += s.current * rate * s.qty;
      acc[s.account].profit += (s.current - s.avg) * rate * s.qty;
    });
    return acc;
  }, [stocks, exchangeRate]);

  // --- Account chart data ---
  const accountChartData = useMemo(() => {
    return Object.entries(grouped).map(([name, data], i) => ({
      name,
      value: Math.round(data.total),
      color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
    }));
  }, [grouped]);

  // --- Market chart data ---
  const marketChartData = useMemo(() => {
    return [
      { name: "국내 주식", value: Math.round(stockSummary.dom.val), color: MARKET_COLORS.domestic },
      { name: "해외 주식", value: Math.round(stockSummary.os.val), color: MARKET_COLORS.overseas },
    ].filter((d) => d.value > 0);
  }, [stockSummary]);

  // --- Net worth composition chart ---
  const compositionData = useMemo(() => {
    return [
      { name: "주식", value: Math.round(totalStockVal), color: "#6366f1" },
      { name: "실물 자산", value: Math.round(totalAssetsVal), color: "#06b6d4" },
      { name: "예적금", value: Math.round(totalSavingsVal), color: "#10b981" },
    ].filter((d) => d.value > 0);
  }, [totalStockVal, totalAssetsVal, totalSavingsVal]);

  // --- Future projection ---
  const projectedNetWorth = useMemo(() => {
    const target = new Date(targetDate);
    const now = new Date();
    const projectedSavings = savings.reduce((acc, s) => {
      const maturity = new Date(s.maturityDate || targetDate);
      const end = target > maturity ? maturity : target;
      if (end <= now) return acc + s.current;
      const months =
        (end.getFullYear() - now.getFullYear()) * 12 +
        (end.getMonth() - now.getMonth());
      const principal = s.current + s.monthly * Math.max(0, months);
      const interest =
        (s.monthly * months * (months + 1)) / 2 * (s.interestRate / 100 / 12);
      return acc + principal + interest;
    }, 0);
    return totalStockVal + totalAssetsVal + projectedSavings - totalDebtsVal;
  }, [targetDate, savings, totalStockVal, totalAssetsVal, totalDebtsVal]);

  // --- Realized grouped by month ---
  const realizedGrouped = useMemo(() => {
    const sorted = [...realized].sort((a, b) =>
      realizedSortOrder === "desc"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const acc: Record<string, { items: Realized[]; sub: number }> = {};
    sorted.forEach((r) => {
      const m = r.date.substring(0, 7);
      if (!acc[m]) acc[m] = { items: [], sub: 0 };
      acc[m].items.push(r);
      acc[m].sub += r.profit;
    });
    return acc;
  }, [realized, realizedSortOrder]);

  const totalRealizedProfit = realized.reduce((a, b) => a + b.profit, 0);

  // ═══════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════
  const updateAsset = (id: number, field: "name" | "value", val: string) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, [field]: field === "value" ? cleanNum(val) : val }
          : a
      )
    );
  };
  const updateDebt = (id: number, field: "name" | "value", val: string) => {
    setDebts((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, [field]: field === "value" ? cleanNum(val) : val }
          : d
      )
    );
  };
  const updateSaving = (id: number, field: string, val: string) => {
    setSavings((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (["monthly", "current", "interestRate", "transferDay"].includes(field))
          return { ...s, [field]: cleanNum(val) };
        return { ...s, [field]: val };
      })
    );
  };

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════
  if (!isClient || loading) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">📊</div>
          <p className="font-black text-lg tracking-tight">
            LOADING ASSET DATA...
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Fetching from Google Sheets & Exchange Rate API
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      {toast && <ToastMessage message={toast.msg} type={toast.type} />}

      <div className="max-w-5xl mx-auto">
        {/* ── Header ── */}
        <header className="mb-8 flex flex-wrap justify-between items-end border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter">
              ASSET MASTER V2
            </h1>
            <p className="text-slate-500 text-[10px] font-bold tracking-[0.3em] uppercase mt-1">
              Portfolio Dashboard · Powered by Google Sheets
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[10px] text-slate-600 font-mono">
                Updated {lastUpdated}
              </span>
            )}
            <button
              onClick={() => {
                fetchAllData();
                showToast("데이터를 새로고침합니다", "info");
              }}
              className="text-[10px] text-slate-400 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl font-bold transition-colors"
            >
              ↻ 새로고침
            </button>
            <div className="text-[10px] text-amber-500 font-mono bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 font-bold">
              USD/KRW: {exchangeRate.toFixed(2)}
            </div>
          </div>
        </header>

        {/* ── Tabs ── */}
        <nav className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all whitespace-nowrap ${
                activeTab === t.key
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "bg-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              }`}
            >
              {t.num}. {t.label}
            </button>
          ))}
        </nav>

        {/* ══════════════════════════════════ */}
        {/* TAB 1: OVERVIEW                   */}
        {/* ══════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Net Worth Hero */}
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 p-12 rounded-[50px] border border-blue-500/20 shadow-2xl">
              <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase mb-4 opacity-70">
                Current Net Worth
              </p>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
                {fmt(netWorth)}
                <span className="text-2xl font-light ml-2 opacity-30">KRW</span>
              </h2>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="주식 평가액" value={`${fmtShort(totalStockVal)}원`} />
              <StatCard label="기타 자산" value={`${fmtShort(totalAssetsVal)}원`} />
              <StatCard label="예적금 현고" value={`${fmtShort(totalSavingsVal)}원`} />
              <StatCard
                label="부채 총계"
                value={`${fmtShort(totalDebtsVal)}원`}
                variant="danger"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Asset Composition Pie */}
              <Card className="p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                  자산 구성 비중
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={compositionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {compositionData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      formatter={(val: string) => (
                        <span className="text-slate-400 text-xs">{val}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              {/* Market Split Pie */}
              <Card className="p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                  국내 / 해외 비중
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={marketChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {marketChartData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      formatter={(val: string) => (
                        <span className="text-slate-400 text-xs">{val}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Account Bar Chart */}
            {accountChartData.length > 0 && (
              <Card className="p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                  계좌별 평가액
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={accountChartData}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={(v) => fmtShort(v)}
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {accountChartData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Future Projection */}
            <div className="bg-emerald-900/10 p-10 rounded-[50px] border border-emerald-900/30">
              <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                <div>
                  <h3 className="text-xl font-black text-emerald-400 italic">
                    Future Projection
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                    예적금 이자 포함 미래 가치
                  </p>
                </div>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-slate-900 text-emerald-400 font-black p-3 rounded-2xl border border-emerald-900/50 outline-none"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-950/50 p-6 rounded-3xl text-center">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-2">
                    예상 미래 순자산
                  </p>
                  <p className="text-3xl font-black text-white">
                    {fmt(projectedNetWorth)} 원
                  </p>
                </div>
                <div className="bg-slate-950/50 p-6 rounded-3xl text-center">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-2">
                    현재 대비 증감액
                  </p>
                  <p className="text-3xl font-black text-emerald-400">
                    +{fmt(projectedNetWorth - netWorth)} 원
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════ */}
        {/* TAB 2: STOCKS                     */}
        {/* ══════════════════════════════════ */}
        {activeTab === "stocks" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Market Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-900/10 p-6 rounded-[30px] border border-blue-900/30">
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    국내 주식
                  </span>
                  <span className={`font-black ${pctColor(stockSummary.dom.yieldPct)}`}>
                    {stockSummary.dom.yieldPct.toFixed(2)}%
                  </span>
                </div>
                <p className="text-2xl font-black text-white">
                  {fmt(stockSummary.dom.val)}
                </p>
                <p className={`text-xs mt-1 ${pctColor(stockSummary.dom.profit)}`}>
                  {pctSign(stockSummary.dom.profit)}
                  {fmt(stockSummary.dom.profit)}원
                </p>
              </div>
              <div className="bg-amber-900/10 p-6 rounded-[30px] border border-amber-900/30">
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                    해외 주식(환산)
                  </span>
                  <span className={`font-black ${pctColor(stockSummary.os.yieldPct)}`}>
                    {stockSummary.os.yieldPct.toFixed(2)}%
                  </span>
                </div>
                <p className="text-2xl font-black text-white">
                  {fmt(stockSummary.os.val)}
                </p>
                <p className={`text-xs mt-1 ${pctColor(stockSummary.os.profit)}`}>
                  {pctSign(stockSummary.os.profit)}
                  {fmt(stockSummary.os.profit)}원
                </p>
              </div>
            </div>

            {/* Account Groups */}
            {Object.keys(grouped).map((acc) => (
              <Card key={acc} className="overflow-hidden">
                <div className="px-8 py-5 bg-slate-800/40 border-b border-slate-800 flex justify-between items-center">
                  <span className="font-black text-white italic tracking-tight text-lg">
                    💳 {acc}
                  </span>
                  <div className="text-right">
                    <span className="text-white font-black text-lg">
                      {fmt(grouped[acc].total)}원
                    </span>
                    <span
                      className={`ml-3 text-sm font-bold ${pctColor(grouped[acc].profit)}`}
                    >
                      {pctSign(grouped[acc].profit)}
                      {fmt(grouped[acc].profit)}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-black uppercase border-b border-slate-800">
                        <th className="px-8 py-4">구분 / 종목명</th>
                        <th className="px-8 py-4 text-center">수량 / 평단</th>
                        <th className="px-8 py-4 text-right">
                          수익률 / 원화손익
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {grouped[acc].items.map((s, i) => {
                        const isOS = s.market.includes("해외");
                        const rate = isOS ? exchangeRate : 1;
                        const yR =
                          s.avg > 0
                            ? ((s.current - s.avg) / s.avg) * 100
                            : 0;
                        const profKrw = (s.current - s.avg) * rate * s.qty;
                        return (
                          <tr
                            key={i}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-8 py-5 font-bold text-slate-200">
                              <span
                                className={`text-[8px] mr-2 px-1.5 py-0.5 rounded-sm uppercase tracking-tighter ${
                                  isOS
                                    ? "bg-amber-900/50 text-amber-500"
                                    : "bg-blue-900/50 text-blue-400"
                                }`}
                              >
                                {isOS ? "US" : "KR"}
                              </span>
                              {s.name}
                            </td>
                            <td className="px-8 py-5 text-center text-slate-500 font-mono text-xs">
                              {s.qty.toLocaleString()}주 /{" "}
                              {isOS
                                ? `$${s.avg}`
                                : `${fmt(s.avg)}원`}
                            </td>
                            <td
                              className={`px-8 py-5 text-right font-black ${pctColor(yR)}`}
                            >
                              <div className="text-sm">
                                {pctArrow(yR)} {yR.toFixed(2)}%
                              </div>
                              <div className="text-[10px] opacity-60 font-medium">
                                {pctSign(profKrw)}
                                {fmt(profKrw)}원
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}

            {stocks.length === 0 && (
              <div className="text-center py-20 text-slate-600">
                <p className="text-2xl mb-2">📉</p>
                <p>구글 시트에서 주식 데이터를 불러올 수 없습니다</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════ */}
        {/* TAB 3: REAL ASSETS & DEBTS        */}
        {/* ══════════════════════════════════ */}
        {activeTab === "realestate" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EditableList
                title="Real Assets"
                items={assets}
                onUpdate={updateAsset}
                onAdd={() =>
                  setAssets([
                    ...assets,
                    { id: Date.now(), name: "", value: 0 },
                  ])
                }
                onRemove={(id) =>
                  setAssets(assets.filter((a) => a.id !== id))
                }
              />
              <EditableList
                title="Liabilities"
                titleColor="text-rose-400"
                items={debts}
                onUpdate={updateDebt}
                onAdd={() =>
                  setDebts([
                    ...debts,
                    { id: Date.now(), name: "", value: 0 },
                  ])
                }
                onRemove={(id) =>
                  setDebts(debts.filter((d) => d.id !== id))
                }
                addColor="bg-rose-600"
                borderColor="border-rose-900/20"
                inputColor="text-rose-400"
                containerClass="bg-rose-900/10 border-rose-900/30"
              />
            </div>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="실물 자산 합계" value={`${fmtShort(totalAssetsVal)}원`} />
              <StatCard
                label="부채 합계"
                value={`${fmtShort(totalDebtsVal)}원`}
                variant="danger"
              />
              <StatCard
                label="순 실물 자산"
                value={`${fmtShort(totalAssetsVal - totalDebtsVal)}원`}
                variant={totalAssetsVal - totalDebtsVal >= 0 ? "success" : "danger"}
              />
            </div>
            <p className="text-center text-slate-600 text-[10px]">
              💾 자산 및 부채 데이터는 브라우저에 자동 저장됩니다
            </p>
          </div>
        )}

        {/* ══════════════════════════════════ */}
        {/* TAB 4: SAVINGS                    */}
        {/* ══════════════════════════════════ */}
        {activeTab === "savings" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-white italic">
                Savings & Deposits
              </h3>
              <button
                onClick={() =>
                  setSavings([
                    ...savings,
                    {
                      id: Date.now(),
                      name: "",
                      monthly: 0,
                      current: 0,
                      maturityDate: "2027-01-01",
                      transferDay: 25,
                      interestRate: 3.0,
                    },
                  ])
                }
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-full text-[10px] font-bold text-white transition-colors"
              >
                + 적금 추가
              </button>
            </div>

            {savings.map((s) => {
              const maturity = new Date(s.maturityDate);
              const now = new Date();
              const mLeft = Math.max(
                0,
                (maturity.getFullYear() - now.getFullYear()) * 12 +
                  (maturity.getMonth() - now.getMonth())
              );
              const fPrincipal = s.current + s.monthly * mLeft;
              const fInterest =
                (s.monthly * mLeft * (mLeft + 1)) / 2 *
                (s.interestRate / 100 / 12);
              const fVal = fPrincipal + fInterest;

              return (
                <Card key={s.id} className="p-0 overflow-hidden">
                  <div className="px-8 py-5 bg-slate-800/40 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) =>
                          updateSaving(s.id, "name", e.target.value)
                        }
                        className="bg-transparent text-white font-black text-lg italic outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500 transition-colors"
                        placeholder="적금 이름"
                      />
                      <button
                        onClick={() =>
                          setSavings(savings.filter((x) => x.id !== s.id))
                        }
                        className="text-slate-600 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                    <span className="text-slate-500 text-xs font-mono">
                      만기까지 {mLeft}개월
                    </span>
                  </div>
                  <div className="flex flex-wrap">
                    <div className="flex-1 min-w-[300px] p-6">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: "월 납입액", field: "monthly", val: s.monthly.toLocaleString(), suffix: "원" },
                          { label: "현재 잔액", field: "current", val: s.current.toLocaleString(), suffix: "원" },
                          { label: "금리 (%)", field: "interestRate", val: s.interestRate.toString(), suffix: "%" },
                          { label: "이체일", field: "transferDay", val: s.transferDay.toString(), suffix: "일" },
                        ].map((f) => (
                          <div key={f.field}>
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">
                              {f.label}
                            </p>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={f.val}
                                onChange={(e) =>
                                  updateSaving(s.id, f.field, e.target.value)
                                }
                                className="w-full bg-slate-950 text-white font-bold p-2 rounded-lg border border-slate-800 outline-none focus:border-emerald-500 transition-colors"
                              />
                              <span className="text-slate-600 text-xs">
                                {f.suffix}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div className="col-span-2">
                          <p className="text-[10px] text-slate-500 font-black uppercase mb-1">
                            만기일
                          </p>
                          <input
                            type="date"
                            value={s.maturityDate}
                            onChange={(e) =>
                              updateSaving(s.id, "maturityDate", e.target.value)
                            }
                            className="w-full bg-slate-950 text-white font-bold p-2 rounded-lg border border-slate-800 outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="w-full xl:w-1/3 bg-emerald-900/10 p-6 rounded-2xl border border-emerald-900/30 text-right flex flex-col justify-center m-4">
                      <p className="text-[10px] text-emerald-400 mb-1 font-black uppercase tracking-widest">
                        만기 예상액
                      </p>
                      <p className="text-3xl font-black text-white leading-none">
                        {fmt(fVal)}
                        <span className="text-sm ml-1 opacity-50 font-light">
                          원
                        </span>
                      </p>
                      <p className="text-xs text-emerald-400/60 mt-2">
                        예상 이자: +{fmt(fInterest)}원
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}

            {savings.length === 0 && (
              <div className="text-center py-20 text-slate-600">
                <p className="text-2xl mb-2">🏦</p>
                <p>적금을 추가해보세요</p>
              </div>
            )}

            <p className="text-center text-slate-600 text-[10px]">
              💾 예적금 데이터는 브라우저에 자동 저장됩니다
            </p>
          </div>
        )}

        {/* ══════════════════════════════════ */}
        {/* TAB 5: REALIZED P&L               */}
        {/* ══════════════════════════════════ */}
        {activeTab === "realized" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="총 실현 손익"
                value={`${pctSign(totalRealizedProfit)}${fmt(totalRealizedProfit)}원`}
                variant={totalRealizedProfit >= 0 ? "success" : "danger"}
              />
              <StatCard
                label="총 거래 건수"
                value={`${realized.length}건`}
              />
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase text-slate-500">
                  정렬
                </p>
                <button
                  onClick={() =>
                    setRealizedSortOrder((o) =>
                      o === "desc" ? "asc" : "desc"
                    )
                  }
                  className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {realizedSortOrder === "desc"
                    ? "최신순 ↓"
                    : "오래된순 ↑"}
                </button>
              </div>
            </div>

            {/* Monthly Groups */}
            {Object.keys(realizedGrouped).map((m) => (
              <Card key={m} className="overflow-hidden">
                <div className="px-8 py-5 bg-slate-800/40 flex justify-between items-center border-b border-slate-800">
                  <span className="font-black text-slate-300 tracking-widest">
                    {m} 결산 소계
                  </span>
                  <span
                    className={`font-black text-lg ${
                      realizedGrouped[m].sub >= 0
                        ? "text-emerald-400"
                        : "text-rose-500"
                    }`}
                  >
                    {pctSign(realizedGrouped[m].sub)}
                    {fmt(realizedGrouped[m].sub)} 원
                  </span>
                </div>
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-800">
                    {realizedGrouped[m].items.map((r, i) => (
                      <tr
                        key={i}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-8 py-4 text-xs text-slate-500 font-mono">
                          {r.date}
                        </td>
                        <td className="px-8 py-4 font-bold text-slate-200">
                          {r.name}
                          {r.note && (
                            <span className="ml-2 text-[10px] text-slate-600">
                              {r.note}
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-4 text-center text-xs text-slate-500">
                          {r.qty > 0 && `${r.qty}주`}
                        </td>
                        <td
                          className={`px-8 py-4 text-right font-black ${
                            r.profit >= 0
                              ? "text-emerald-400"
                              : "text-rose-500"
                          }`}
                        >
                          {pctSign(r.profit)}
                          {fmt(r.profit)}원
                          {r.yieldRate !== 0 && (
                            <span className="ml-2 text-[10px] opacity-60">
                              ({pctSign(r.yieldRate)}
                              {r.yieldRate.toFixed(1)}%)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}

            {realized.length === 0 && (
              <div className="text-center py-20 text-slate-600">
                <p className="text-2xl mb-2">📋</p>
                <p>실현 손익 데이터가 없습니다</p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="text-center py-8 mt-8 border-t border-slate-900">
          <p className="text-slate-700 text-[10px] font-bold tracking-widest uppercase">
            Asset Master V2 · Data from Google Sheets · Exchange Rate from
            open.er-api.com
          </p>
          <p className="text-slate-800 text-[10px] mt-1">
            ⚠️ 이 도구는 참고용이며 투자 조언이 아닙니다
          </p>
        </footer>
      </div>
    </div>
  );
}
