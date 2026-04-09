"use client";

import React, { useState, useEffect } from 'react';

// --- 인터페이스 정의 ---
interface Stock { market: string; account: string; name: string; code: string; qty: number; avg: number; current: number; }
interface Asset { id: number; name: string; value: number; }
interface Debt { id: number; name: string; value: number; }
interface Saving { id: number; name: string; monthly: number; current: number; maturityDate: string; transferDay: number; interestRate: number; }
interface Realized { date: string; name: string; qty: number; profit: number; yieldRate: number; note: string; }

export default function AssetMasterV2() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isClient, setIsClient] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [targetDate, setTargetDate] = useState('2026-12-31');
  const [exchangeRate, setExchangeRate] = useState(1350);

  // --- 🔗 구글 시트 연동 링크 ---
  const STOCK_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";
  const REALIZED_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=817751922&single=true&output=csv";

  // --- 상태 관리 ---
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [realized, setRealized] = useState<Realized[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const [assets, setAssets] = useState<Asset[]>([{ id: 1, name: '힐스테이트 오피스텔', value: 250000000 }, { id: 2, name: '자동차', value: 35000000 }]);
  const [debts, setDebts] = useState<Debt[]>([{ id: 1, name: '마이너스 통장', value: 40000000 }]);
  const [savings, setSavings] = useState<Saving[]>([{ id: 1, name: "청년도약계좌", monthly: 700000, current: 8400000, maturityDate: '2028-06-25', transferDay: 25, interestRate: 6.0 }]);

  // --- 유틸리티 ---
  const cleanNum = (val: any) => parseFloat(val?.toString().replace(/[,"'원\s%]/g, '')) || 0;
  const formatComma = (num: number) => num.toLocaleString();

  useEffect(() => {
    setIsClient(true);
    const fetchAll = async () => {
      try {
        const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
        const rateData = await rateRes.json();
        if (rateData?.rates?.KRW) setExchangeRate(rateData.rates.KRW);

        const [sRes, rRes] = await Promise.all([
          fetch(`${STOCK_CSV_URL}&t=${Date.now()}`),
          fetch(`${REALIZED_CSV_URL}&t=${Date.now()}`)
        ]);

        const sText = await sRes.text();
        const sRows = sText.split('\n').map(r => r.trim()).filter(r => r);
        if (sRows.length >= 2) {
          const h = sRows[0].split(',').map(v => v.replace(/"/g, '').trim());
          const idx = { market: h.indexOf("구분"), account: h.indexOf("계좌"), name: h.indexOf("종목명"), qty: h.indexOf("수량"), avg: h.indexOf("평단"), cur: h.indexOf("현재가") };
          setStocks(sRows.slice(1).map(row => {
            const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
            return { market: c[idx.market], account: c[idx.account] || "기본계좌", name: c[idx.name], code: "", qty: cleanNum(c[idx.qty]), avg: cleanNum(c[idx.avg]), current: cleanNum(c[idx.cur]) };
          }).filter(s => s.qty > 0));
        }

        const rText = await rRes.text();
        const rRows = rText.split('\n').map(r => r.trim()).filter(r => r);
        setRealized(rRows.slice(1).map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
          return { date: c[0], name: c[1], qty: cleanNum(c[2]), profit: cleanNum(c[3]), yieldRate: cleanNum(c[4]), note: c[5] };
        }).filter(r => r.date));

        setLoading(false);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (e) { setLoading(false); }
    };
    fetchAll();
    const timer = setInterval(fetchAll, 60000);
    return () => clearInterval(timer);
  }, []);

  // --- 핵심 계산 로직 ---
  const domesticVal = stocks.filter(s => !s.market.includes('해외')).reduce((acc, s) => acc + (s.current * s.qty), 0);
  const overseasVal = stocks.filter(s => s.market.includes('해외')).reduce((acc, s) => acc + (s.current * exchangeRate * s.qty), 0);
  const totalStockVal = domesticVal + overseasVal;
  const totalOtherAssets = assets.reduce((acc, a) => acc + a.value, 0);
  const totalSavings = savings.reduce((acc, s) => acc + s.current, 0);
  const totalLiabilities = debts.reduce((acc, d) => acc + d.value, 0);
  const netWorth = totalStockVal + totalOtherAssets + totalSavings - totalLiabilities;

  // 미래 현금흐름 (이자 포함)
  const projectedSavings = savings.reduce((acc, s) => {
    const end = new Date(targetDate) > new Date(s.maturityDate) ? new Date(s.maturityDate) : new Date(targetDate);
    const months = Math.max(0, (end.getFullYear() - new Date().getFullYear()) * 12 + (end.getMonth() - new Date().getMonth()));
    const interest = (s.monthly * months * (months + 1) / 2) * (s.interestRate / 100 / 12);
    return acc + s.current + (s.monthly * months) + interest;
  }, 0);

  // 계좌별 그룹화
  const groupedStocks = stocks.reduce((acc: any, s) => {
    if (!acc[s.account]) acc[s.account] = { items: [], total: 0, profit: 0 };
    const val = s.current * (s.market.includes('해외') ? exchangeRate : 1) * s.qty;
    const inv = s.avg * (s.market.includes('해외') ? exchangeRate : 1) * s.qty;
    acc[s.account].items.push(s);
    acc[s.account].total += val;
    acc[s.account].profit += (val - inv);
    return acc;
  }, {});

  // 실현손익 월별 소계
  const realizedGrouped = realized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .reduce((acc: any, r) => {
      const m = r.date.substring(0, 7);
      if (!acc[m]) acc[m] = { items: [], sub: 0 };
      acc[m].items.push(r);
      acc[m].sub += r.profit;
      return acc;
    }, {});

  if (!isClient || loading) return <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white font-black text-2xl italic animate-pulse">SYSTEM BOOTING...</div>;

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex justify-between items-end border-b border-slate-800 pb-6">
          <h1 className="text-4xl font-black text-white italic tracking-tighter">ASSET MASTER V2</h1>
          <div className="bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 text-amber-500 font-mono text-xs">환율: {exchangeRate.toFixed(2)}</div>
        </header>

        <nav className="flex gap-2 mb-10 overflow-x-auto pb-2">
          {['overview', 'stocks', 'realestate', 'savings', 'realized'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-900 text-slate-500'}`}>
              {t === 'overview' ? '통합 요약' : t === 'stocks' ? '계좌별 주식' : t === 'realestate' ? '실물/부채' : t === 'savings' ? '예적금' : '실현 손익'}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 p-12 rounded-[50px] border border-blue-500/20 shadow-2xl">
              <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase mb-4 opacity-70">Current Net Worth</p>
              <h2 className="text-6xl font-black text-white tracking-tighter">{Math.round(netWorth).toLocaleString()}<span className="text-2xl font-light ml-2 opacity-30">KRW</span></h2>
            </div>
            <div className="bg-emerald-900/10 p-10 rounded-[50px] border border-emerald-900/30">
              <div className="flex justify-between items-center mb-8">
                <div><h3 className="text-xl font-black text-emerald-400 italic">Future CF Projection</h3></div>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="bg-slate-900 text-emerald-400 font-black p-3 rounded-2xl border border-emerald-900/50 outline-none" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-950/50 p-6 rounded-3xl text-center"><p className="text-[10px] text-slate-500 font-black uppercase mb-2">예상 누적 현금</p><p className="text-3xl font-black text-emerald-400">{Math.round(projectedSavings).toLocaleString()}</p></div>
                <div className="bg-slate-950/50 p-6 rounded-3xl text-center"><p className="text-[10px] text-slate-500 font-black uppercase mb-2">예상 미래 순자산</p><p className="text-3xl font-black text-white">{Math.round(totalStockVal + totalOtherAssets + projectedSavings - totalLiabilities).toLocaleString()}</p></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stocks' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-900/10 p-6 rounded-3xl border border-blue-900/30 text-center"><p className="text-[10px] font-black text-blue-400 mb-2">국내 주식 합계</p><p className="text-2xl font-black text-white">{domesticVal.toLocaleString()}</p></div>
              <div className="bg-amber-900/10 p-6 rounded-3xl border border-amber-900/30 text-center"><p className="text-[10px] font-black text-amber-500 mb-2">해외 주식 합계</p><p className="text-2xl font-black text-white">{Math.round(overseasVal).toLocaleString()}</p></div>
            </div>
            {Object.keys(groupedStocks).map(acc => (
              <div key={acc} className="bg-slate-900 rounded-[30px] border border-slate-800 overflow-hidden">
                <div className="px-8 py-5 bg-slate-800/40 border-b border-slate-800 flex justify-between items-center">
                  <span className="font-black text-white italic">💳 {acc}</span>
                  <span className="font-black text-white">{Math.round(groupedStocks[acc].total).toLocaleString()}원 <span className={`ml-2 text-xs ${groupedStocks[acc].profit >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>({Math.round(groupedStocks[acc].profit).toLocaleString()})</span></span>
                </div>
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-slate-800">
                    {groupedStocks[acc].items.map((s:any, i:number) => (
                      <tr key={i} className="hover:bg-white/[0.02]"><td className="px-8 py-5 font-bold text-slate-300">{s.name}</td><td className="px-8 py-5 text-center text-slate-500">{s.qty.toLocaleString()}주 / {s.avg.toLocaleString()}원</td><td className={`px-8 py-5 text-right font-black ${s.current >= s.avg ? 'text-rose-500' : 'text-blue-500'}`}>{(((s.current-s.avg)/s.avg)*100).toFixed(2)}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'savings' && (
          <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 animate-in fade-in duration-500 space-y-6">
            <div className="flex justify-between items-center"><h3 className="text-xl font-black text-white">예적금 시뮬레이터</h3><button onClick={() => setSavings([...savings, { id: Date.now(), name: '', monthly: 0, current: 0, maturityDate: '', transferDay: 1, interestRate: 0 }])} className="bg-emerald-600 px-4 py-2 rounded-full text-[10px] font-bold">+ 추가</button></div>
            {savings.map(s => (
              <div key={s.id} className="bg-[#0c0e12] p-6 rounded-3xl border border-slate-800 flex flex-col xl:flex-row gap-6">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <input type="text" value={s.name} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, name: e.target.value} : sv))} className="col-span-2 bg-transparent text-white font-bold border-b border-slate-700 outline-none" placeholder="상품명" />
                  <div><p className="text-[10px] text-slate-500 mb-1">월 납입액</p><input type="text" value={formatComma(s.monthly)} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, monthly: cleanNum(e.target.value)} : sv))} className="w-full bg-slate-900 text-white p-2 rounded-lg text-sm border border-slate-700" /></div>
                  <div><p className="text-[10px] text-slate-500 mb-1">현재 잔액</p><input type="text" value={formatComma(s.current)} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, current: cleanNum(e.target.value)} : sv))} className="w-full bg-slate-900 text-white p-2 rounded-lg text-sm border border-slate-700" /></div>
                </div>
                <div className="w-full xl:w-1/3 bg-emerald-900/10 p-6 rounded-2xl border border-emerald-900/30 text-right"><p className="text-xs text-slate-400 mb-1">만기 예상액</p><p className="text-3xl font-black text-white">{Math.round(s.current + (s.monthly * 12)).toLocaleString()}원</p></div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'realized' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             {Object.keys(realizedGrouped).map(m => (
               <div key={m} className="bg-slate-900 rounded-[30px] border border-slate-800 overflow-hidden">
                 <div className="px-8 py-4 bg-slate-800/40 flex justify-between items-center"><span className="font-black text-slate-400">{m} 결산 소계</span><span className={`font-black ${realizedGrouped[m].sub >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{Math.round(realizedGrouped[m].sub).toLocaleString()} 원</span></div>
                 <table className="w-full text-left">
                   <tbody className="divide-y divide-slate-800">
                     {realizedGrouped[m].items.map((r:any, i:number) => (
                       <tr key={i} className="hover:bg-white/[0.02]"><td className="px-8 py-4 text-xs text-slate-500">{r.date}</td><td className="px-8 py-4 font-bold">{r.name}</td><td className={`px-8 py-4 text-right font-black ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{Math.round(r.profit).toLocaleString()}원</td></tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
