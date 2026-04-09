"use client";

import React, { useState, useEffect } from 'react';

// --- 데이터 규격 정의 ---
interface Stock { name: string; code: string; qty: number; avg: number; current: number; }
interface Asset { id: number; name: string; value: number; }
interface Debt { id: number; name: string; value: number; }
interface Saving { id: number; name: string; monthly: number; current: number; monthsLeft: number; }

export default function MasterAssetDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isClient, setIsClient] = useState(false); // 로컬 스토리지 안전 로드용

  // --- 주식 데이터 상태 (구글 시트 연동) ---
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  // --- 확장형 자산/부채/예적금 상태 ---
  const [assets, setAssets] = useState<Asset[]>([
    { id: 1, name: '힐스테이트 오피스텔', value: 250000000 },
    { id: 2, name: '자동차', value: 35000000 }
  ]);
  const [debts, setDebts] = useState<Debt[]>([
    { id: 1, name: '마이너스 통장', value: 40000000 }
  ]);
  const [savings, setSavings] = useState<Saving[]>([
    { id: 1, name: "청년도약계좌", monthly: 700000, current: 8400000, monthsLeft: 48 },
    { id: 2, name: "주택청약", monthly: 100000, current: 3500000, monthsLeft: 120 }
  ]);

  // --- 로컬 스토리지 로드 & 저장 ---
  useEffect(() => {
    setIsClient(true);
    const savedAssets = localStorage.getItem('myAssets');
    const savedDebts = localStorage.getItem('myDebts');
    const savedSavings = localStorage.getItem('mySavings');
    if (savedAssets) setAssets(JSON.parse(savedAssets));
    if (savedDebts) setDebts(JSON.parse(savedDebts));
    if (savedSavings) setSavings(JSON.parse(savedSavings));
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('myAssets', JSON.stringify(assets));
      localStorage.setItem('myDebts', JSON.stringify(debts));
      localStorage.setItem('mySavings', JSON.stringify(savings));
    }
  }, [assets, debts, savings, isClient]);

  // --- 구글 시트 데이터 로드 ---
  const cleanNum = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/[,"'원\s]/g, '')) || 0;
  };

  const fetchStocks = async () => {
    try {
      const response = await fetch(`${SHEET_CSV_URL}&t=${new Date().getTime()}`);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(r => r.trim()).filter(r => r);
      if (rows.length < 2) return;

      const headers = rows[0].split(',').map(h => h.replace(/"/g, '').trim());
      const idxName = headers.findIndex(h => h.includes("종목") || h.includes("이름"));
      const idxCode = headers.findIndex(h => h.includes("티커"));
      const idxQty = headers.findIndex(h => h.includes("수량"));
      const idxAvg = headers.findIndex(h => h.includes("평단"));
      const idxCurrent = headers.findIndex(h => h.includes("현재가"));

      const finalIdx = {
        name: idxName !== -1 ? idxName : 0, code: idxCode !== -1 ? idxCode : 1,
        qty: idxQty !== -1 ? idxQty : 3, avg: idxAvg !== -1 ? idxAvg : 4, current: idxCurrent !== -1 ? idxCurrent : 5
      };

      const parsed: Stock[] = rows.slice(1).map(row => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
        return {
          name: c[finalIdx.name] || "Unknown", code: c[finalIdx.code] || "",
          qty: cleanNum(c[finalIdx.qty]), avg: cleanNum(c[finalIdx.avg]), current: cleanNum(c[finalIdx.current])
        };
      }).filter(s => s.qty > 0);

      setStocks(parsed);
      setLoadingStocks(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      setLoadingStocks(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- 항목 추가/삭제 핸들러 ---
  const addAsset = () => setAssets([...assets, { id: Date.now(), name: '새 자산', value: 0 }]);
  const removeAsset = (id: number) => setAssets(assets.filter(a => a.id !== id));
  const updateAsset = (id: number, field: string, val: string | number) => {
    setAssets(assets.map(a => a.id === id ? { ...a, [field]: val } : a));
  };

  const addDebt = () => setDebts([...debts, { id: Date.now(), name: '새 부채', value: 0 }]);
  const removeDebt = (id: number) => setDebts(debts.filter(d => d.id !== id));
  const updateDebt = (id: number, field: string, val: string | number) => {
    setDebts(debts.map(d => d.id === id ? { ...d, [field]: val } : d));
  };

  const addSaving = () => setSavings([...savings, { id: Date.now(), name: '새 예적금', monthly: 0, current: 0, monthsLeft: 12 }]);
  const removeSaving = (id: number) => setSavings(savings.filter(s => s.id !== id));
  const updateSaving = (id: number, field: string, val: string | number) => {
    setSavings(savings.map(s => s.id === id ? { ...s, [field]: val } : s));
  };

  // --- 계산 로직 ---
  const totalStockValue = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalOtherAssets = assets.reduce((acc, a) => acc + a.value, 0);
  const totalSavings = savings.reduce((acc, s) => acc + s.current, 0);
  const totalLiabilities = debts.reduce((acc, d) => acc + d.value, 0);
  
  const totalAssets = totalStockValue + totalOtherAssets + totalSavings;
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  if (!isClient || loadingStocks) return (
    <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white animate-pulse">
      SYSTEM INITIALIZING...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* 헤더 */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase">INTEGRATED ASSET BOARD</h1>
          <p className="text-slate-500 text-xs mt-1 font-bold tracking-widest uppercase">LG MDI Accounting Dept · Net Worth Tracking</p>
        </header>

        {/* 탭 네비게이션 */}
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 scrollbar-hide">
          {['overview', 'stocks', 'realestate', 'savings'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-2xl font-bold text-xs tracking-widest uppercase whitespace-nowrap transition-all ${
                activeTab === tab 
                ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' 
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {tab === 'overview' && '1. 통합 요약'}
              {tab === 'stocks' && '2. 주식 상세(시트연동)'}
              {tab === 'realestate' && '3. 실물/부채 관리'}
              {tab === 'savings' && '4. 예적금 관리'}
            </button>
          ))}
        </div>

        {/* --- 1페이지: 통합 요약 (Overview) --- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-[#0c0e12] p-8 md:p-12 rounded-[40px] border border-indigo-500/30 relative overflow-hidden">
              <p className="text-indigo-300 text-xs font-black uppercase tracking-[0.2em] mb-2">Total Net Worth (순자산)</p>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
                {Math.round(netWorth).toLocaleString()} <span className="text-2xl font-light opacity-50">원</span>
              </h2>
              <div className="mt-8">
                <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase mb-2">
                  <span className="text-blue-400">자산 총계: {Math.round(totalAssets).toLocaleString()}</span>
                  <span className="text-rose-400">부채 총계: {Math.round(totalLiabilities).toLocaleString()}</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500" style={{ width: `${100 - debtRatio}%` }}></div>
                  <div className="h-full bg-rose-500" style={{ width: `${debtRatio}%` }}></div>
                </div>
              </div>
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
          </div>
        )}

        {/* --- 2페이지: 주식 상세 (Stocks - Read Only from Sheet) --- */}
        {activeTab === 'stocks' && (
          <div className="bg-[#161a22] rounded-[40px] border border-slate-800 overflow-hidden shadow-2xl animate-in fade-in duration-500">
            <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <span className="font-black text-white text-sm">구글 시트 실시간 연동 중 (수정은 시트에서)</span>
              <span className="text-[10px] text-sky-400 font-mono bg-slate-900 px-3 py-1 rounded-full">{lastUpdated}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800 bg-slate-900/20">
                    <th className="px-8 py-4">종목명</th>
                    <th className="px-8 py-4 text-center">수량/평단</th>
                    <th className="px-8 py-4 text-right">수익률/손익</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {stocks.sort((a,b) => (b.current*b.qty)-(a.current*a.qty)).map((s, i) => {
                    const yieldRate = ((s.current - s.avg) / s.avg * 100).toFixed(2);
                    const profit = (s.current - s.avg) * s.qty;
                    const isUp = parseFloat(yieldRate) >= 0;
                    return (
                      <tr key={i} className="hover:bg-white/[0.02] transition-all">
                        <td className="px-8 py-6 font-bold text-white">{s.name}</td>
                        <td className="px-8 py-6 text-center">
                          <div className="text-sm font-bold text-slate-300">{s.qty.toLocaleString()}주</div>
                          <div className="text-[10px] text-slate-500">평단: {Math.round(s.avg).toLocaleString()}</div>
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
        )}

        {/* --- 3페이지: 실물/부채 관리 (Dynamic Addition) --- */}
        {activeTab === 'realestate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {/* 자산 섹션 */}
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white">기타 실물 자산</h3>
                <button onClick={addAsset} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors">+ 추가</button>
              </div>
              <div className="space-y-4">
                {assets.map((asset) => (
                  <div key={asset.id} className="bg-[#0c0e12] p-4 rounded-2xl border border-slate-800 flex gap-4 items-center">
                    <input type="text" value={asset.name} onChange={(e) => updateAsset(asset.id, 'name', e.target.value)} className="w-1/3 bg-transparent text-white text-sm font-bold outline-none border-b border-slate-700 focus:border-blue-500 pb-1" placeholder="자산명" />
                    <input type="number" value={asset.value} onChange={(e) => updateAsset(asset.id, 'value', Number(e.target.value))} className="w-1/2 bg-transparent text-blue-400 text-right font-bold outline-none border-b border-slate-700 focus:border-blue-500 pb-1" placeholder="금액(원)" />
                    <button onClick={() => removeAsset(asset.id)} className="text-slate-600 hover:text-red-500 text-xl font-black transition-colors">×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* 부채 섹션 */}
            <div className="bg-rose-900/10 p-8 rounded-[40px] border border-rose-900/30 relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-rose-400">부채 내역</h3>
                <button onClick={addDebt} className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors">+ 추가</button>
              </div>
              <div className="space-y-4">
                {debts.map((debt) => (
                  <div key={debt.id} className="bg-[#0c0e12] p-4 rounded-2xl border border-rose-900/30 flex gap-4 items-center">
                    <input type="text" value={debt.name} onChange={(e) => updateDebt(debt.id, 'name', e.target.value)} className="w-1/3 bg-transparent text-white text-sm font-bold outline-none border-b border-rose-900/50 focus:border-rose-500 pb-1" placeholder="부채명" />
                    <input type="number" value={debt.value} onChange={(e) => updateDebt(debt.id, 'value', Number(e.target.value))} className="w-1/2 bg-transparent text-rose-400 text-right font-bold outline-none border-b border-rose-900/50 focus:border-rose-500 pb-1" placeholder="금액(원)" />
                    <button onClick={() => removeDebt(debt.id)} className="text-rose-900 hover:text-red-500 text-xl font-black transition-colors">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 4페이지: 예적금 관리 (Dynamic Addition) --- */}
        {activeTab === 'savings' && (
          <div className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden p-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">예적금 시뮬레이터</h3>
              <button onClick={addSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-4 py-2 rounded-full transition-colors">+ 예적금 추가</button>
            </div>
            <div className="space-y-4">
              {savings.map((saving) => {
                const futureValue = saving.current + (saving.monthly * saving.monthsLeft);
                return (
                  <div key={saving.id} className="bg-[#0c0e12] p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-6 relative group">
                    <button onClick={() => removeSaving(saving.id)} className="absolute top-4 right-4 text-slate-600 hover:text-red-500 text-xl font-black transition-colors">×</button>
                    
                    <div className="flex-1 w-full space-y-4 pr-6">
                      <input type="text" value={saving.name} onChange={(e) => updateSaving(saving.id, 'name', e.target.value)} className="w-full bg-transparent text-white text-lg font-bold outline-none border-b border-slate-700 focus:border-emerald-500 pb-1" placeholder="예적금/펀드 이름" />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">월 납입액 (원)</p>
                          <input type="number" value={saving.monthly} onChange={(e) => updateSaving(saving.id, 'monthly', Number(e.target.value))} className="w-full bg-slate-900 text-white p-2 rounded-lg text-sm font-bold border border-slate-700 outline-none" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">현재 잔액 (원)</p>
                          <input type="number" value={saving.current} onChange={(e) => updateSaving(saving.id, 'current', Number(e.target.value))} className="w-full bg-slate-900 text-white p-2 rounded-lg text-sm font-bold border border-slate-700 outline-none" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 w-full bg-emerald-900/10 p-5 rounded-2xl border border-emerald-900/30 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[10px] text-emerald-400 tracking-widest uppercase">남은 기간:</p>
                          <input type="number" value={saving.monthsLeft} onChange={(e) => updateSaving(saving.id, 'monthsLeft', Number(e.target.value))} className="w-16 bg-slate-900 text-white p-1 rounded text-center text-xs font-bold border border-emerald-900/50 outline-none" />
                          <span className="text-[10px] text-emerald-400 font-bold">개월</span>
                        </div>
                        <p className="text-xs text-slate-400">만기 시 예상 수령액</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-white">{futureValue.toLocaleString()}원</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
