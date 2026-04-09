"use client";

import React, { useState, useEffect } from 'react';

// --- 인터페이스 정의 ---
interface Stock { market: string; account: string; name: string; qty: number; avg: number; current: number; }
interface Asset { id: number; name: string; value: number; }
interface Debt { id: number; name: string; value: number; }
interface Saving { id: number; name: string; monthly: number; current: number; maturityDate: string; transferDay: number; interestRate: number; }
interface Realized { date: string; name: string; qty: number; profit: number; yieldRate: number; note: string; }

export default function AssetMasterFinalV2() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isClient, setIsClient] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [realizedSortOrder, setRealizedSortOrder] = useState<'desc' | 'asc'>('desc');
  const [targetDate, setTargetDate] = useState('2026-12-31');
  const [exchangeRate, setExchangeRate] = useState(1350);

  const STOCK_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";
  const REALIZED_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=817751922&single=true&output=csv";

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [realized, setRealized] = useState<Realized[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const [assets, setAssets] = useState<Asset[]>([{ id: 1, name: '힐스테이트 오피스텔', value: 250000000 }, { id: 2, name: '자동차', value: 35000000 }]);
  const [debts, setDebts] = useState<Debt[]>([{ id: 1, name: '마이너스 통장', value: 40000000 }]);
  const [savings, setSavings] = useState<Saving[]>([{ id: 1, name: "청년도약계좌", monthly: 700000, current: 8400000, maturityDate: '2028-06-25', transferDay: 25, interestRate: 6.0 }]);

  const cleanNum = (val: any) => {
    if (!val) return 0;
    const n = parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const formatComma = (num: number) => Math.round(num).toLocaleString();

  const fetchAllData = async () => {
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
        // A:구분(0), B:계좌(1), C:종목명(2), F:평단(5), G:현재가(6), H:수량(7)
        setStocks(sRows.slice(1).map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
          return {
            market: c[0] || "국내",
            account: c[1] || "미분류",
            name: c[2] || "알 수 없음",
            avg: cleanNum(c[5]),
            current: cleanNum(c[6]),
            qty: cleanNum(c[7])
          };
        }).filter(s => s.qty > 0));
      }

      const rText = await rRes.text();
      const rRows = rText.split('\n').map(r => r.trim()).filter(r => r);
      if (rRows.length >= 2) {
        setRealized(rRows.slice(1).map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
          return { date: c[0], name: c[1], qty: cleanNum(c[2]), profit: cleanNum(c[3]), yieldRate: cleanNum(c[4]), note: c[5] };
        }).filter(r => r.date));
      }

      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) { setLoading(false); }
  };

  useEffect(() => {
    setIsClient(true);
    fetchAllData();
    const timer = setInterval(fetchAllData, 60000);
    return () => clearInterval(timer);
  }, []);

  const getStockSummary = () => {
    let domVal = 0, domInv = 0, osVal = 0, osInv = 0;
    stocks.forEach(s => {
      const isOS = s.market.includes('해외');
      const rate = isOS ? exchangeRate : 1;
      if (isOS) {
        osVal += s.current * rate * s.qty;
        osInv += s.avg * rate * s.qty;
      } else {
        domVal += s.current * s.qty;
        domInv += s.avg * s.qty;
      }
    });
    const domProfit = domVal - domInv;
    const osProfit = osVal - osInv;
    return { 
      dom: { val: domVal, p: domProfit, y: domInv > 0 ? (domProfit/domInv*100) : 0 },
      os: { val: osVal, p: osProfit, y: osInv > 0 ? (osProfit/osInv*100) : 0 }
    };
  };

  const summ = getStockSummary();
  const totalStockVal = summ.dom.val + summ.os.val;
  const netWorth = totalStockVal + assets.reduce((a, b) => a + b.value, 0) + savings.reduce((a, b) => a + b.current, 0) - debts.reduce((a, b) => a + b.value, 0);

  const calculateProjectedSavings = () => {
    const target = new Date(targetDate);
    const now = new Date();
    return savings.reduce((acc, s) => {
      const maturity = new Date(s.maturityDate || targetDate);
      const end = target > maturity ? maturity : target;
      if (end <= now) return acc + s.current;
      const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
      const principal = s.current + (s.monthly * Math.max(0, months));
      const interest = (s.monthly * months * (months + 1) / 2) * (s.interestRate / 100 / 12);
      return acc + principal + interest;
    }, 0);
  };
  
  const projectedNetWorth = totalStockVal + assets.reduce((a, b) => a + b.value, 0) + calculateProjectedSavings() - debts.reduce((a, b) => a + b.value, 0);

  const grouped = stocks.reduce((acc: any, s) => {
    if (!acc[s.account]) acc[s.account] = { items: [], total: 0, profit: 0 };
    const isOS = s.market.includes('해외');
    const rate = isOS ? exchangeRate : 1;
    acc[s.account].items.push(s);
    acc[s.account].total += (s.current * rate * s.qty);
    acc[s.account].profit += (s.current - s.avg) * rate * s.qty;
    return acc;
  }, {});

  const realizedGrouped = [...realized].sort((a, b) => realizedSortOrder === 'desc' ? new Date(b.date).getTime() - new Date(a.date).getTime() : new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc: any, r) => {
      const m = r.date.substring(0, 7);
      if (!acc[m]) acc[m] = { items: [], sub: 0 };
      acc[m].items.push(r);
      acc[m].sub += r.profit;
      return acc;
    }, {});

  if (!isClient || loading) return <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white font-black text-2xl animate-pulse">FIXING EXCHANGE RATES...</div>;

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex justify-between items-end border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter">ASSET MASTER V2</h1>
            <p className="text-slate-500 text-[10px] font-bold tracking-[0.3em] uppercase mt-1">LG MDI Accounting Dept · System Final</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-amber-500 font-mono bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 font-bold">
              USD/KRW: {exchangeRate.toFixed(2)}
            </div>
          </div>
        </header>

        <nav className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide">
          {['overview', 'stocks', 'realestate', 'savings', 'realized'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}>
              {t === 'overview' ? '1. 통합 요약' : t === 'stocks' ? '2. 계좌별 주식' : t === 'realestate' ? '3. 실물/부채' : t === 'savings' ? '4. 예적금' : '5. 실현 손익'}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 p-12 rounded-[50px] border border-blue-500/20 shadow-2xl">
              <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase mb-4 opacity-70">Current Net Worth</p>
              <h2 className="text-6xl md:text-7xl font-black text-white tracking-tighter">{formatComma(netWorth)}<span className="text-2xl font-light ml-2 opacity-30">KRW</span></h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800"><p className="text-slate-500 text-[10px] font-black uppercase mb-1">주식 평가액</p><p className="text-xl font-bold text-white">{formatComma(totalStockVal)}</p></div>
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800"><p className="text-slate-500 text-[10px] font-black uppercase mb-1">기타 자산</p><p className="text-xl font-bold text-white">{formatComma(assets.reduce((a,b)=>a+b.value,0))}</p></div>
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800"><p className="text-slate-500 text-[10px] font-black uppercase mb-1">예적금 현고</p><p className="text-xl font-bold text-white">{formatComma(savings.reduce((a,b)=>a+b.current,0))}</p></div>
              <div className="bg-rose-900/20 p-6 rounded-3xl border border-rose-900/50"><p className="text-rose-400/70 text-[10px] font-black uppercase mb-1">부채 총계</p><p className="text-xl font-bold text-rose-400">{formatComma(debts.reduce((a,b)=>a+b.value,0))}</p></div>
            </div>

            <div className="bg-emerald-900/10 p-10 rounded-[50px] border border-emerald-900/30">
              <div className="flex justify-between items-center mb-8">
                <div><h3 className="text-xl font-black text-emerald-400 italic">Future Projection</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">예적금 이자 포함 미래 가치</p></div>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="bg-slate-900 text-emerald-400 font-black p-3 rounded-2xl border border-emerald-900/50 outline-none" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-950/50 p-6 rounded-3xl text-center"><p className="text-[10px] text-slate-500 font-black uppercase mb-2">예상 미래 순자산</p><p className="text-3xl font-black text-white">{formatComma(projectedNetWorth)} 원</p></div>
                <div className="bg-slate-950/50 p-6 rounded-3xl text-center"><p className="text-[10px] text-slate-500 font-black uppercase mb-2">현재 대비 증감액</p><p className="text-3xl font-black text-emerald-400">+{formatComma(projectedNetWorth - netWorth)} 원</p></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stocks' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-900/10 p-6 rounded-[30px] border border-blue-900/30">
                <div className="flex justify-between mb-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">국내 주식</span><span className={`font-black ${summ.dom.y >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>{summ.dom.y.toFixed(2)}%</span></div>
                <p className="text-2xl font-black text-white">{formatComma(summ.dom.val)}</p>
              </div>
              <div className="bg-amber-900/10 p-6 rounded-[30px] border border-amber-900/30">
                <div className="flex justify-between mb-2"><span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">해외 주식(환산)</span><span className={`font-black ${summ.os.y >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>{summ.os.y.toFixed(2)}%</span></div>
                <p className="text-2xl font-black text-white">{formatComma(summ.os.val)}</p>
              </div>
            </div>

            {Object.keys(grouped).map(acc => (
              <div key={acc} className="bg-slate-900 rounded-[30px] border border-slate-800 overflow-hidden shadow-xl">
                <div className="px-8 py-5 bg-slate-800/40 border-b border-slate-800 flex justify-between items-center">
                  <span className="font-black text-white italic tracking-tight text-lg">💳 {acc}</span>
                  <div className="text-right">
                    <span className="text-white font-black text-lg">{formatComma(grouped[acc].total)}원</span>
                    <span className={`ml-3 text-sm font-bold ${grouped[acc].profit >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>{grouped[acc].profit >= 0 ? '+' : ''}{formatComma(grouped[acc].profit)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-black uppercase border-b border-slate-800">
                        <th className="px-8 py-4">구분 / 종목명</th>
                        <th className="px-8 py-4 text-center">수량 / 평단</th>
                        <th className="px-8 py-4 text-right">수익률 / 원화손익</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {grouped[acc].items.map((s:any, i:number) => {
                        const isOS = s.market.includes('해외');
                        const rate = isOS ? exchangeRate : 1;
                        const yR = s.avg > 0 ? ((s.current - s.avg)/s.avg*100).toFixed(2) : "0.00";
                        const isUp = parseFloat(yR) >= 0;
                        const profKrw = (s.current - s.avg) * rate * s.qty;
                        return (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-8 py-5 font-bold text-slate-200">
                              <span className={`text-[8px] mr-2 px-1.5 py-0.5 rounded-sm uppercase tracking-tighter ${isOS ? 'bg-amber-900/50 text-amber-500' : 'bg-blue-900/50 text-blue-400'}`}>{isOS ? 'US' : 'KR'}</span>
                              {s.name}
                            </td>
                            <td className="px-8 py-5 text-center text-slate-500 font-mono text-xs">{s.qty.toLocaleString()}주 / {isOS ? `$${s.avg}` : `${formatComma(s.avg)}원`}</td>
                            <td className={`px-8 py-5 text-right font-black ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                              <div className="text-sm">{isUp ? '▲' : '▼'} {yR}%</div>
                              <div className="text-[10px] opacity-60 font-medium">{isUp ? '+' : ''}{formatComma(profKrw)}원</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- 실물/부채 탭 (기존과 동일) --- */}
        {activeTab === 'realestate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800">
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white italic">Real Assets</h3><button onClick={() => setAssets([...assets, { id: Date.now(), name: '', value: 0 }])} className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold">+ 추가</button></div>
              <div className="space-y-4">
                {assets.map(a => (
                  <div key={a.id} className="flex gap-4 items-center bg-slate-950 p-4 rounded-2xl border border-slate-800 focus-within:border-blue-500/50 transition-all">
                    <input type="text" value={a.name} onChange={e => setAssets(assets.map(as => as.id === a.id ? {...as, name: e.target.value} : as))} className="w-1/3 bg-transparent font-bold border-b border-slate-700 outline-none" placeholder="자산명" />
                    <input type="text" value={a.value.toLocaleString()} onChange={e => setAssets(assets.map(as => as.id === a.id ? {...as, value: cleanNum(e.target.value)} : as))} className="w-1/2 bg-transparent text-right font-bold border-b border-slate-700 outline-none text-blue-400" placeholder="금액" />
                    <button onClick={() => setAssets(assets.filter(as => as.id !== a.id))} className="text-slate-600 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-rose-900/10 p-8 rounded-[40px] border border-rose-900/30">
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-rose-400 italic">Liabilities</h3><button onClick={() => setDebts([...debts, { id: Date.now(), name: '', value: 0 }])} className="bg-rose-600 px-3 py-1 rounded-full text-[10px] font-bold">+ 추가</button></div>
              <div className="space-y-4">
                {debts.map(d => (
                  <div key={d.id} className="flex gap-4 items-center bg-slate-950 p-4 rounded-2xl border border-rose-900/20 focus-within:border-rose-500/50 transition-all">
                    <input type="text" value={d.name} onChange={e => setDebts(debts.map(ds => ds.id === d.id ? {...ds, name: e.target.value} : ds))} className="w-1/3 bg-transparent font-bold border-b border-slate-700 outline-none" placeholder="부채명" />
                    <input type="text" value={d.value.toLocaleString()} onChange={e => setDebts(debts.map(ds => ds.id === d.id ? {...ds, value: cleanNum(e.target.value)} : ds))} className="w-1/2 bg-transparent text-right font-bold border-b border-slate-700 outline-none text-rose-400" placeholder="금액" />
                    <button onClick={() => setDebts(debts.filter(ds => ds.id !== d.id))} className="text-slate-600 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 예적금 탭 (기존과 동일) --- */}
        {activeTab === 'savings' && (
          <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 animate-in fade-in duration-500 space-y-6">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white italic">Savings Simulator</h3><button onClick={() => setSavings([...savings, { id: Date.now(), name: '', monthly: 0, current: 0, maturityDate: '', transferDay: 1, interestRate: 0 }])} className="bg-emerald-600 px-4 py-2 rounded-full text-[10px] font-bold">+ 추가</button></div>
            {savings.map(s => {
              const maturity = new Date(s.maturityDate || new Date());
              const now = new Date();
              let mCount = (maturity.getFullYear()-now.getFullYear())*12 + (maturity.getMonth()-now.getMonth());
              if (now.getDate() > s.transferDay) mCount -= 1;
              if (maturity.getDate() >= s.transferDay) mCount += 1;
              const fVal = (s.current + (s.monthly * Math.max(0, mCount))) + ((s.monthly * Math.max(0, mCount) * (mCount + 1) / 2) * (s.interestRate / 100 / 12));
              return (
                <div key={s.id} className="bg-[#0c0e12] p-6 rounded-3xl border border-slate-800 flex flex-col xl:flex-row gap-6 relative group">
                  <button onClick={() => setSavings(savings.filter(sv => sv.id !== s.id))} className="absolute top-4 right-4 text-slate-600 hover:text-red-500 transition-colors">×</button>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 pr-6">
                    <div className="col-span-2 md:col-span-4 mb-2"><input type="text" value={s.name} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, name: e.target.value} : sv))} className="w-full bg-transparent text-white font-black border-b border-slate-700 outline-none text-lg" placeholder="상품명" /></div>
                    <div><p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest">월 납입액</p><input type="text" value={s.monthly.toLocaleString()} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, monthly: cleanNum(e.target.value)} : sv))} className="w-full bg-slate-900 text-white p-2 rounded-lg text-sm border border-slate-700 focus:border-emerald-500 outline-none" /></div>
                    <div><p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest">현재 잔액</p><input type="text" value={s.current.toLocaleString()} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, current: cleanNum(e.target.value)} : sv))} className="w-full bg-slate-900 text-white p-2 rounded-lg text-sm border border-slate-700 focus:border-emerald-500 outline-none" /></div>
                    <div><p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest">납입일 / 이율(%)</p><div className="flex gap-1"><input type="number" value={s.transferDay} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, transferDay: Number(e.target.value)} : sv))} className="w-1/2 bg-slate-900 text-white p-2 rounded-lg text-xs border border-slate-700 text-center" /><input type="number" step="0.1" value={s.interestRate} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, interestRate: Number(e.target.value)} : sv))} className="w-1/2 bg-slate-900 text-white p-2 rounded-lg text-xs border border-slate-700 text-center" /></div></div>
                    <div><p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest">만기일</p><input type="date" value={s.maturityDate} onChange={e => setSavings(savings.map(sv => sv.id === s.id ? {...sv, maturityDate: e.target.value} : sv))} className="bg-slate-900 text-white p-2 rounded-lg text-[10px] border border-slate-700 w-full" /></div>
                  </div>
                  <div className="w-full xl:w-1/3 bg-emerald-900/10 p-6 rounded-2xl border border-emerald-900/30 text-right flex flex-col justify-center">
                    <p className="text-[10px] text-emerald-400 mb-1 font-black uppercase tracking-widest">만기 예상액</p>
                    <p className="text-3xl font-black text-white leading-none">{formatComma(fVal)}<span className="text-sm ml-1 font-light opacity-50">원</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- 실현손익 탭 (기존과 동일) --- */}
        {activeTab === 'realized' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 p-10 rounded-[40px] border border-emerald-500/20 text-center shadow-xl">
              <p className="text-emerald-400/80 text-[10px] font-black uppercase tracking-[0.2em] mb-3 opacity-70">Total Realized Profit</p>
              <h2 className={`text-6xl font-black tracking-tighter ${realized.reduce((a,r)=>a+r.profit,0) >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {realized.reduce((a,r)=>a+r.profit,0) >= 0 ? '+' : ''}{formatComma(realized.reduce((a,r)=>a+r.profit,0))} <span className="text-xl font-light opacity-60 text-white">원</span>
              </h2>
            </div>
            <div className="bg-[#161a22] rounded-[40px] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
                <span className="font-black text-white tracking-widest uppercase text-sm">Monthly Settlement</span>
                <button onClick={() => setRealizedSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="text-[10px] bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-full hover:bg-slate-700 transition-all uppercase tracking-widest">
                  {realizedSortOrder === 'desc' ? '▼ Latest First' : '▲ Oldest First'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800 bg-slate-900/20">
                      <th className="px-8 py-4">매도일 / 종목</th>
                      <th className="px-8 py-4 text-center">수량</th>
                      <th className="px-8 py-4 text-right">손익 / 수익률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(realizedGrouped).map(m => (
                      <React.Fragment key={m}>
                        {realizedGrouped[m].items.map((r:any, i:number) => (
                          <tr key={`${m}-${i}`} className="border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors">
                            <td className="px-8 py-5"><div className="text-[10px] text-slate-500 font-mono mb-1">{r.date}</div><div className="font-bold text-white text-sm">{r.name}</div></td>
                            <td className="px-8 py-5 text-center font-bold text-slate-400 text-sm">{r.qty.toLocaleString()}</td>
                            <td className={`px-8 py-5 text-right font-black ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}><div>{r.profit >= 0 ? '+' : ''}{formatComma(r.profit)}</div><div className="text-[10px] opacity-70">{r.yieldRate}%</div></td>
                          </tr>
                        ))}
                        <tr className="bg-slate-900/80 border-b border-slate-800">
                          <td colSpan={3} className="px-8 py-3 flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{m} Monthly Subtotal</span><span className={`text-sm font-black ${realizedGrouped[m].sub >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{realizedGrouped[m].sub >= 0 ? '+' : ''}{formatComma(realizedGrouped[m].sub)} 원</span></td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
