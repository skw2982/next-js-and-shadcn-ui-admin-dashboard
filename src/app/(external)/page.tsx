"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

// ═══════════════════════════════════════════
// 🛠️ 여기에 경원님의 시트 GID 번호를 입력하세요!
// ═══════════════════════════════════════════
const BASE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?";

const GIDS = {
  STOCKS: "0",          // 2번 탭: 주식 현황
  REALIZED: "817751922",   // 5번 탭: 실현 손익
  ASSETS: "1398634207", // 3번 탭: 실물자산 GID
  DEBTS: "359303564",  // 3번 탭: 부채 GID
  SAVINGS: "380349145" // 4번 탭: 예적금 GID
};

// ═══════════════════════════════════════════
// Types & Config
// ═══════════════════════════════════════════
interface Stock { market: string; account: string; name: string; qty: number; avg: number; current: number; }
interface Asset { id: number; name: string; value: number; }
interface Debt { id: number; name: string; value: number; }
interface Saving { id: number; name: string; monthly: number; current: number; maturityDate: string; transferDay: number; interestRate: number; }
interface Realized { date: string; name: string; qty: number; profit: number; yieldRate: number; note: string; }

type TabKey = "overview" | "stocks" | "realestate" | "savings" | "realized";

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
const parseCSVRow = (row: string): string[] => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/"/g, "").trim());

// ═══════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════
function Card({ children, className = "" }: { children: React.ReactNode; className?: string; }) {
  return <div className={`bg-slate-900 rounded-[30px] border border-slate-800 shadow-xl ${className}`}>{children}</div>;
}

function StatCard({ label, value, sub, variant = "default" }: { label: string; value: string; sub?: string; variant?: "default" | "danger" | "success"; }) {
  const colorMap = { default: "bg-slate-900 border-slate-800", danger: "bg-rose-900/20 border-rose-900/50", success: "bg-emerald-900/20 border-emerald-900/50" };
  const textMap = { default: "text-white", danger: "text-rose-400", success: "text-emerald-400" };
  const labelMap = { default: "text-slate-500", danger: "text-rose-400/70", success: "text-emerald-400/70" };
  return (
    <div className={`p-6 rounded-3xl border ${colorMap[variant]}`}>
      <p className={`text-[10px] font-black uppercase mb-1 ${labelMap[variant]}`}>{label}</p>
      <p className={`text-xl font-bold ${textMap[variant]}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 opacity-70 ${textMap[variant]}`}>{sub}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════
export default function AssetMasterV2() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1350);
  const [targetDate, setTargetDate] = useState("2026-12-31");

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
      return text.split("\n").map(r => r.trim()).filter(Boolean).slice(1);
    } catch { return []; }
  };

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const rateRes = await fetch("https://open.er-api.com/v6/latest/USD");
      if (rateRes.ok) {
        const rateData = await rateRes.json();
        if (rateData?.rates?.KRW) setExchangeRate(rateData.rates.KRW);
      }

      const [sRows, rRows, aRows, dRows, svRows] = await Promise.all([
        fetchCSV(GIDS.STOCKS),
        fetchCSV(GIDS.REALIZED),
        fetchCSV(GIDS.ASSETS),
        fetchCSV(GIDS.DEBTS),
        fetchCSV(GIDS.SAVINGS)
      ]);

      setStocks(sRows.map(row => {
        const c = parseCSVRow(row);
        return { market: c[0] || "국내", account: c[1] || "미분류", name: c[2] || "알 수 없음", avg: cleanNum(c[5]), current: cleanNum(c[6]), qty: cleanNum(c[7]) };
      }).filter(s => s.qty > 0));

      setRealized(rRows.map(row => {
        const c = parseCSVRow(row);
        return { date: c[0], name: c[1], qty: cleanNum(c[2]), profit: cleanNum(c[3]), yieldRate: cleanNum(c[4]), note: c[5] };
      }));

      setAssets(aRows.map((row, i) => {
        const c = parseCSVRow(row);
        return { id: i, name: c[0] || "자산", value: cleanNum(c[1]) };
      }));

      setDebts(dRows.map((row, i) => {
        const c = parseCSVRow(row);
        return { id: i, name: c[0] || "부채", value: cleanNum(c[1]) };
      }));

      setSavings(svRows.map((row, i) => {
        const c = parseCSVRow(row);
        return { id: i, name: c[0] || "적금", monthly: cleanNum(c[1]), current: cleanNum(c[2]), maturityDate: c[3] || "2026-12-31", transferDay: cleanNum(c[4]), interestRate: cleanNum(c[5]) };
      }));

      setLastUpdated(new Date().toLocaleTimeString("ko-KR"));
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    fetchAllData();
    const timer = setInterval(fetchAllData, 60000);
    return () => clearInterval(timer);
  }, [fetchAllData]);

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
  const totalAssetsVal = assets.reduce((a, b) => a + b.value, 0);
  const totalSavingsVal = savings.reduce((a, b) => a + b.current, 0);
  const totalDebtsVal = debts.reduce((a, b) => a + b.value, 0);
  const netWorth = totalStockVal + totalAssetsVal + totalSavingsVal - totalDebtsVal;

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

  const compositionData = useMemo(() => {
    return [
      { name: "주식", value: Math.round(totalStockVal), color: "#6366f1" },
      { name: "실물 자산", value: Math.round(totalAssetsVal), color: "#06b6d4" },
      { name: "예적금", value: Math.round(totalSavingsVal), color: "#10b981" },
    ].filter((d) => d.value > 0);
  }, [totalStockVal, totalAssetsVal, totalSavingsVal]);

  const projectedNetWorth = useMemo(() => {
    const target = new Date(targetDate);
    const now = new Date();
    const projectedSavings = savings.reduce((acc, s) => {
      const maturity = new Date(s.maturityDate || targetDate);
      const end = target > maturity ? maturity : target;
      if (end <= now) return acc + s.current;
      const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
      const principal = s.current + s.monthly * Math.max(0, months);
      const interest = (s.monthly * months * (months + 1)) / 2 * (s.interestRate / 100 / 12);
      return acc + principal + interest;
    }, 0);
    return totalStockVal + totalAssetsVal + projectedSavings - totalDebtsVal;
  }, [targetDate, savings, totalStockVal, totalAssetsVal, totalDebtsVal]);

  const realizedGrouped = useMemo(() => {
    const sorted = [...realized].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const acc: Record<string, { items: Realized[]; sub: number }> = {};
    sorted.forEach((r) => {
      const m = r.date.substring(0, 7);
      if (!acc[m]) acc[m] = { items: [], sub: 0 };
      acc[m].items.push(r);
      acc[m].sub += r.profit;
    });
    return acc;
  }, [realized]);

  if (!isClient) return <div className="min-h-screen bg-[#0c0e12]" />;
  if (loading && stocks.length === 0) return <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white font-black animate-pulse">SYNCING WITH GOOGLE SHEETS...</div>;

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-wrap justify-between items-end border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter">ASSET MASTER V2</h1>
            <p className="text-slate-500 text-[10px] font-bold tracking-[0.3em] uppercase mt-1">Real-time G-Sheet Sync · LG MDI Accounting Dept</p>
          </div>
          <div className="text-right flex items-center gap-3">
            {lastUpdated && <span className="text-[10px] text-slate-600 font-mono">Synced {lastUpdated}</span>}
            <button onClick={fetchAllData} className="text-[10px] text-slate-400 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl font-bold transition-colors">↻ 새로고침</button>
            <div className="text-[10px] text-amber-500 font-mono bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 font-bold">USD/KRW: {exchangeRate.toFixed(2)}</div>
          </div>
        </header>

        {/* Tabs */}
        <nav className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === t.key ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-800"}`}>
              {t.num}. {t.label}
            </button>
          ))}
        </nav>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 p-12 rounded-[50px] border border-blue-500/20 shadow-2xl">
              <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase mb-4 opacity-70">Current Net Worth</p>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">{fmt(netWorth)}<span className="text-2xl font-light ml-2 opacity-30">KRW</span></h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="주식 평가액" value={`${fmtShort(totalStockVal)}원`} />
              <StatCard label="기타 자산" value={`${fmtShort(totalAssetsVal)}원`} />
              <StatCard label="예적금 현고" value={`${fmtShort(totalSavingsVal)}원`} />
              <StatCard label="부채 총계" value={`${fmtShort(totalDebtsVal)}원`} variant="danger" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">자산 구성 비중</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={compositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {compositionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend formatter={(val) => <span className="text-slate-400 text-xs">{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <div className="bg-emerald-900/10 p-10 rounded-[50px] border border-emerald-900/30">
                <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                  <h3 className="text-xl font-black text-emerald-400 italic">Future Projection</h3>
                  <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="bg-slate-900 text-emerald-400 font-black p-3 rounded-2xl border border-emerald-900/50 outline-none" />
                </div>
                <div className="bg-slate-950/50 p-6 rounded-3xl text-center">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-2">예상 미래 순자산</p>
                  <p className="text-3xl font-black text-white">{fmt(projectedNetWorth)} 원</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STOCKS */}
        {activeTab === "stocks" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {Object.keys(grouped).map((acc) => (
              <Card key={acc} className="overflow-hidden">
                <div className="px-8 py-5 bg-slate-800/40 border-b border-slate-800 flex justify-between items-center">
                  <span className="font-black text-white italic tracking-tight text-lg">💳 {acc}</span>
                  <div className="text-right">
                    <span className="text-white font-black text-lg">{fmt(grouped[acc].total)}원</span>
                    <span className={`ml-3 text-sm font-bold ${pctColor(grouped[acc].profit)}`}>{pctSign(grouped[acc].profit)}{fmt(grouped[acc].profit)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-black uppercase border-b border-slate-800">
                        <th className="px-8 py-4">종목명</th>
                        <th className="px-8 py-4 text-center">수량 / 평단</th>
                        <th className="px-8 py-4 text-right">수익률 / 원화손익</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {grouped[acc].items.map((s, i) => {
                        const isOS = s.market.includes("해외");
                        const rate = isOS ? exchangeRate : 1;
                        const yR = s.avg > 0 ? ((s.current - s.avg) / s.avg) * 100 : 0;
                        const profKrw = (s.current - s.avg) * rate * s.qty;
                        return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-8 py-5 font-bold text-slate-200">{s.name}</td>
                            <td className="px-8 py-5 text-center text-slate-500 font-mono text-xs">{s.qty}주 / {isOS ? `$${s.avg}` : `${fmt(s.avg)}원`}</td>
                            <td className={`px-8 py-5 text-right font-black ${pctColor(yR)}`}>
                              <div className="text-sm">{pctArrow(yR)} {yR.toFixed(2)}%</div>
                              <div className="text-[10px] opacity-60">{pctSign(profKrw)}{fmt(profKrw)}원</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 3: REAL ASSETS & DEBTS */}
        {activeTab === "realestate" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <Card className="p-8">
              <h3 className="text-xl font-black text-white italic mb-6">Real Assets (Synced)</h3>
              <div className="space-y-3">
                {assets.map(a => (
                  <div key={a.id} className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <span className="font-bold text-slate-300">{a.name}</span>
                    <span className="font-black text-blue-400">{fmt(a.value)}원</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-8 border-rose-900/30 bg-rose-900/10">
              <h3 className="text-xl font-black text-rose-400 italic mb-6">Liabilities (Synced)</h3>
              <div className="space-y-3">
                {debts.map(d => (
                  <div key={d.id} className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-rose-900/20">
                    <span className="font-bold text-slate-300">{d.name}</span>
                    <span className="font-black text-rose-400">{fmt(d.value)}원</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: SAVINGS */}
        {activeTab === "savings" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {savings.map((s) => {
              const maturity = new Date(s.maturityDate);
              const now = new Date();
              const mLeft = Math.max(0, (maturity.getFullYear() - now.getFullYear()) * 12 + (maturity.getMonth() - now.getMonth()));
              const fPrincipal = s.current + s.monthly * mLeft;
              const fInterest = (s.monthly * mLeft * (mLeft + 1)) / 2 * (s.interestRate / 100 / 12);
              const fVal = fPrincipal + fInterest;
              return (
                <Card key={s.id} className="p-6">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4">
                    <h3 className="text-xl font-black text-white italic">{s.name}</h3>
                    <span className="text-emerald-400 font-mono text-sm">만기까지 {mLeft}개월</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div><p className="text-[10px] text-slate-500 uppercase">월 납입</p><p className="font-bold">{fmt(s.monthly)}원</p></div>
                    <div><p className="text-[10px] text-slate-500 uppercase">현재 잔액</p><p className="font-bold">{fmt(s.current)}원</p></div>
                    <div><p className="text-[10px] text-slate-500 uppercase">금리</p><p className="font-bold text-emerald-400">{s.interestRate}%</p></div>
                    <div className="bg-emerald-900/10 p-4 rounded-2xl">
                      <p className="text-[10px] text-emerald-400 uppercase font-black">만기 예상액</p>
                      <p className="text-xl font-black">{fmt(fVal)}원</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* TAB 5: REALIZED P&L */}
        {activeTab === "realized" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {Object.keys(realizedGrouped).map((m) => (
              <Card key={m} className="overflow-hidden">
                <div className="px-8 py-5 bg-slate-800/40 flex justify-between items-center border-b border-slate-800">
                  <span className="font-black text-slate-300">{m} 결산 소계</span>
                  <span className={`font-black text-lg ${pctColor(realizedGrouped[m].sub)}`}>{pctSign(realizedGrouped[m].sub)}{fmt(realizedGrouped[m].sub)} 원</span>
                </div>
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-800">
                    {realizedGrouped[m].items.map((r, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-8 py-4 text-xs text-slate-500 font-mono">{r.date}</td>
                        <td className="px-8 py-4 font-bold text-slate-200">{r.name}</td>
                        <td className={`px-8 py-4 text-right font-black ${pctColor(r.profit)}`}>{pctSign(r.profit)}{fmt(r.profit)}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
