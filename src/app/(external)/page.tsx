"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, RefreshCw, BarChart3, PieChart } from 'lucide-react';

export default function SeokyeongwonLiveDashboard() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  // 🔗 경원님의 구글 시트 CSV 링크 (연동 완료)
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  const fetchData = async () => {
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      
      const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);
      const dataRows = rows.slice(1); // 첫 줄 헤더 제외

      const parsed = dataRows.map(row => {
        const columns = row.split(',').map(col => col.replace(/"/g, '').trim());
        
        // 시트 구조: A(종목명), B(티커), C(비고), D(수량), E(평단), F(현재가)
        return {
          name: columns[0],
          code: columns[1],
          qty: parseFloat(columns[3]) || 0,
          avg: parseFloat(columns[4]) || 0,
          current: parseFloat(columns[5]) || 0
        };
      }).filter(s => s.qty > 0); // 보유 수량이 있는 종목만 필터링

      setStocks(parsed);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("데이터 동기화 실패:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 1분 주기로 업데이트
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex flex-col items-center justify-center text-white font-sans">
        <RefreshCw className="animate-spin mb-4 text-sky-500" size={48} />
        <p className="font-bold text-xl tracking-tight uppercase">Dashboard Connecting...</p>
      </div>
    );
  }

  // 전체 지표 계산
  const totalValue = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
  const totalProfit = totalValue - totalBuy;
  const totalYield = totalBuy > 0 ? ((totalProfit / totalBuy) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-10 font-sans selection:bg-sky-500/30">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Seokyeongwon Assets</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">LG MDI Accounting Dept · Real-time Portfolio</p>
          </div>
          <div className="flex items-center gap-3 bg-[#161a22] px-4 py-2 rounded-2xl border border-slate-800 shadow-inner">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-slate-400 font-bold uppercase tracking-tighter">Live status: {lastUpdated}</span>
          </div>
        </header>

        {/* Overview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Main Asset Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-blue-100/70 text-xs font-black mb-2 uppercase tracking-[0.2em]">Current Asset Value</p>
              <h2 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tighter">
                {Math.round(totalValue).toLocaleString()} <span className="text-2xl font-light opacity-60 ml-1">KRW</span>
              </h2>
              <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
                <div>
                  <p className="text-blue-100/50 text-[10px] font-black uppercase mb-1 tracking-widest">Unrealized Profit (평가손익)</p>
                  <p className="text-2xl font-black text-white">
                    {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-blue-100/50 text-[10px] font-black uppercase mb-1 tracking-widest">Yield Rate (%)</p>
                  <p className="text-2xl font-black text-white">{totalYield}%</p>
                </div>
              </div>
            </div>
            <Wallet className="absolute right-[-40px] bottom-[-40px] w-80 h-80 text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
          </div>

          {/* Side Info / Sector Summary */}
          <div className="bg-[#161a22] p-8 rounded-[32px] border border-slate-800 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Main Sectors</h3>
                <PieChart size={18} className="text-slate-500" />
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs mb-2 font-bold uppercase"><span>Semiconductor</span><span className="text-blue-400">55%</span></div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-500 h-full w-[55%] rounded-full" /></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2 font-bold uppercase"><span>Bio / Healthcare</span><span className="text-emerald-400">30%</span></div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[30%] rounded-full" /></div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 font-bold leading-relaxed mt-6 italic">
              "Data-driven portfolio for consistent growth."
            </p>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-[#161a22] rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
            <h3 className="font-black text-white flex items-center gap-2 tracking-tighter">
              <BarChart3 size={20} className="text-blue-500" />
              PORTFOLIO HOLDINGS ({stocks.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-800 bg-slate-900/50">
                  <th className="px-8 py-5">Asset</th>
                  <th className="px-8 py-5">Qty</th>
                  <th className="px-8 py-5">Price Info</th>
                  <th className="px-8 py-5 text-right">Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stocks.sort((a, b) => (b.current * b.qty) - (a.current * a.qty)).map((stock) => {
                  const profitVal = (stock.current - stock.avg) * stock.qty;
                  const yieldVal = ((stock.current - stock.avg) / stock.avg * 100).toFixed(2);
                  const isUp = parseFloat(yieldVal) >= 0;

                  return (
                    <tr key={stock.code} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="font-black text-white group-hover:text-blue-400 transition-colors leading-none mb-1.5">{stock.name}</div>
                        <div className="text-[10px] font-mono text-slate-600 tracking-wider uppercase">{stock.code}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-slate-300">{stock.qty.toLocaleString()} <span className="text-[10px] opacity-30 font-normal">주</span></div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-[10px] text-slate-600 font-bold mb-1 uppercase tracking-tighter">Avg: {Math.round(stock.avg).toLocaleString()}</div>
                        <div className="text-sm font-black text-white">{Math.round(stock.current).toLocaleString()} 원</div>
                      </td>
                      <td className={`px-8 py-6 text-right font-black ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                        <div className="flex items-center justify-end gap-1 text-base tracking-tighter">
                          {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          {yieldVal}%
                        </div>
                        <div className="text-[10px] opacity-70 mt-1 font-bold">
                          {isUp ? '+' : ''}{Math.round(profitVal).toLocaleString()} 원
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="mt-20 pb-12 text-center">
            <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.4em]">© 2026 Seokyeongwon · LG MDI Accounting Dept</p>
        </footer>
      </div>
    </div>
  );
}
