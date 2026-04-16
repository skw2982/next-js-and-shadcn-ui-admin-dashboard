"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ═══════════════════════════════════════════
// Config
// ═══════════════════════════════════════════
const BASE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?";

const GIDS = {
  STOCKS: "0",
  REALIZED: "817751922",
  ASSETS: "1398634207",
  DEBTS: "359303564",
  SAVINGS: "380349145",
};

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
  dailyChange: number;
}
interface Asset { id: number; name: string; value: number; }
interface Debt { id: number; name: string; value: number; }
interface Saving {
  id: number; name: string; monthly: number; current: number;
  maturityDate: string; transferDay: number; interestRate: number;
}
interface Realized {
  date: string; name: string; qty: number;
  profit: number; yieldRate: number; note: string;
}
type TabKey = "overview" | "stocks" | "realestate" | "savings" | "realized";

const TABS: { key: TabKey; label: string; num: string; icon: string }[] = [
  { key: "overview", label: "통합 요약", num: "1", icon: "📊" },
  { key: "stocks", label: "계좌별 주식", num: "2", icon: "💳" },
  { key: "realestate", label: "실물 / 부채", num: "3", icon: "🏠" },
  { key: "savings", label: "예적금", num: "4", icon: "🏦" },
  { key: "realized", label: "실현 손익", num: "5", icon: "💰" },
];

const ACCOUNT_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444", "#f97316"];

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
  if (abs >= 1e8) return (n / 1e8).toFixed(2) + "억";
  if (abs >= 1e4) return (n / 1e4).toFixed(0) + "만";
  return fmt(n);
};
const pctColor = (v: number) => (v >= 0 ? "text-rose-400" : "text-blue-400");
const pctSign = (v: number) => (v >= 0 ? "+" : "");
const pctArrow = (v: number) => (v >= 0 ? "▲" : "▼");
const parseCSVRow = (row: string): string[] =>
  row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/"/g, "").trim());

const loadCachedRate = (): number => {
  if (typeof window === "undefined") return 1350;
  try {
    const v = localStorage.getItem("am_exchange_rate");
    return v ? parseFloat(v) : 1350;
  } catch { return 1350; }
};

// ═══════════════════════════════════════════
// Sub Components
// ═══════════════════════════════════════════
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900/80 backdrop-blur rounded-[28px] border border-slate-800/80 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function StatCard({
  label, value, sub, variant = "default", icon,
}: {
  label: string; value: string; sub?: string;
  variant?: "default" | "danger" | "success" | "warning";
  icon?: string;
}) {
  const styles = {
    default: "bg-slate-900/80 border-slate-800 text-white",
    danger: "bg-gradient-to-br from-rose-950/40 to-slate-900 border-rose-900/50 text-rose-300",
    success: "bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-900/50 text-emerald-300",
    warning: "bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-900/50 text-amber-300",
  };
  const labelColor = {
    default: "text-slate-500",
    danger: "text-rose-500/80",
    success: "text-emerald-500/80",
    warning: "text-amber-500/80",
  };
  return (
    <div className={`p-5 rounded-3xl border ${styles[variant]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-xs opacity-70">{icon}</span>}
        <p className={`text-[10px] font-black uppercase tracking-widest ${labelColor[variant]}`}>{label}</p>
      </div>
      <p className="text-2xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60 font-medium">{sub}</p>}
    </div>
  );
}

const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800/95 backdrop-blur border border-slate-700 rounded-xl px-4 py-2.5 text-sm shadow-2xl">
      <p className="text-white font-bold text-xs mb-0.5">{payload[0]?.name}</p>
      <p className="text-slate-300 font-mono text-sm">{fmt(payload[0]?.value)}원</p>
    </div>
  );
};

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════
export default function AssetMasterV2() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1350);
  const [targetDate, setTargetDate] = useState("2026-12-31");
  const [realizedSortOrder, setRealizedSortOrder] = useState<"desc" | "asc">("desc");

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [realized, setRealized] = useState<Realized[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);

  const fetchCSV = async (gid: string) => {
    try {
      const res = await fetch(`${BASE_CSV_URL}gid=${gid}&single=true&output=csv&t=${Date.now()}`);
      if (!res.ok) return [];
      const text = await res.text();
      return text.split("\n").map((r) => r.trim()).filter(Boolean).slice(1);
    } catch { return []; }
  };

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);

      try {
        const rateRes = await fetch("https://open.er-api.com/v6/latest/USD");
        if (rateRes.ok) {
          const rateData = await rateRes.json();
          if (rateData?.rates?.KRW) {
            setExchangeRate(rateData.rates.KRW);
            try { localStorage.setItem("am_exchange_rate", rateData.rates.KRW.toString()); } catch {}
          }
        }
      } catch { setExchangeRate(loadCachedRate()); }

      const [sRows, rRows, aRows, dRows, svRows] = await Promise.all([
        fetchCSV(GIDS.STOCKS), fetchCSV(GIDS.REALIZED), fetchCSV(GIDS.ASSETS),
        fetchCSV(GIDS.DEBTS), fetchCSV(GIDS.SAVINGS),
      ]);

      setStocks(
        sRows.map((row) => {
          const c = parseCSVRow(row);
          return {
            market: c[0] || "국내", account: c[1] || "미분류", name: c[2] || "알 수 없음",
            avg: cleanNum(c[5]), current: cleanNum(c[6]), qty: cleanNum(c[7]),
            dailyChange: cleanNum(c[8]),
          };
        }).filter((s) => s.qty > 0)
      );

      setRealized(
        rRows.map((row) => {
          const c = parseCSVRow(row);
          return {
            date: c[0], name: c[1], qty: cleanNum(c[2]),
            profit: cleanNum(c[3]), yieldRate: cleanNum(c[4]), note: c[5] || "",
          };
        }).filter((r) => r.date)
      );

      setAssets(
        aRows.map((row, i) => {
          const c = parseCSVRow(row);
          return { id: i, name: c[0] || "자산", value: cleanNum(c[1]) };
        }).filter((a) => a.name && a.value > 0)
      );

      setDebts(
        dRows.map((row, i) => {
          const c = parseCSVRow(row);
          return { id: i, name: c[0] || "부채", value: cleanNum(c[1]) };
        }).filter((d) => d.name && d.value > 0)
      );

      setSavings(
        svRows.map((row, i) => {
          const c = parseCSVRow(row);
          return {
            id: i, name: c[0] || "적금", monthly: cleanNum(c[1]), current: cleanNum(c[2]),
            maturityDate: c[3] || "2026-12-31", transferDay: cleanNum(c[4]), interestRate: cleanNum(c[5]),
          };
        }).filter((s) => s.name)
      );

      setLastUpdated(new Date().toLocaleTimeString("ko-KR"));
      setLoading(false);
      setInitialLoad(false);
    } catch {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    setExchangeRate(loadCachedRate());
    fetchAllData();
    const timer = setInterval(fetchAllData, 60000);
    return () => clearInterval(timer);
  }, [fetchAllData]);

  // ═══════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════
  const grouped = useMemo(() => {
    const acc: Record<string, { items: Stock[]; total: number; profit: number; invested: number; dailyProfit: number }> = {};
    stocks.forEach((s) => {
      if (!acc[s.account]) acc[s.account] = { items: [], total: 0, profit: 0, invested: 0, dailyProfit: 0 };
      const isOS = s.market.includes("해외");
      const rate = isOS ? exchangeRate : 1;
      acc[s.account].items.push(s);
      acc[s.account].total += s.current * rate * s.qty;
      acc[s.account].invested += s.avg * rate * s.qty;
      acc[s.account].profit += (s.current - s.avg) * rate * s.qty;
      acc[s.account].dailyProfit += s.dailyChange * rate * s.qty;
    });
    return acc;
  }, [stocks, exchangeRate]);

  const totalDailyProfit = useMemo(
    () => Object.values(grouped).reduce((a, b) => a + b.dailyProfit, 0),
    [grouped]
  );

  const stockSummary = useMemo(() => {
    let domVal = 0, domInv = 0, osVal = 0, osInv = 0;
    stocks.forEach((s) => {
      const isOS = s.market.includes("해외");
      const rate = isOS ? exchangeRate : 1;
      if (isOS) { osVal += s.current * rate * s.qty; osInv += s.avg * rate * s.qty; }
      else { domVal += s.current * s.qty; domInv += s.avg * s.qty; }
    });
    return {
      dom: { val: domVal, profit: domVal - domInv, yieldPct: domInv > 0 ? ((domVal - domInv) / domInv) * 100 : 0 },
      os: { val: osVal, profit: osVal - osInv, yieldPct: osInv > 0 ? ((osVal - osInv) / osInv) * 100 : 0 },
    };
  }, [stocks, exchangeRate]);

  const totalStockVal = stockSummary.dom.val + stockSummary.os.val;
  const totalStockProfit = stockSummary.dom.profit + stockSummary.os.profit;
  const totalAssetsVal = assets.reduce((a, b) => a + b.value, 0);
  const totalSavingsVal = savings.reduce((a, b) => a + b.current, 0);
  const totalDebtsVal = debts.reduce((a, b) => a + b.value, 0);
  const netWorth = totalStockVal + totalAssetsVal + totalSavingsVal - totalDebtsVal;

  const compositionData = useMemo(
    () => [
      { name: "주식", value: Math.round(totalStockVal), color: "#6366f1" },
      { name: "실물 자산", value: Math.round(totalAssetsVal), color: "#06b6d4" },
      { name: "예적금", value: Math.round(totalSavingsVal), color: "#10b981" },
    ].filter((d) => d.value > 0),
    [totalStockVal, totalAssetsVal, totalSavingsVal]
  );

  const accountChartData = useMemo(
    () => Object.entries(grouped)
      .map(([name, data], i) => ({ name, value: Math.round(data.total), color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }))
      .sort((a, b) => b.value - a.value),
    [grouped]
  );

  const projectedNetWorth = useMemo(() => {
    const target = new Date(targetDate);
    const now = new Date();
    const ps = savings.reduce((acc, s) => {
      const maturity = new Date(s.maturityDate || targetDate);
      const end = target > maturity ? maturity : target;
      if (end <= now) return acc + s.current;
      const months = Math.max(0, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()));
      const principal = s.current + s.monthly * months;
      const cInt = s.current * (s.interestRate / 100) * (months / 12);
      const fInt = ((s.monthly * months * (months + 1)) / 2) * (s.interestRate / 100 / 12);
      return acc + principal + cInt + fInt;
    }, 0);
    return totalStockVal + totalAssetsVal + ps - totalDebtsVal;
  }, [targetDate, savings, totalStockVal, totalAssetsVal, totalDebtsVal]);

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
  // Render
  // ═══════════════════════════════════════
  if (!isClient || initialLoad) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">📊</div>
          <p className="font-black text-lg tracking-tight">LOADING ASSET DATA...</p>
          <p className="text-slate-500 text-xs mt-2">Google Sheets & Exchange Rate</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative">
        {/* ── Header ── */}
        <header className="mb-8 flex flex-wrap justify-between items-end border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter">
              ASSET MASTER <span className="text-blue-500">V2</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold tracking-[0.3em] uppercase mt-1">
              Daily Profit Tracker · Google Sheets Sync
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {lastUpdated && <span className="text-[10px] text-slate-600 font-mono">Synced {lastUpdated}</span>}
            <button
              onClick={fetchAllData}
              disabled={loading}
              className={`text-[10px] px-4 py-2 rounded-xl font-bold transition-all ${
                loading ? "bg-blue-600 text-white animate-pulse" : "text-slate-300 bg-slate-800 hover:bg-slate-700 hover:scale-105"
              }`}
            >
              {loading ? "🔄 SYNCING..." : "↻ REFRESH"}
            </button>
            <div className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 font-bold">
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
              className={`px-5 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === t.key
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105"
                  : "bg-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.num}. {t.label}</span>
            </button>
          ))}
        </nav>

        {/* ══════════════════════════════════ TAB 1: OVERVIEW ══════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-blue-900/40 via-slate-900 to-slate-900 p-10 md:p-12 rounded-[40px] border border-blue-500/20 shadow-2xl">
              <div className="flex flex-wrap justify-between items-end gap-8">
                <div>
                  <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase mb-3 opacity-80">💼 Current Net Worth</p>
                  <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
                    {fmt(netWorth)}<span className="text-2xl font-light ml-2 opacity-30">KRW</span>
                  </h2>
                  <p className="text-slate-500 text-sm mt-2 font-mono">약 {fmtShort(netWorth)}원</p>
                </div>
                <div className={`text-right p-6 rounded-3xl border backdrop-blur ${
                  totalDailyProfit >= 0 ? "bg-rose-500/10 border-rose-500/30" : "bg-blue-500/10 border-blue-500/30"
                }`}>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">📈 Today's P&L</p>
                  <p className={`text-3xl md:text-4xl font-black ${pctColor(totalDailyProfit)}`}>
                    {pctSign(totalDailyProfit)}{fmt(totalDailyProfit)}<span className="text-sm opacity-60 ml-1">원</span>
                  </p>
                  <p className={`text-xs mt-1 font-mono ${pctColor(totalDailyProfit)} opacity-70`}>
                    {pctArrow(totalDailyProfit)} {totalStockVal > 0 ? ((totalDailyProfit / totalStockVal) * 100).toFixed(2) : "0"}%
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="주식 평가액" value={`${fmtShort(totalStockVal)}원`} sub={`${pctSign(totalStockProfit)}${fmtShort(totalStockProfit)}`} icon="📈" />
              <StatCard label="기타 자산" value={`${fmtShort(totalAssetsVal)}원`} sub={`${assets.length}건`} icon="🏠" />
              <StatCard label="예적금" value={`${fmtShort(totalSavingsVal)}원`} sub={`${savings.length}개`} variant="success" icon="🏦" />
              <StatCard label="부채 총계" value={`${fmtShort(totalDebtsVal)}원`} sub={`${debts.length}건`} variant="danger" icon="💳" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">🥧 자산 구성 비중</p>
                {compositionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={compositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                        {compositionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend formatter={(val: string) => <span className="text-slate-400 text-xs">{val}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-slate-600 text-center py-16 text-sm">데이터 없음</p>}
              </Card>

              <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 p-8 rounded-[28px] border border-emerald-900/40 shadow-xl">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
                  <div>
                    <h3 className="text-lg font-black text-emerald-400 italic">🚀 Future Projection</h3>
                    <p className="text-[10px] text-slate-500 mt-1">이자 포함 미래 가치</p>
                  </div>
                  <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                    className="bg-slate-950/80 text-emerald-400 font-black p-2 rounded-xl border border-emerald-900/50 outline-none text-sm focus:border-emerald-500 transition-colors" />
                </div>
                <div className="space-y-3">
                  <div className="bg-slate-950/60 p-5 rounded-2xl">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-1">예상 미래 순자산</p>
                    <p className="text-3xl font-black text-white">{fmt(projectedNetWorth)} <span className="text-sm opacity-40 font-light">원</span></p>
                  </div>
                  <div className="bg-emerald-950/40 p-5 rounded-2xl border border-emerald-900/40">
                    <p className="text-[10px] text-emerald-400/70 font-black uppercase mb-1">증감 예상</p>
                    <p className="text-2xl font-black text-emerald-400">
                      +{fmt(projectedNetWorth - netWorth)}
                      <span className="text-xs opacity-60 ml-2 font-mono">({((projectedNetWorth / netWorth - 1) * 100).toFixed(1)}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {accountChartData.length > 0 && (
              <Card className="p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">📊 계좌별 평가액</p>
                <ResponsiveContainer width="100%" height={Math.max(180, accountChartData.length * 44)}>
                  <BarChart data={accountChartData} layout="vertical" margin={{ left: 90, right: 20 }}>
                    <XAxis type="number" tickFormatter={(v) => fmtShort(v)} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fill: "#cbd5e1", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {accountChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        )}

        {/* ══════════════════════════════════ TAB 2: STOCKS ══════════════════════════════════ */}
        {activeTab === "stocks" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 border-blue-900/40">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">🇰🇷 국내 주식</span>
                  <span className={`font-black text-lg ${pctColor(stockSummary.dom.yieldPct)}`}>
                    {stockSummary.dom.yieldPct >= 0 ? "+" : ""}{stockSummary.dom.yieldPct.toFixed(2)}%
                  </span>
                </div>
                <p className="text-2xl font-black text-white">{fmt(stockSummary.dom.val)}</p>
                <p className={`text-xs mt-1 ${pctColor(stockSummary.dom.profit)}`}>
                  {pctSign(stockSummary.dom.profit)}{fmt(stockSummary.dom.profit)}원
                </p>
              </Card>
              <Card className="p-6 border-amber-900/40">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">🇺🇸 해외 주식</span>
                  <span className={`font-black text-lg ${pctColor(stockSummary.os.yieldPct)}`}>
                    {stockSummary.os.yieldPct >= 0 ? "+" : ""}{stockSummary.os.yieldPct.toFixed(2)}%
                  </span>
                </div>
                <p className="text-2xl font-black text-white">{fmt(stockSummary.os.val)}</p>
                <p className={`text-xs mt-1 ${pctColor(stockSummary.os.profit)}`}>
                  {pctSign(stockSummary.os.profit)}{fmt(stockSummary.os.profit)}원
                </p>
              </Card>
              <Card className={`p-6 ${totalDailyProfit >= 0 ? "border-rose-900/40" : "border-blue-900/40"}`}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📈 오늘 전체</span>
                  <span className="text-[10px] font-bold text-slate-600">실시간</span>
                </div>
                <p className={`text-2xl font-black ${pctColor(totalDailyProfit)}`}>
                  {pctSign(totalDailyProfit)}{fmt(totalDailyProfit)}원
                </p>
                <p className="text-xs mt-1 text-slate-500">
                  {totalStockVal > 0 ? ((totalDailyProfit / totalStockVal) * 100).toFixed(2) : 0}%
                </p>
              </Card>
            </div>

            {Object.keys(grouped).map((acc) => (
              <Card key={acc} className="overflow-hidden">
                <div className="px-6 md:px-8 py-5 bg-slate-800/40 border-b border-slate-800 flex justify-between items-center flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-black text-white italic tracking-tight text-lg">💳 {acc}</span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                      grouped[acc].dailyProfit >= 0 ? "bg-rose-500/10 text-rose-400" : "bg-blue-500/10 text-blue-400"
                    }`}>
                      오늘 {pctSign(grouped[acc].dailyProfit)}{fmt(grouped[acc].dailyProfit)}원
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-black text-lg">{fmt(grouped[acc].total)}원</div>
                    <div className={`text-xs font-bold ${pctColor(grouped[acc].profit)}`}>
                      누적 {pctSign(grouped[acc].profit)}{fmt(grouped[acc].profit)}원
                      {grouped[acc].invested > 0 && (
                        <span className="ml-1 opacity-60">({((grouped[acc].profit / grouped[acc].invested) * 100).toFixed(1)}%)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-black uppercase border-b border-slate-800/50">
                        <th className="px-6 md:px-8 py-3">종목</th>
                        <th className="px-6 md:px-8 py-3 text-center hidden md:table-cell">수량 / 평단</th>
                        <th className="px-6 md:px-8 py-3 text-right">오늘 / 누적</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {grouped[acc].items.map((s, i) => {
                        const isOS = s.market.includes("해외");
                        const rate = isOS ? exchangeRate : 1;
                        const yR = s.avg > 0 ? ((s.current - s.avg) / s.avg) * 100 : 0;
                        const profKrw = (s.current - s.avg) * rate * s.qty;
                        const dProfKrw = s.dailyChange * rate * s.qty;
                        const dPct = s.current > 0 ? (s.dailyChange / s.current) * 100 : 0;
                        return (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 md:px-8 py-4 font-bold text-slate-200">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                                  isOS ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                                }`}>{isOS ? "US" : "KR"}</span>
                                <span>{s.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-600 mt-1 md:hidden">
                                {s.qty}주 · {isOS ? `$${s.avg}` : `${fmt(s.avg)}원`}
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-4 text-center text-slate-400 font-mono text-xs hidden md:table-cell">
                              <div>{s.qty.toLocaleString()}주</div>
                              <div className="text-[10px] text-slate-600 mt-0.5">평단 {isOS ? `$${s.avg}` : `${fmt(s.avg)}원`}</div>
                            </td>
                            <td className="px-6 md:px-8 py-4 text-right">
                              <div className={`text-sm font-black ${pctColor(dProfKrw)}`}>
                                {pctSign(dProfKrw)}{fmt(dProfKrw)}원
                                <span className="text-[10px] opacity-60 ml-1">({dPct >= 0 ? "+" : ""}{dPct.toFixed(2)}%)</span>
                              </div>
                              <div className={`text-[10px] mt-0.5 ${pctColor(profKrw)} opacity-70`}>
                                누적 {pctSign(profKrw)}{fmt(profKrw)}원 ({yR.toFixed(1)}%)
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
                <p className="text-4xl mb-3">📉</p>
                <p className="font-bold">주식 데이터가 없습니다</p>
                <p className="text-xs mt-1">구글 시트의 STOCKS 탭을 확인하세요</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════ TAB 3: REAL ASSETS & DEBTS ══════════════════════════════════ */}
        {activeTab === "realestate" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="실물 자산 합계" value={`${fmtShort(totalAssetsVal)}원`} sub={`${assets.length}건`} icon="🏠" />
              <StatCard label="부채 합계" value={`${fmtShort(totalDebtsVal)}원`} sub={`${debts.length}건`} variant="danger" icon="💳" />
              <StatCard label="순 실물 자산" value={`${fmtShort(totalAssetsVal - totalDebtsVal)}원`}
                variant={totalAssetsVal - totalDebtsVal >= 0 ? "success" : "danger"} icon="⚖️" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-cyan-400 italic">🏠 Real Assets</h3>
                  <span className="text-[10px] text-slate-600 font-mono">{assets.length} items</span>
                </div>
                <div className="space-y-2">
                  {assets.map((a) => (
                    <div key={a.id} className="flex justify-between items-center bg-slate-950/60 px-4 py-3 rounded-2xl border border-slate-800 hover:border-cyan-900/50 transition-colors">
                      <span className="font-bold text-slate-300 text-sm">{a.name}</span>
                      <span className="font-black text-cyan-400 font-mono">
                        {fmt(a.value)}<span className="text-[10px] opacity-50 ml-1">원</span>
                      </span>
                    </div>
                  ))}
                  {assets.length === 0 && <p className="text-slate-600 text-center py-8 text-sm">자산 데이터 없음</p>}
                </div>
              </Card>

              <div className="bg-rose-950/20 p-6 rounded-[28px] border border-rose-900/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-rose-400 italic">💳 Liabilities</h3>
                  <span className="text-[10px] text-slate-600 font-mono">{debts.length} items</span>
                </div>
                <div className="space-y-2">
                  {debts.map((d) => (
                    <div key={d.id} className="flex justify-between items-center bg-slate-950/60 px-4 py-3 rounded-2xl border border-rose-900/20 hover:border-rose-900/50 transition-colors">
                      <span className="font-bold text-slate-300 text-sm">{d.name}</span>
                      <span className="font-black text-rose-400 font-mono">
                        -{fmt(d.value)}<span className="text-[10px] opacity-50 ml-1">원</span>
                      </span>
                    </div>
                  ))}
                  {debts.length === 0 && <p className="text-slate-600 text-center py-8 text-sm">부채 데이터 없음</p>}
                </div>
              </div>
            </div>

            <p className="text-center text-slate-600 text-[10px] font-mono">
              ⚡ 구글 시트의 ASSETS / DEBTS 탭에서 관리됩니다
            </p>
          </div>
        )}

        {/* ══════════════════════════════════ TAB 4: SAVINGS ══════════════════════════════════ */}
        {activeTab === "savings" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="총 현재 잔액" value={`${fmtShort(totalSavingsVal)}원`} icon="🏦" />
              <StatCard label="월 납입 총액" value={`${fmtShort(savings.reduce((a, b) => a + b.monthly, 0))}원`}
                sub={`${savings.length}개 상품`} icon="💸" />
              <StatCard label="평균 금리"
                value={savings.length > 0 ? `${(savings.reduce((a, b) => a + b.interestRate, 0) / savings.length).toFixed(2)}%` : "0%"}
                variant="success" icon="📊" />
            </div>

            {savings.map((s) => {
              const maturity = new Date(s.maturityDate);
              const now = new Date();
              const mLeft = Math.max(0, (maturity.getFullYear() - now.getFullYear()) * 12 + (maturity.getMonth() - now.getMonth()));
              const fPrincipal = s.current + s.monthly * mLeft;
              const cInt = s.current * (s.interestRate / 100) * (mLeft / 12);
              const fInt = ((s.monthly * mLeft * (mLeft + 1)) / 2) * (s.interestRate / 100 / 12);
              const fVal = fPrincipal + cInt + fInt;
              const totalInt = cInt + fInt;

              return (
                <Card key={s.id} className="overflow-hidden">
                  <div className="px-6 md:px-8 py-5 bg-gradient-to-r from-emerald-900/20 to-transparent border-b border-slate-800 flex justify-between items-center flex-wrap gap-3">
                    <div>
                      <span className="font-black text-white italic tracking-tight text-lg">🏦 {s.name}</span>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        매월 {s.transferDay}일 이체 · {s.interestRate}% 금리
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                        만기까지 {mLeft}개월
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{s.maturityDate}</span>
                    </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">월 납입액</p>
                      <p className="text-xl font-black text-white">{fmt(s.monthly)}<span className="text-xs opacity-40 ml-1">원</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">현재 잔액</p>
                      <p className="text-xl font-black text-white">{fmt(s.current)}<span className="text-xs opacity-40 ml-1">원</span></p>
                    </div>
                    <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-2xl p-4 text-right">
                      <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-1">🎯 만기 예상액</p>
                      <p className="text-2xl font-black text-white">{fmt(fVal)}<span className="text-xs opacity-40 ml-1">원</span></p>
                      <p className="text-[10px] text-emerald-400/70 mt-1">이자 +{fmt(totalInt)}원</p>
                    </div>
                  </div>
                </Card>
              );
            })}

            {savings.length === 0 && (
              <div className="text-center py-20 text-slate-600">
                <p className="text-4xl mb-3">🏦</p>
                <p className="font-bold">적금 데이터가 없습니다</p>
                <p className="text-xs mt-1">구글 시트의 SAVINGS 탭을 확인하세요</p>
              </div>
            )}

            <p className="text-center text-slate-600 text-[10px] font-mono">
              ⚡ 구글 시트의 SAVINGS 탭에서 관리됩니다
            </p>
          </div>
        )}

        {/* ══════════════════════════════════ TAB 5: REALIZED P&L ══════════════════════════════════ */}
        {activeTab === "realized" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="총 실현 손익" value={`${pctSign(totalRealizedProfit)}${fmtShort(totalRealizedProfit)}원`}
                variant={totalRealizedProfit >= 0 ? "success" : "danger"} icon="💰" />
              <StatCard label="총 거래 건수" value={`${realized.length}건`} icon="📋" />
              <Card className="p-5 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">정렬</p>
                <button
                  onClick={() => setRealizedSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                  className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {realizedSortOrder === "desc" ? "최신순 ↓" : "오래된순 ↑"}
                </button>
              </Card>
            </div>

            {Object.keys(realizedGrouped).map((m) => (
              <Card key={m} className="overflow-hidden">
                <div className={`px-6 md:px-8 py-4 flex justify-between items-center border-b border-slate-800 ${
                  realizedGrouped[m].sub >= 0
                    ? "bg-gradient-to-r from-emerald-900/20 to-transparent"
                    : "bg-gradient-to-r from-rose-900/20 to-transparent"
                }`}>
                  <div>
                    <span className="font-black text-white tracking-widest">{m}</span>
                    <span className="text-[10px] text-slate-500 ml-3 font-mono">{realizedGrouped[m].items.length}건</span>
                  </div>
                  <span className={`font-black text-lg ${realizedGrouped[m].sub >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {pctSign(realizedGrouped[m].sub)}{fmt(realizedGrouped[m].sub)}원
                  </span>
                </div>
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-800/60">
                    {realizedGrouped[m].items.map((r, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 md:px-8 py-4 text-xs text-slate-500 font-mono whitespace-nowrap">{r.date.substring(5)}</td>
                        <td className="px-6 md:px-8 py-4 font-bold text-slate-200">
                          <div>{r.name}</div>
                          {r.note && <div className="text-[10px] text-slate-600 mt-0.5">{r.note}</div>}
                        </td>
                        <td className="px-6 md:px-8 py-4 text-center text-xs text-slate-500 font-mono hidden md:table-cell">
                          {r.qty > 0 && `${r.qty}주`}
                        </td>
                        <td className={`px-6 md:px-8 py-4 text-right font-black ${r.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          <div>{pctSign(r.profit)}{fmt(r.profit)}원</div>
                          {r.yieldRate !== 0 && (
                            <div className="text-[10px] opacity-60 mt-0.5">
                              {pctSign(r.yieldRate)}{r.yieldRate.toFixed(1)}%
                            </div>
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
                <p className="text-4xl mb-3">📋</p>
                <p className="font-bold">실현 손익 데이터가 없습니다</p>
                <p className="text-xs mt-1">구글 시트의 REALIZED 탭을 확인하세요</p>
              </div>
            )}
          </div>
        )}

        <footer className="text-center py-10 mt-8 border-t border-slate-900">
          <p className="text-slate-700 text-[10px] font-bold tracking-widest uppercase">
            Asset Master V2 · Google Sheets Powered · Auto-Refresh 60s
          </p>
          <p className="text-slate-800 text-[10px] mt-1">
            ⚠️ 이 도구는 참고용이며 투자 조언이 아닙니다
          </p>
        </footer>
      </div>
    </div>
  );
}
