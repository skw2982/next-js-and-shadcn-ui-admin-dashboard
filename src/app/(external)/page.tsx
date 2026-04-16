"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ═══════════════════════════════════════════
// ☁️ 클라우드 저장소(Vercel KV) 연결 정보
// ═══════════════════════════════════════════
const KV_URL = "https://chief-jay-84148.upstash.io"; 
const KV_TOKEN = "gQAAAAAAUUI0AAIncDE5MmI4ZmFkNGQwN2E0NTNmYjAwY2ExNGQ1YzI1MTI3OHAxODQxNDg";

const BASE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?";

const GIDS = {
  STOCKS: "0",          
  REALIZED: "817751922",   
  ASSETS: "1398634207", 
  DEBTS: "359303564",  
  SAVINGS: "380349145" 
};

interface Stock { market: string; account: string; name: string; qty: number; avg: number; current: number; dailyChange: number; }
interface Asset { id: number; name: string; value: number; }
interface Debt { id: number; name: string; value: number; }
interface Saving { id: number; name: string; monthly: number; current: number; maturityDate: string; transferDay: number; interestRate: number; }
interface Realized { date: string; name: string; qty: number; profit: number; yieldRate: number; note: string; }

type TabKey = "overview" | "stocks" | "realestate" | "savings" | "realized" | "simulation";

const TABS: { key: TabKey; label: string; num: string }[] = [
  { key: "overview", label: "통합 요약", num: "1" },
  { key: "stocks", label: "계좌별 주식", num: "2" },
  { key: "realestate", label: "실물 / 부채", num: "3" },
  { key: "savings", label: "예적금", num: "4" },
  { key: "realized", label: "실현 손익", num: "5" },
  { key: "simulation", label: "🎯 목표가 시뮬레이션", num: "6" },
];

const cleanNum = (val: unknown): number => {
  if (val == null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.\-]+/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const fmt = (num: number): string => Math.round(num).toLocaleString("ko-KR");
const fmtDecimal = (num: number): string => {
  if (!num) return "0";
  return num.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
};

const fmtShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e8) return (n / 1e8).toFixed(1) + "억";
  if (abs >= 1e4) return (n / 1e4).toFixed(0) + "만";
  return fmt(n);
};

const pctColor = (v: number) => (v >= 0 ? "text-rose-500" : "text-blue-500");
const pctSign = (v: number) => (v >= 0 ? "+" : "");

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

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm shadow-xl">
      <p className="text-white font-bold">{payload[0]?.name || label}</p>
      <p className="text-slate-400">{fmt(payload[0]?.value)}원</p>
    </div>
  );
};

export default function AssetMasterV3_6() {
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
  
  const [targetPrices, setTargetPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    setIsClient(true);
    const loadCloudData = async () => {
      try {
        const res = await fetch(`${KV_URL}/get/user_targets`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const data = await res.json();
        if (data.result) {
          setTargetPrices(typeof data.result === 'string' ? JSON.parse(data.result) : data.result);
        }
      } catch (e) { console.error("Cloud 로딩 실패:", e); }
    };
    loadCloudData();
  }, []);

  const saveToCloud = async (newTargets: Record<string, number>) => {
    try {
      await fetch(`${KV_URL}/set/user_targets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        body: JSON.stringify(newTargets)
      });
    } catch (e) { console.error("Cloud 저장 실패:", e); }
  };

  const handleTargetChange = (name: string, val: string) => {
    let newTargets = { ...targetPrices };
    if (val === "") {
      delete newTargets[name];
    } else {
      newTargets[name] = cleanNum(val);
    }
    setTargetPrices(newTargets);
    saveToCloud(newTargets);
  };

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
        fetchCSV(GIDS.STOCKS), fetchCSV(GIDS.REALIZED), fetchCSV(GIDS.ASSETS), fetchCSV(GIDS.DEBTS), fetchCSV(GIDS.SAVINGS)
      ]);

      const parseRow = (row: string) => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/"/g, "").trim());

      setStocks(sRows.map(row => {
        const c = parseRow(row);
        return { market: c[0] || "국내", account: c[1] || "미분류", name: c[2] || "알 수 없음", avg: cleanNum(c[5]), current: cleanNum(c[6]), qty: cleanNum(c[7]), dailyChange: cleanNum(c[8]) };
      }).filter(s => s.qty > 0));

      setRealized(rRows.map(row => {
        const c = parseRow(row);
        return { date: c[0], name: c[1], qty: cleanNum(c[2]), profit: cleanNum(c[3]), yieldRate: cleanNum(c[4]), note: c[5] };
      }));

      setAssets(aRows.map((row, i) => {
        const c = parseRow(row);
        return { id: i, name: c[0] || "자산", value: cleanNum(c[1]) };
      }));

      setDebts(dRows.map((row, i) => {
        const c = parseRow(row);
        return { id: i, name: c[0] || "부채", value: cleanNum(c[1]) };
      }));

      setSavings(svRows.map((row, i) => {
        const c = parseRow(row);
        return { id: i, name: c[0] || "적금", monthly: cleanNum(c[1]), current: cleanNum(c[2]), maturityDate: c[3] || "2026-12-31", transferDay: cleanNum(c[4]), interestRate: cleanNum(c[5]) };
      }));

      setLastUpdated(new Date().toLocaleTimeString("ko-KR"));
      setLoading(false);
    } catch (e) { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAllData();
    const timer = setInterval(fetchAllData, 60000);
    return () => clearInterval(timer);
  }, [fetchAllData]);

  const grouped = useMemo(() => {
    const acc: Record<string, { items: Stock[]; total: number; profit: number; dailyProfit: number }> = {};
    stocks.forEach((s) => {
      if (!acc[s.account]) acc[s.account] = { items: [], total: 0, profit: 0, dailyProfit: 0 };
      const isOS = s.market.includes("해외");
      const rate = isOS ? exchangeRate : 1;
      acc[s.account].items.push(s);
      acc[s.account].total += s.current * rate * s.qty;
      acc[s.account].profit += (s.current - s.avg) * rate * s.qty;
      acc[s.account].dailyProfit += s.dailyChange * rate * s.qty;
    });
    return acc;
  }, [stocks, exchangeRate]);

  const totalDailyProfit = useMemo(() => Object.values(grouped).reduce((a, b) => a + b.dailyProfit, 0), [grouped]);
  const totalStockVal = useMemo(() => stocks.reduce((a, b) => a + b.current * (b.market.includes("해외") ? exchangeRate : 1) * b.qty, 0), [stocks, exchangeRate]);
  const totalAssetsVal = assets.reduce((a, b) => a + b.value, 0);
  const totalSavingsVal = savings.reduce((a, b) => a + b.current, 0);
  const totalDebtsVal = debts.reduce((a, b) => a + b.value, 0);
  const netWorth = totalStockVal + totalAssetsVal + totalSavingsVal - totalDebtsVal;

  const compositionData = useMemo(() => [
    { name: "주식", value: Math.round(totalStockVal), color: "#6366f1" },
    { name: "실물 자산", value: Math.round(totalAssetsVal), color: "#06b6d4" },
    { name: "예적금", value: Math.round(totalSavingsVal), color: "#10b981" },
  ].filter(d => d.value > 0), [totalStockVal, totalAssetsVal, totalSavingsVal]);

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
      const fInt = (s.monthly * months * (months + 1)) / 2 * (s.interestRate / 100 / 12);
      return acc + principal + cInt + fInt;
    }, 0);
    return totalStockVal + totalAssetsVal + ps - totalDebtsVal;
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

  // 🚨 목표가 시뮬레이터 연산 (종목 통합 + 최종 수익 계산)
  const simulationData = useMemo(() => {
    let currentKrwTotal = 0;
    let targetKrwTotal = 0;
    let totalCostKrw = 0;

    const aggMap: Record<string, { name: string; qty: number; current: number; avg: number; isOS: boolean; rate: number; totalCost: number; }> = {};
    
    stocks.forEach(s => {
      const isOS = s.market.includes("해외");
      const rate = isOS ? exchangeRate : 1;
      if (!aggMap[s.name]) {
        aggMap[s.name] = { 
          name: s.name, 
          qty: 0, 
          current: s.current, 
          avg: 0, // 가중평균을 위해 아래에서 합산 후 계산
          isOS, 
          rate,
          totalCost: 0 
        };
      }
      aggMap[s.name].qty += s.qty;
      aggMap[s.name].totalCost += (s.avg * s.qty * rate); // 환율 적용된 총 매수 비용
    });

    const items = Object.values(aggMap).map(item => {
      const currentKrw = item.current * item.rate * item.qty;
      currentKrwTotal += currentKrw;
      totalCostKrw += item.totalCost;

      const target = targetPrices[item.name] || item.current;
      const targetKrw = target * item.rate * item.qty;
      targetKrwTotal += targetKrw;

      const diffPct = item.current > 0 ? ((target - item.current) / item.current) * 100 : 0;
      const expectedExtraProfit = targetKrw - currentKrw;
      
      // 최종 수익 (목표 평가액 - 총 매수 원금)
      const finalProfit = targetKrw - item.totalCost;
      const finalYield = item.totalCost > 0 ? (finalProfit / item.totalCost) * 100 : 0;

      return { ...item, target, diffPct, expectedExtraProfit, finalProfit, finalYield, currentKrw, targetKrw };
    }).sort((a, b) => b.currentKrw - a.currentKrw);

    return { 
      items, 
      currentKrwTotal, 
      targetKrwTotal, 
      expectedExtraProfit: targetKrwTotal - currentKrwTotal,
      totalProfitAtTarget: targetKrwTotal - totalCostKrw
    };
  }, [stocks, targetPrices, exchangeRate]);

  if (!isClient) return <div className="min-h-screen bg-[#0c0e12]" />;

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-wrap justify-between items-end border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter">ASSET MASTER V3.6</h1>
            <p className="text-slate-500 text-[10px] font-bold tracking-[0.3em] uppercase mt-1">LG MDI Accounting · {lastUpdated}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchAllData} disabled={loading} className={`text-[10px] px-3 py-2 rounded-xl font-bold transition-all ${loading ? "bg-blue-600 text-white animate-pulse" : "text-slate-400 bg-slate-800 hover:bg-slate-700"}`}>
              {loading ? "🔄 동기화 중..." : "↻ 새로고침"}
            </button>
            <div className="text-[10px] text-amber-500 font-mono bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 font-bold">USD/KRW: {fmtDecimal(exchangeRate)}</div>
          </div>
        </header>

        <nav className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === t.key ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-slate-900 text-slate-500 hover:text-slate-300"}`}>
              {t.num}. {t.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 p-12 rounded-[50px] border border-blue-500/20 shadow-2xl flex justify-between items-center flex-wrap gap-8">
              <div>
                <p className="text-blue-400 text-[10px] font-black uppercase mb-4 opacity-70">Current Net Worth</p>
                <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">{fmt(netWorth)}<span className="text-2xl font-light ml-2 opacity-30">KRW</span></h2>
              </div>
              <div className="text-right bg-white/5 p-6 rounded-3xl border border-white/10">
                <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Today's P&L</p>
                <p className={`text-3xl font-black ${pctColor(totalDailyProfit)}`}>{pctSign(totalDailyProfit)}{fmt(totalDailyProfit)} 원</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="주식 평가액" value={`${fmtShort(totalStockVal)}원`} />
              <StatCard label="기타 자산" value={`${fmtShort(totalAssetsVal)}원`} />
              <StatCard label="예적금 현고" value={`${fmtShort(totalSavingsVal)}원`} />
              <StatCard label="부채 총계" value={`${fmtShort(totalDebtsVal)}원`} variant="danger" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-4">자산 구성 비중</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={compositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {compositionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={(val) => <span className="text-slate-400 text-xs">{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <div className="bg-emerald-900/10 p-10 rounded-[50px] border border-emerald-900/30">
                <div className="flex justify-between items-center mb-8 gap-4">
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

        {activeTab === "stocks" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {Object.keys(grouped).map((acc) => (
              <Card key={acc} className="overflow-hidden">
                <div className="px-8 py-5 bg-slate-800/40 border-b border-slate-800 flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <span className="font-black text-white italic text-lg">💳 {acc}</span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${grouped[acc].dailyProfit >= 0 ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"}`}>
                      오늘 {pctSign(grouped[acc].dailyProfit)}{fmt(grouped[acc].dailyProfit)}원
                    </span>
                  </div>
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
                        <th className="px-8 py-4 text-right">오늘 변동 / 누적 손익</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {grouped[acc].items.map((s, i) => {
                        const isOS = s.market.includes("해외");
                        const rate = isOS ? exchangeRate : 1;
                        const yR = s.avg > 0 ? ((s.current - s.avg) / s.avg) * 100 : 0;
                        const profKrw = (s.current - s.avg) * rate * s.qty;
                        const dProfKrw = s.dailyChange * rate * s.qty;
                        return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-8 py-5 font-bold text-slate-200">{s.name}<div className="text-[10px] font-medium text-slate-500 mt-1">{isOS ? "해외" : "국내"}</div></td>
                            <td className="px-8 py-5 text-center text-slate-500 font-mono text-xs">{fmt(s.qty)}주 / {isOS ? `$${fmtDecimal(s.avg)}` : `${fmt(s.avg)}원`}</td>
                            <td className="px-8 py-5 text-right font-black">
                              <div className={`text-sm ${pctColor(dProfKrw)}`}>{pctSign(dProfKrw)}{fmt(dProfKrw)}원</div>
                              <div className={`text-[10px] opacity-60 ${pctColor(profKrw)}`}>{pctSign(profKrw)}{fmt(profKrw)}원 ({yR.toFixed(1)}%)</div>
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

        {activeTab === "savings" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {savings.map((s) => {
              const maturity = new Date(s.maturityDate);
              const now = new Date();
              const mLeft = Math.max(0, (maturity.getFullYear() - now.getFullYear()) * 12 + (maturity.getMonth() - now.getMonth()));
              const fPrincipal = s.current + s.monthly * mLeft;
              const cInt = s.current * (s.interestRate / 100) * (mLeft / 12);
              const fInt = (s.monthly * mLeft * (mLeft + 1)) / 2 * (s.interestRate / 100 / 12);
              const fVal = fPrincipal + cInt + fInt;
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

        {activeTab === "realized" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {Object.keys(realizedGrouped).map((m) => (
              <Card key={m} className="overflow-hidden">
                <div className="px-8 py-5 bg-slate-800/40 flex justify-between items-center border-b border-slate-800">
                  <span className="font-black text-slate-300">{m} 결산 소계</span>
                  <span className={`font-black text-lg ${pctColor(realizedGrouped[m].sub)}`}>{pctSign(realizedGrouped[m].sub)}{fmt(realizedGrouped[m].sub)} 원</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-800">
                      {realizedGrouped[m].items.map((r, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="px-8 py-4 text-xs text-slate-500 font-mono">{r.date}</td>
                          <td className="px-8 py-4 font-bold text-slate-200">
                            {r.name}
                            <span className="ml-2 text-xs text-slate-400">({fmt(r.qty)}주)</span>
                            <span className="ml-2 text-[10px] text-slate-600 font-normal">{r.note}</span>
                          </td>
                          <td className={`px-8 py-4 text-right font-black ${pctColor(r.profit)}`}>{pctSign(r.profit)}{fmt(r.profit)}원</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 🎯 목표가 시뮬레이션 V3.6 (최종 수익 로직 추가) */}
        {activeTab === "simulation" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-8 rounded-[40px] border border-indigo-500/20 shadow-xl">
                <p className="text-indigo-400 text-[10px] font-black uppercase mb-2">목표 달성 시 주식 평가액</p>
                <h2 className="text-4xl font-black text-white">{fmt(simulationData.targetKrwTotal)} 원</h2>
                <p className="text-xs text-slate-500 mt-2">현재가 대비 +{fmt(simulationData.expectedExtraProfit)} 원 추가 상승 기대</p>
              </div>
              <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 p-8 rounded-[40px] border border-emerald-500/20 shadow-xl">
                <p className="text-emerald-400 text-[10px] font-black uppercase mb-2">목표 달성 시 총 손익 (누적)</p>
                <h2 className="text-4xl font-black text-white">{pctSign(simulationData.totalProfitAtTarget)}{fmt(simulationData.totalProfitAtTarget)} 원</h2>
                <p className="text-xs text-slate-500 mt-2">매수 원금 대비 모든 종목 목표가 도달 시 결과</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulationData.items.map((item, i) => (
                <Card key={i} className="p-6 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-black text-white">{item.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">보유: {fmt(item.qty)}주 | 현재가: {item.isOS ? `$${fmtDecimal(item.current)}` : `${fmt(item.current)}원`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-black uppercase mb-1">목표가 {item.isOS ? "(USD)" : "(KRW)"}</p>
                      <input 
                        type="text" 
                        value={targetPrices[item.name] ? fmtDecimal(targetPrices[item.name]) : ""} 
                        onChange={(e) => handleTargetChange(item.name, e.target.value)}
                        placeholder={fmtDecimal(item.current)}
                        className="w-28 bg-slate-950 text-white font-bold p-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 text-right transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase mb-1">상승 여력</p>
                      <p className={`font-black text-sm ${item.diffPct >= 0 ? "text-rose-400" : "text-blue-400"}`}>
                        {item.diffPct >= 0 ? "▲" : "▼"} {Math.abs(item.diffPct).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase mb-1">추가 수익금</p>
                      <p className={`font-black text-sm ${item.expectedProfit >= 0 ? "text-rose-400" : "text-blue-400"}`}>
                        +{fmt(item.expectedProfit)}원
                      </p>
                    </div>
                  </div>

                  <div className="bg-indigo-900/10 p-5 rounded-2xl border border-indigo-500/20 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-indigo-400 font-black uppercase">목표가 달성 시 최종 수익</p>
                      <p className={`text-xl font-black ${pctColor(item.finalProfit)}`}>
                        {pctSign(item.finalProfit)}{fmt(item.finalProfit)} 원
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-indigo-400 font-black uppercase">예상 수익률</p>
                      <p className={`text-xl font-black ${pctColor(item.finalYield)}`}>
                        {pctSign(item.finalYield)}{item.finalYield.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <p className="text-center text-slate-600 text-[10px] mt-4">💰 최종 수익은 여러 계좌의 평단가를 가중평균하여 산출한 매수 원금 대비 결과입니다.</p>
          </div>
        )}

        <footer className="mt-20 py-8 border-t border-slate-900 text-center">
          <p className="text-slate-700 text-[10px] font-black tracking-widest uppercase">Asset Master V3.6 · Powered by Vercel KV · LG MDI Accounting</p>
        </footer>
      </div>
    </div>
  );
}