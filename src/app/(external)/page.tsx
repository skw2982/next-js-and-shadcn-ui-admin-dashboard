"use client";

import React, { useState, useEffect } from 'react';

// --- 데이터 규격 정의 ---
interface Stock {
  name: string;
  code: string;
  qty: number;
  avg: number;
  current: number;
}

interface Saving {
  id: number;
  name: string;
  monthly: number;
  current: number;
  monthsLeft: number;
}

export default function MasterAssetDashboard() {
  // --- 1. 탭 상태 관리 ---
  const [activeTab, setActiveTab] = useState('overview');

  // --- 2. 주식 데이터 상태 (구글 시트 연동) ---
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  // --- 3. 기타 자산 및 부채 상태 (초기값 세팅) ---
  const [realEstate, setRealEstate] = useState(250000000); // 힐스테이트 오피스텔 (예시)
  const [car, setCar] = useState(35000000);              // 자동차 (예시)
  const [minusAccount, setMinusAccount] = useState(40000000); // 마이너스 통장 (예시)

  // --- 4. 예적금 상태 ---
  const [savings, setSavings] = useState<Saving[]>([
    { id: 1, name: "청년도약계좌", monthly: 700000, current: 8400000, monthsLeft: 48 },
    { id: 2, name: "주택청약", monthly: 100000, current: 3500000, monthsLeft: 120 }
  ]);

  // --- 데이터 정제 및 구글 시트 호출 함수 ---
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
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- 계산 로직 ---
  const totalStockValue = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalStockBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
  const totalSavings = savings.reduce((acc, s) => acc + s.current, 0);
  
  // 핵심 회계 지표
  const totalAssets = totalStockValue + realEstate + car + totalSavings;
  const totalLiabilities = minusAccount;
  const netWorth = totalAssets - totalLiabilities; // 순자산

  // 부채 비율 (안전도 체크)
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  if (loading) return (
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
              {tab === 'stocks' && '2. 주식 상세'}
              {tab === 'realestate' && '3. 실물/부채'}
              {tab === 'savings' && '4. 예적금'}
            </button>
          ))}
        </div>

        {/* --- 1페이지: 통합 요약 (Overview) --- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 순자산 카드 */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-[#0c0e12] p-8 md:p-12 rounded-[40px] border border-indigo-500/30 relative overflow-hidden">
              <p className="text-indigo-300 text-xs font-black uppercase tracking-[0.2em] mb-2">Total Net Worth (순자산)</p>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
                {Math.round(netWorth).toLocaleString()} <span className="text-2xl font-light opacity-50">원</span>
              </h2>
              
              {/* 시각화 바 (자산 vs 부채) */}
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

            {/* 자산 비중 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">주식 평가액</p>
                <p className="text-xl font-bold text-white mt-1">{Math.round(totalStockValue).toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">부동산 (오피스텔 등)</p>
                <p className="text-xl font-bold text-white mt-1">{Math.round(realEstate).toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">예적금/현금</p>
                <p className="text-xl font-bold text-white mt-1">{Math.round(totalSavings).toLocaleString()}</p>
              </div>
              <div className="bg-rose-900/20 p-6 rounded-3xl border border-rose-900/50">
                <p className="text-rose-400/70 text-[10px] font-black uppercase tracking-widest">마이너스 통장/대출</p>
                <p className="text-xl font-bold text-rose-400 mt-1">{Math.round(minusAccount).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* --- 2페이지: 주식 상세 (Stocks) --- */}
        {activeTab === 'stocks' && (
          <div className="bg-[#161a22] rounded-[40px] border border-slate-800 overflow-hidden shadow-2xl animate-in fade-in duration-500">
            <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <span className="font-black text-white">Google Sheet Live Sync</span>
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

        {/* --- 3페이지: 실물/부채 (Real Estate & Debt) --- */}
        {activeTab === 'realestate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800">
              <h3 className="text-xl font-black text-white mb-6">부동산 및 실물 자산</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">힐스테이트 오피스텔 (원)</label>
                  <input type="number" value={realEstate} onChange={(e) => setRealEstate(Number(e.target.value))} className="w-full bg-[#0c0e12] text-white p-4 rounded-2xl border border-slate-700 focus:border-blue-500 outline-none font-bold" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">자동차 (원)</label>
                  <input type="number" value={car} onChange={(e) => setCar(Number(e.target.value))} className="w-full bg-[#0c0e12] text-white p-4 rounded-2xl border border-slate-700 focus:border-blue-500 outline-none font-bold" />
                </div>
              </div>
            </div>
            <div className="bg-rose-900/10 p-8 rounded-[40px] border border-rose-900/30">
              <h3 className="text-xl font-black text-rose-400 mb-6">부채 (Liabilities)</h3>
              <div>
                <label className="text-xs font-bold text-rose-400/70 uppercase tracking-widest block mb-2">마이너스 통장 잔액 (원)</label>
                <input type="number" value={minusAccount} onChange={(e) => setMinusAccount(Number(e.target.value))} className="w-full bg-[#0c0e12] text-rose-400 p-4 rounded-2xl border border-rose-900/50 focus:border-rose-500 outline-none font-bold" />
                <p className="text-[10px] text-slate-500 mt-3">* 부채는 순자산 계산 시 총자산에서 차감됩니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* --- 4페이지: 예적금 (Savings) --- */}
        {activeTab === 'savings' && (
          <div className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden p-8 animate-in fade-in duration-500">
            <h3 className="text-xl font-black text-white mb-6">적금 만기 시뮬레이터</h3>
            <div className="space-y-6">
              {savings.map((saving) => {
                const futureValue = saving.current + (saving.monthly * saving.monthsLeft);
                return (
                  <div key={saving.id} className="bg-[#0c0e12] p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-6 justify-between items-center">
                    <div className="flex-1 w-full">
                      <h4 className="font-bold text-white text-lg mb-4">{saving.name}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-500 tracking-widest uppercase">월 납입액</p>
                          <p className="font-bold text-slate-300">{saving.monthly.toLocaleString()}원</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 tracking-widest uppercase">현재 잔액</p>
                          <p className="font-bold text-slate-300">{saving.current.toLocaleString()}원</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 w-full bg-blue-900/20 p-5 rounded-2xl border border-blue-900/50 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-blue-400 tracking-widest uppercase mb-1">남은 기간: {saving.monthsLeft}개월</p>
                        <p className="text-xs text-slate-400">만기 시 예상 수령액</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-white">{futureValue.toLocaleString()}원</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-center text-[10px] text-slate-500 mt-4 font-bold">* 입력된 데이터를 기반으로 원금을 단순 합산한 만기 예상액입니다.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
