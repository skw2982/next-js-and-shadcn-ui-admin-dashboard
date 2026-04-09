"use client";

import React, { useState, useEffect } from 'react';

// --- 데이터 규격 정의 ---
interface Stock { market: string; name: string; code: string; qty: number; avg: number; current: number; }
interface Asset { id: number; name: string; value: number; }
interface Debt { id: number; name: string; value: number; }
// 예적금 스펙 업그레이드 (만기일자, 납입일, 이자율 추가)
interface Saving { id: number; name: string; monthly: number; current: number; maturityDate: string; transferDay: number; interestRate: number; }
interface Realized { date: string; name: string; qty: number; profit: number; yieldRate: number; note: string; }

export default function MasterAssetDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isClient, setIsClient] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); 
  const [realizedSortOrder, setRealizedSortOrder] = useState<'desc' | 'asc'>('desc'); 

  // --- 미래 현금흐름 목표일 ---
  const [targetDate, setTargetDate] = useState('2026-12-31');

  // 실시간 환율 상태
  const [exchangeRate, setExchangeRate] = useState(1350); 

  // --- 🔗 구글 시트 연동 링크 ---
  const STOCK_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";
  const REALIZED_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=817751922&single=true&output=csv";

  // --- 상태 관리 ---
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [realized, setRealized] = useState<Realized[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const [assets, setAssets] = useState<Asset[]>([
    { id: 1, name: '힐스테이트 오피스텔', value: 250000000 },
    { id: 2, name: '자동차', value: 35000000 }
  ]);
  const [debts, setDebts] = useState<Debt[]>([
    { id: 1, name: '마이너스 통장', value: 40000000 }
  ]);
  // 예적금 초기값 (신규 스펙 반영)
  const [savings, setSavings] = useState<Saving[]>([
    { id: 1, name: "청년도약계좌", monthly: 700000, current: 8400000, maturityDate: '2028-06-25', transferDay: 25, interestRate: 6.0 },
    { id: 2, name: "주택청약", monthly: 100000, current: 3500000, maturityDate: '2030-12-15', transferDay: 15, interestRate: 2.5 }
  ]);

  useEffect(() => {
    setIsClient(true);
    const savedAssets = localStorage.getItem('myAssetsV2');
    const savedDebts = localStorage.getItem('myDebtsV2');
    const savedSavings = localStorage.getItem('mySavingsV2');
    if (savedAssets) setAssets(JSON.parse(savedAssets));
    if (savedDebts) setDebts(JSON.parse(savedDebts));
    if (savedSavings) setSavings(JSON.parse(savedSavings));
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('myAssetsV2', JSON.stringify(assets));
      localStorage.setItem('myDebtsV2', JSON.stringify(debts));
      localStorage.setItem('mySavingsV2', JSON.stringify(savings));
    }
  }, [assets, debts, savings, isClient]);

  const cleanNum = (val: string) => parseFloat(val.toString().replace(/[,"'원\s%]/g, '')) || 0;
  
  // 콤마 포맷팅용 헬퍼
  const formatComma = (num: number) => num === 0 ? '' : num.toLocaleString();

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data?.rates?.KRW) setExchangeRate(data.rates.KRW);
    } catch(e) {}
  };

  const fetchGoogleSheets = async () => {
    try {
      const resStocks = await fetch(`${STOCK_CSV_URL}&t=${new Date().getTime()}`);
      const textStocks = await resStocks.text();
      const rowsS = textStocks.split('\n').map(r => r.trim()).filter(r => r);
      if (rowsS.length >= 2) {
        const headers = rowsS[0].split(',').map(h => h.replace(/"/g, '').trim());
        const idx = {
          market: headers.findIndex(h => h.includes("구분")),
          name: headers.findIndex(h => h.includes("종목")),
          code: headers.findIndex(h => h.includes("티커")),
          qty: headers.findIndex(h => h.includes("수량")),
          avg: headers.findIndex(h => h.includes("평단")),
          current: headers.findIndex(h => h.includes("현재가"))
        };
        const parsedStocks = rowsS.slice(1).map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
          return {
            market: idx.market !== -1 ? (c[idx.market] || "국내") : "국내",
            name: c[idx.name !== -1 ? idx.name : 0] || "Unknown",
            code: c[idx.code !== -1 ? idx.code : 1] || "",
            qty: cleanNum(c[idx.qty !== -1 ? idx.qty : 3]),
            avg: cleanNum(c[idx.avg !== -1 ? idx.avg : 4]),
            current: cleanNum(c[idx.current !== -1 ? idx.current : 5])
          };
        }).filter(s => s.qty > 0);
        setStocks(parsedStocks);
      }

      const resReal = await fetch(`${REALIZED_CSV_URL}&t=${new Date().getTime()}`);
      const textReal = await resReal.text();
      const rowsR = textReal.split('\n').map(r => r.trim()).filter(r => r);
      if (rowsR.length >= 2) {
        const parsedReal = rowsR.slice(1).map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
          return {
            date: c[0] || "",
            name: c[1] || "",
            qty: cleanNum(c[2]),
            profit: cleanNum(c[3]),
            yieldRate: cleanNum(c[4]),
            note: c[5] || ""
          };
        }).filter(r => r.date);
        setRealized(parsedReal); 
      }

      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRate();
    fetchGoogleSheets();
    const interval = setInterval(() => {
      fetchExchangeRate();
      fetchGoogleSheets();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- CRUD 핸들러 ---
  const addAsset = () => setAssets([...assets, { id: Date.now(), name: '', value: 0 }]);
  const removeAsset = (id: number) => setAssets(assets.filter(a => a.id !== id));
  const updateAsset = (id: number, field: string, val: string | number) => setAssets(assets.map(a => a.id === id ? { ...a, [field]: val } : a));

  const addDebt = () => setDebts([...debts, { id: Date.now(), name: '', value: 0 }]);
  const removeDebt = (id: number) => setDebts(debts.filter(d => d.id !== id));
  const updateDebt = (id: number, field: string, val: string | number) => setDebts(debts.map(d => d.id === id ? { ...d, [field]: val } : d));

  const addSaving = () => setSavings([...savings, { id: Date.now(), name: '', monthly: 0, current: 0, maturityDate: '', transferDay: 1, interestRate: 0 }]);
  const removeSaving = (id: number) => setSavings(savings.filter(s => s.id !== id));
  const updateSaving = (id: number, field: string, val: string | number) => setSavings(savings.map(s => s.id === id ? { ...s, [field]: val } : s));

  // --- 주식 계산 (국내/해외 분리) ---
  const domesticStocks = stocks.filter(s => !s.market.includes('해외'));
  const overseasStocks = stocks.filter(s => s.market.includes('해외'));

  const calcStockMetrics = (stockList: Stock[], isUS: boolean) => {
    let totalValue = 0;
    let totalInvest = 0;
    stockList.forEach(s => {
      const rate = isUS ? exchangeRate : 1;
      totalValue += s.current * rate * s.qty;
      totalInvest += s.avg * rate * s.qty;
    });
    const profit = totalValue - totalInvest;
    const yieldRate = totalInvest > 0 ? (profit / totalInvest) * 100 : 0;
    return { totalValue, profit, yieldRate };
  };

  const domMetrics = calcStockMetrics(domesticStocks, false);
  const osMetrics = calcStockMetrics(overseasStocks, true);
  const totalStockValue = domMetrics.totalValue + osMetrics.totalValue;

  // --- 자산 종합 계산 ---
  const totalOtherAssets = assets.reduce((acc, a) => acc + a.value, 0);
  const totalSavings = savings.reduce((acc, s) => acc + s.current, 0);
  const totalLiabilities = debts.reduce((acc, d) => acc + d.value, 0);
  const totalAssets = totalStockValue + totalOtherAssets + totalSavings;
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // --- 미래 현금흐름 (예적금 프로젝션) 계산 ---
  const calculateFutureSavings = (target: string) => {
    const targetDateObj = new Date(target);
    const now = new Date();
    let projectedTotal = 0;

    savings.forEach(s => {
      const maturity = new Date(s.maturityDate);
      const end = targetDateObj > maturity ? maturity : targetDateObj;
      if (end <= now || !s.maturityDate) {
        projectedTotal += s.current;
        return;
      }
      
      let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
      if (now.getDate() > s.transferDay) months -= 1;
      if (end.getDate() >= s.transferDay) months += 1;
      if (months < 0) months = 0;

      // 단리 이자 계산 (대략적인 예상 이자)
      const principal = s.current + (s.monthly * months);
      const interest = (s.monthly * months * (months + 1) / 2) * (s.interestRate / 100 / 12);
      projectedTotal += (principal + interest);
    });
    return projectedTotal;
  };

  const projectedSavings = calculateFutureSavings(targetDate);
  const projectedNetWorth = totalStockValue + totalOtherAssets + projectedSavings - totalLiabilities;

  // --- 실현손익 월별 소계 처리 ---
  const sortedRealized = [...realized].sort((a, b) => {
    const dateA = new Date(a.date).getTime() || 0;
    const dateB = new Date(b.date).getTime() || 0;
    return realizedSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const groupedRealized: { [key: string]: { items: Realized[], subtotal: number } } = {};
  sortedRealized.forEach(r => {
    const monthKey = r.date.substring(0, 7); // YYYY-MM
    if (!groupedRealized[monthKey]) groupedRealized[monthKey] = { items: [], subtotal: 0 };
    groupedRealized[monthKey].items.push(r);
    groupedRealized[monthKey].subtotal += r.profit;
  });

  if (!isClient || loading) return (
    <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white font-black animate-pulse">
      LG MDI FINANCIAL SYSTEM INITIALIZING...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase">INTEGRATED ASSET BOARD</h1>
            <p className="text-slate-500 text-xs mt-1 font-bold tracking-widest uppercase">LG MDI Accounting Dept · Net Worth Tracking</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-amber-400 font-mono bg-amber-900/20 border border-amber-900/50 px-3 py-1 rounded-full mb-1">
              $1 = {Math.round(exchangeRate).toLocaleString()}원
            </div>
          </div>
        </header>

        {/* 탭 네비게이션 */}
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 scrollbar-hide">
          {['overview', 'stocks', 'realestate', 'savings', 'realized'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 rounded-2xl font-bold text-xs tracking-widest uppercase whitespace-nowrap transition-all ${
                activeTab === tab ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {tab === 'overview' && '1. 통합 요약'}
              {tab === 'stocks' && '2. 보유 주식'}
              {tab === 'realestate' && '3. 실물/부채'}
              {tab === 'savings' && '4. 예적금'}
              {tab === 'realized' && '5. 실현 손익'}
            </button>
          ))}
        </div>

        {/* --- 1페이지: 통합 요약 (미래현금 프로젝션 추가) --- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* 현재 순자산 카드 */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-[#0c0e12] p-8 md:p-12 rounded-[40px] border border-indigo-500/30 relative overflow-hidden">
              <p className="text-indigo-300 text-xs font-black uppercase tracking-[0.2em] mb-2">Current Net Worth (현재 순자산)</p>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
                {Math.round(netWorth).toLocaleString()} <span className="text-2xl font-light opacity-50">원</span>
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">주식 평가액</p>
                <p className="text-xl font-bold text-white mt-1">{Math.round(totalStockValue).toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">기타 실물 자산</p>
                <p className="text-xl font-bold text-white mt-1">{Math.round(totalOtherAssets).toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">예적금/현금</p>
                <p className="text-xl font-bold text-white mt-1">{Math.round(totalSavings).toLocaleString()}</p>
              </div>
              <div className="bg-rose-900/20 p-6 rounded-3xl border border-rose-900/50">
                <p className="text-rose-400/70 text-[10px] font-black uppercase tracking-widest">부채 (대출/마통)</p>
                <p className="text-xl font-bold text-rose-400 mt-1">{Math.round(totalLiabilities).toLocaleString()}</p>
              </div>
            </div>

            {/* 🔥 신규: 미래 현금/순자산 프로젝션 */}
            <div className="bg-emerald-900/20 p-8 md:p-10 rounded-[40px] border border-emerald-900/50 mt-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.2em] mb-2">CF Projection (미래 자산 시뮬레이터)</p>
                  <p className="text-slate-400 text-sm font-bold">선택한 날짜까지 예적금(원금+이자)이 누적되었을 때의 예상 순자산입니다.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">목표일자</span>
                  <input 
                    type="date" 
                    value={targetDate} 
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="bg-[#0c0e12] text-emerald-400 font-bold p-3 rounded-xl border border-emerald-900 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="mt-8 flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-[#0c0e12] p-6 rounded-3xl border border-emerald-900/30">
                  <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">해당 시점 예적금 누적 확보액 (현금)</p>
                  <p className="text-3xl font-black text-emerald-400">{Math.round(projectedSavings).toLocaleString()} 원</p>
                </div>
                <div className="flex-1 bg-[#0c0e12] p-6 rounded-3xl border border-emerald-900/30">
                  <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">예상 통합 순자산 (Net Worth)</p>
                  <p className="text-3xl font-black text-white">{Math.round(projectedNetWorth).toLocaleString()} 원</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 2페이지: 보유 주식 (국내/해외 구분 요약 추가) --- */}
        {activeTab === 'stocks' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* 섹터별 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-900/20 p-6 rounded-3xl border border-blue-900/50">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-blue-900/50 text-blue-400 text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest">국내 주식 (Domestic)</span>
                  <span className={`text-sm font-black ${domMetrics.yieldRate >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                    {domMetrics.yieldRate >= 0 ? '+' : ''}{domMetrics.yieldRate.toFixed(2)}%
                  </span>
                </div>
                <p className="text-2xl font-black text-white">{Math.round(domMetrics.totalValue).toLocaleString()} 원</p>
                <p className="text-xs text-slate-400 mt-1">손익: {domMetrics.profit >= 0 ? '+' : ''}{Math.round(domMetrics.profit).toLocaleString()} 원</p>
              </div>
              
              <div className="bg-amber-900/20 p-6 rounded-3xl border border-amber-900/50">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-amber-900/50 text-amber-500 text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest">해외 주식 (Overseas)</span>
                  <span className={`text-sm font-black ${osMetrics.yieldRate >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                    {osMetrics.yieldRate >= 0 ? '+' : ''}{osMetrics.yieldRate.toFixed(2)}%
                  </span>
                </div>
                <p className="text-2xl font-black text-white">{Math.round(osMetrics.totalValue).toLocaleString()} 원</p>
                <p className="text-xs text-slate-400 mt-1">손익: {osMetrics.profit >= 0 ? '+' : ''}{Math.round(osMetrics.profit).toLocaleString()} 원</p>
              </div>
            </div>

            <div className="bg-[#161a22] rounded-[40px] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
                <span className="font-black text-white text-sm">종목별 상세 현황</span>
                <span className="text-[10px] text-sky-400 font-mono bg-slate-900 px-3 py-1 rounded-full">{lastUpdated}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800 bg-slate-900/20">
                      <th className="px-8 py-4">구분 / 종목명</th>
                      <th className="px-8 py-4 text-center">수량 / 평단</th>
                      <th className="px-8 py-4 text-right cursor-pointer hover:text-white transition-colors group select-none" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                        <div className="flex items-center justify-end gap-1">
                          원화환산 수익률/손익
                          <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded group-hover:bg-slate-700">{sortOrder === 'desc' ? '▼내림차순' : '▲오름차순'}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {[...stocks].sort((a,b) => {
                       const yA = (a.current - a.avg)/a.avg; const yB = (b.current - b.avg)/b.avg;
                       return sortOrder === 'desc' ? yB - yA : yA - yB;
                    }).map((s, i) => {
                      const isUS = s.market.includes('해외');
                      const krwAvg = isUS ? s.avg * exchangeRate : s.avg;
                      const krwCurrent = isUS ? s.current * exchangeRate : s.current;
                      const yieldRate = krwAvg > 0 ? ((krwCurrent - krwAvg) / krwAvg * 100).toFixed(2) : "0.00";
                      const profit = (krwCurrent - krwAvg) * s.qty;
                      const isUp = parseFloat(yieldRate) >= 0;
                      const displayAvg = isUS ? `$${s.avg.toFixed(2)}` : `${Math.round(s.avg).toLocaleString()}원`;

                      return (
                        <tr key={i} className="hover:bg-white/[0.02] transition-all">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${isUS ? 'bg-amber-900/30 text-amber-500' : 'bg-blue-900/30 text-blue-400'}`}>{isUS ? 'US' : 'KR'}</span>
                              <span className="font-bold text-white text-base">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className="text-sm font-bold text-slate-300">{s.qty.toLocaleString()}주</div>
                            <div className="text-[10px] text-slate-500">평단: {displayAvg}</div>
                          </td>
                          <td className={`px-8 py-6 text-right font-black ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                            <div className="text-lg leading-none mb-1">{isUp ? '▲' : '▼'} {yieldRate}%</div>
                            <div className="text-[10px] opacity-70">{isUp ? '+' : ''}{Math.round(profit).toLocaleString()} 원</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- 3페이지: 실물/부채 (동일하여 축약 없이 유지) --- */}
        {activeTab === 'realestate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white">기타 실물 자산</h3>
                <button onClick={addAsset} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full">+ 추가</button>
              </div>
              <div className="space-y-4">
                {assets.map((asset) => (
                  <div key={asset.id} className="bg-[#0c0e12] p-4 rounded-2xl border border-slate-800 flex gap-4 items-center">
                    <input type="text" value={asset.name} onChange={(e) => updateAsset(asset.id, 'name', e.target.value)} className="w-1/3 bg-transparent text-white text-sm font-bold outline-none border-b border-slate-700 focus:border-blue-500 pb-1" placeholder="자산명" />
                    <input type="text" value={formatComma(asset.value)} onChange={(e) => updateAsset(asset.id, 'value', cleanNum(e.target.value))} className="w-1/2 bg-transparent text-blue-400 text-right font-bold outline-none border-b border-slate-700 focus:border-blue-500 pb-1" placeholder="금액" />
                    <button onClick={() => removeAsset(asset.id)} className="text-slate-600 hover:text-red-500 text-xl font-black">×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-rose-900/10 p-8 rounded-[40px] border border-rose-900/30 relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-rose-400">부채 내역</h3>
                <button onClick={addDebt} className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full">+ 추가</button>
              </div>
              <div className="space-y-4">
                {debts.map((debt) => (
                  <div key={debt.id} className="bg-[#0c0e12] p-4 rounded-2xl border border-rose-900/30 flex gap-4 items-center">
                    <input type="text" value={debt.name} onChange={(e) => updateDebt(debt.id, 'name', e.target.value)} className="w-1/3 bg-transparent text-white text-sm font-bold outline-none border-b border-rose-900/50 focus:border-rose-500 pb-1" placeholder="부채명" />
                    <input type="text" value={formatComma(debt.value)} onChange={(e) => updateDebt(debt.id, 'value', cleanNum(e.target.value))} className="w-1/2 bg-transparent text-rose-400 text-right font-bold outline-none border-b border-rose-900/50 focus:border-rose-500 pb-1" placeholder="금액" />
                    <button onClick={() => removeDebt(debt.id)} className="text-rose-900 hover:text-red-500 text-xl font-black">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 4페이지: 예적금 관리 (디테일/포맷팅 업그레이드) --- */}
        {activeTab === 'savings' && (
          <div className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden p-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">예적금 시뮬레이터</h3>
              <button onClick={addSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-4 py-2 rounded-full">+ 예적금 추가</button>
            </div>
            <div className="space-y-6">
              {savings.map((saving) => {
                // 개별 만기 예상액 계산 로직
                const maturityDate = new Date(saving.maturityDate || new Date());
                const now = new Date();
                let months = (maturityDate.getFullYear() - now.getFullYear()) * 12 + (maturityDate.getMonth() - now.getMonth());
                if (now.getDate() > saving.transferDay) months -= 1;
                if (maturityDate.getDate() >= saving.transferDay) months += 1;
                if (months < 0) months = 0;

                const principal = saving.current + (saving.monthly * months);
                const interest = (saving.monthly * months * (months + 1) / 2) * (saving.interestRate / 100 / 12);
                const futureValue = principal + interest;

                return (
                  <div key={saving.id} className="bg-[#0c0e12] p-6 rounded-3xl border border-slate-800 flex flex-col xl:flex-row gap-6 relative group">
                    <button onClick={() => removeSaving(saving.id)} className="absolute top-4 right-4 text-slate-600 hover:text-red-500 text-xl font-black z-10">×</button>
                    
                    {/* 정보 입력 영역 */}
                    <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-4 pr-6">
                      <div className="col-span-2 md:col-span-4 mb-2">
                        <input type="text" value={saving.name} onChange={(e) => updateSaving(saving.id, 'name', e.target.value)} className="w-full bg-transparent text-white text-lg font-bold outline-none border-b border-slate-700 focus:border-emerald-500 pb-1" placeholder="예적금 상품명" />
                      </div>
                      
                      <div>
                        <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">월 납입액(원)</p>
                        <input type="text" value={formatComma(saving.monthly)} onChange={(e) => updateSaving(saving.id, 'monthly', cleanNum(e.target.value))} className="w-full bg-slate-900 text-white p-2 rounded-lg text-sm font-bold border border-slate-700 outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">현재 잔액(원)</p>
                        <input type="text" value={formatComma(saving.current)} onChange={(e) => updateSaving(saving.id, 'current', cleanNum(e.target.value))} className="w-full bg-slate-900 text-white p-2 rounded-lg text-sm font-bold border border-slate-700 outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">매월 납입일</p>
                        <div className="flex items-center">
                          <span className="text-xs text-slate-400 mr-2">매월</span>
                          <input type="number" min="1" max="31" value={saving.transferDay} onChange={(e) => updateSaving(saving.id, 'transferDay', Number(e.target.value))} className="w-16 bg-slate-900 text-white p-2 rounded-lg text-sm font-bold border border-slate-700 outline-none focus:border-emerald-500 text-center" />
                          <span className="text-xs text-slate-400 ml-2">일</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">적용 이율(%)</p>
                        <div className="flex items-center">
                          <input type="number" step="0.1" value={saving.interestRate} onChange={(e) => updateSaving(saving.id, 'interestRate', Number(e.target.value))} className="w-20 bg-slate-900 text-white p-2 rounded-lg text-sm font-bold border border-slate-700 outline-none focus:border-emerald-500 text-center" />
                          <span className="text-xs text-slate-400 ml-2">%</span>
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">만기 일자 (YYYY-MM-DD)</p>
                        <input type="date" value={saving.maturityDate} onChange={(e) => updateSaving(saving.id, 'maturityDate', e.target.value)} className="bg-slate-900 text-white p-2 rounded-lg text-sm font-bold border border-slate-700 outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                    
                    {/* 결과 영역 */}
                    <div className="w-full xl:w-1/3 bg-emerald-900/10 p-6 rounded-2xl border border-emerald-900/30 flex flex-col justify-center items-end">
                      <div className="text-right mb-2">
                        <span className="text-[10px] text-emerald-400 tracking-widest uppercase font-black bg-emerald-900/30 px-2 py-1 rounded">
                          남은 기간: {months}개월
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-1">만기 예상액 (원금+단리이자)</p>
                      <p className="text-3xl font-black text-white">{Math.round(futureValue).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 5페이지: 실현 손익 (월별 소계 추가) --- */}
        {activeTab === 'realized' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 p-10 rounded-[40px] border border-emerald-500/20 text-center">
              <p className="text-emerald-400/80 text-[10px] font-black uppercase tracking-[0.2em] mb-3">누적 실현 수익 (Realized)</p>
              <h2 className={`text-6xl font-black tracking-tighter ${totalRealizedProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {totalRealizedProfit >= 0 ? '+' : ''}{Math.round(totalRealizedProfit).toLocaleString()} <span className="text-xl font-light opacity-60 text-white">원</span>
              </h2>
            </div>

            <div className="bg-[#161a22] rounded-[40px] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
                <span className="font-black text-white">매매 히스토리 & 월별 결산</span>
                <button onClick={() => setRealizedSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-full transition-colors">
                  {realizedSortOrder === 'desc' ? '▼ 최신순 보기' : '▲ 과거순 보기'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800 bg-slate-900/20">
                      <th className="px-8 py-4">매도일자 / 종목명</th>
                      <th className="px-8 py-4 text-center">매도수량</th>
                      <th className="px-8 py-4 text-right">실현손익금 / 수익률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {/* 월별 소계를 렌더링하기 위해 Object.keys 사용 */}
                    {Object.keys(groupedRealized).map((monthKey) => (
                      <React.Fragment key={monthKey}>
                        {/* 해당 월의 데이터 리스트 */}
                        {groupedRealized[monthKey].items.map((r, i) => {
                          const isUp = r.profit >= 0;
                          return (
                            <tr key={`${monthKey}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-8 py-5">
                                <div className="text-[10px] text-slate-500 font-mono mb-1">{r.date}</div>
                                <div className="font-bold text-white text-sm">{r.name}</div>
                              </td>
                              <td className="px-8 py-5 text-center font-bold text-slate-400 text-sm">{r.qty.toLocaleString()}</td>
                              <td className={`px-8 py-5 text-right font-black ${isUp ? 'text-emerald-400' : 'text-rose-500'}`}>
                                <div className="text-base tracking-tighter mb-1">{isUp ? '+' : ''}{Math.round(r.profit).toLocaleString()} 원</div>
                                <div className="text-[10px] opacity-70">{r.yieldRate}%</div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* 해당 월 결산(소계) 바 */}
                        <tr className="bg-slate-900/80">
                          <td colSpan={3} className="px-8 py-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{monthKey}월 결산 소계</span>
                              <span className={`text-sm font-black ${groupedRealized[monthKey].subtotal >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                {groupedRealized[monthKey].subtotal >= 0 ? '+' : ''}{Math.round(groupedRealized[monthKey].subtotal).toLocaleString()} 원
                              </span>
                            </div>
                          </td>
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
