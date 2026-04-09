"use client";

import React, { useState, useEffect } from 'react';

// 1. 바구니(Stock)에 들어갈 데이터의 형식을 미리 정의합니다.
interface Stock {
  name: string;
  code: string;
  qty: number;
  avg: number;
  current: number;
}

export default function SeokyeongwonLiveDashboard() {
  // 2. useState<Stock[]>([]) 라고 써서 "이 바구니엔 Stock 데이터만 들어올 거야"라고 선언합니다.
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  const fetchData = async () => {
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);
      const dataRows = rows.slice(1);

      const parsed: Stock[] = dataRows.map(row => {
        const columns = row.split(',').map(col => col.replace(/"/g, '').trim());
        return {
          name: columns[0] || "",
          code: columns[1] || "",
          qty: parseFloat(columns[3]) || 0,
          avg: parseFloat(columns[4]) || 0,
          current: parseFloat(columns[5]) || 0
        };
      }).filter(s => s.qty > 0);

      setStocks(parsed);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Fetch Error:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-bold">
      <p className="text-xl tracking-widest">CONNECTING TO ASSETS...</p>
    </div>
  );

  const totalValue = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
  const totalProfit = totalValue - totalBuy;
  const totalYield = totalBuy > 0 ? ((totalProfit / totalBuy) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">SEOKYEONGWON ASSETS</h1>
            <p className="text-slate-500 text-sm mt-1">LG MDI Accounting Dept · Real-time Dashboard</p>
          </div>
          <div className="hidden md:block bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl text-[10px] text-sky-400 font-mono">
            LIVE UPDATED: {lastUpdated}
          </div>
        </div>

        {/* Total Asset Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-[40px] shadow-2xl mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-blue-100/70 text-xs font-bold uppercase tracking-widest mb-2">Total Valuation</p>
            <h2 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tighter">
              {Math.round(totalValue).toLocaleString()} <span className="text-xl font-normal opacity-60">KRW</span>
            </h2>
            <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
              <div>
                <p className="text-blue-100/50 text-[10px] font-bold uppercase mb-1">Profit/Loss</p>
                <p className="text-2xl font-black text-white">
                  {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-blue-100/50 text-[10px] font-bold uppercase mb-1">Yield (%)</p>
                <p className="text-2xl font-black text-white">{totalYield}%</p>
              </div>
            </div>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] text-white/5 text-[15rem] font-black italic select-none">KRW</div>
        </div>

        {/* Stock List Table */}
        <div className="bg-[#161a22] rounded-[40px] border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-8 py-6 border-b border-slate-800 font-bold text-white flex justify-between items-center">
            <span>HOLDINGS ({stocks.length})</span>
            <span className="text-[10px] text-emerald-400 animate-pulse uppercase tracking-widest">● Market Live</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-600 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
                  <th className="px-8 py-4">Asset</th>
                  <th className="px-8 py-4">Qty</th>
                  <th className="px-8 py-4 text-right">Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stocks.sort((a,b) => (b.current*b.qty)-(a.current*a.qty)).map((stock, idx) => {
                  const yieldRate = ((stock.current - stock.avg) / stock.avg * 100).toFixed(2);
                  const isUp = parseFloat(yieldRate) >= 0;
                  return (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="font-bold text-white group-hover:text-sky-400 transition-colors">{stock.name}</div>
                        <div className="text-[10px] text-slate-600 font-mono mt-1">{stock.code}</div>
                      </td>
                      <td className="px-8 py-6 text-sm text-slate-400">
                        {stock.qty.toLocaleString()} <span className="text-[10px] opacity-40">주</span>
                      </td>
                      <td className={`px-8 py-6 text-right font-bold ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                        <div className="text-lg tracking-tighter">{isUp ? '▲' : '▼'} {yieldRate}%</div>
                        <div className="text-[10px] opacity-70 mt-1">{Math.round((stock.current-stock.avg)*stock.qty).toLocaleString()} 원</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
