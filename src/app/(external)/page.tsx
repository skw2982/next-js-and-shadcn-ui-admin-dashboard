"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, RefreshCw, BarChart3, PieChart } from 'lucide-react';

export default function SeokyeongwonLiveDashboard() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  // 🔗 경원님이 주신 구글 시트 CSV 링크
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  const fetchData = async () => {
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      
      // CSV 줄바꿈 처리 및 파싱
      const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);
      const dataRows = rows.slice(1); // 첫 줄 헤더 제외

      const parsed = dataRows.map(row => {
        // 콤마로 구분하되, 숫자 안의 콤마나 따옴표 처리 (단순 split 대신 정규식 권장)
        const columns = row.split(',').map(col => col.replace(/"/g, ''));
        
        // 시트 구조: A(종목명), B(티커), C(비고), D(수량), E(평단), F(현재가) 순서일 경우
        // 만약 비고가 없다면 index를 한 칸씩 당겨주세요.
        return {
          name: columns[0],
          code: columns[1],
          qty: parseFloat(columns[3]) || 0,     // 수량
          avg: parseFloat(columns[4]) || 0,     // 평단
          current: parseFloat(columns[5]) || 0  // 현재가
        };
      }).filter(s => s.qty > 0); // 수량이 있는 것만 표시

      setStocks(parsed);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex flex-col items-center justify-center text-white">
        <RefreshCw className="animate-spin mb-4 text-sky-500" size={48} />
        <p className="font-bold text-xl">실시간 자산 데이터 연결 중...</p>
      </div>
    );
  }

  // 계산 로직
  const totalValue = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
  const totalProfit = totalValue - totalBuy;
  const totalYield = totalBuy > 0 ? ((totalProfit / totalBuy) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-4 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Seokyeongwon Assets</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">LG MDI Accounting Dept · Portfolio Management</p>
          </div>
          <div className="flex items-center gap-3 bg-[#161a22] px-4 py-2 rounded-2xl border border-slate-800">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-slate-400">Live Updated: {lastUpdated}</span>
          </div>
        </header>

        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-blue-100/70 text-sm font-bold mb-2 uppercase tracking-widest">Total Valuation</p>
              <h2 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tight">
                {Math.round(totalValue).toLocaleString()} <span className="text-2xl font-light opacity-60 ml-1">KRW</span>
              </h2>
              <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
                <div>
                  <p className="text-blue-100/50 text-xs font-bold uppercase mb-1">Total Profit</p>
                  <p className="text-2xl font-black text-white">
                    {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-blue-100/50 text-xs font-bold uppercase mb-1">Yield (%)</p>
                  <p className="text-2xl font-black text-white">{totalYield}%</p>
                </div>
              </div>
            </div>
            <Wallet className="absolute right-[-40px] bottom-[-40px] w-80 h-80 text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
          </div>

          <div className="bg-[#161a22] p-8 rounded-[32px] border border-slate-800 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Sector Analysis</h3>
                <PieChart size={18} className="text-slate-500" />
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-2 font-bold"><span>Semiconductor</span><span className="text-blue-400">58%</span></div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden"><div className="bg-blue-500 h-full w-[58%] rounded-full" /></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2 font-bold"><span>Bio Tech</span><span className="text-emerald-400">24%</span></div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[24%] rounded-full" /></div>
                </div>
              </div>
            </div>
            <button className="w-full py-4 mt-8 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-black transition-all uppercase tracking-tighter">View Details</button>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-[#161a22] rounded-[32px] border border-slate-800 shadow-xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-500" />
              HOLDINGS ({stocks.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-800 bg-slate-900/50">
                  <th className="px-8 py-5">Stock</th>
                  <th className="px-8 py-5">Quantity</th>
                  <th className="px-8 py-5">Avg Price</th>
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
                        <div className="font-black text-white group-hover:text-blue-400 transition-colors leading-none mb-1">{stock.name}</div>
                        <div className="text-[10px] font-mono text-slate-600 tracking-wider uppercase">{stock.code}</div>
                      </td>
                      <td className="px-8 py-6 font-bold text-slate-300 text-sm">{stock.qty.toLocaleString()} <span className="text-[10px] opacity-40">주</span></td>
                      <td className="px-8 py-6">
                        <div className="text-xs text-slate-500 mb-1">Avg: {Math.round(stock.avg).toLocaleString()}</div>
                        <div className="text-sm font-black text-white">{Math.round(stock.current).toLocaleString()}원</div>
                      </td>
                      <td className={`px-8 py-6 text-right font-black ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                        <div className="flex items-center justify-end gap-1 text-base">
                          {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          {yieldVal}%
                        </div>
                        <div className="text-[10px] opacity-70 mt-1">
                          {isUp ? '+' : ''}{Math.round(profitVal).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="mt-16 pb-10 text-center">
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em]">© 2026 SEOKYEONGWON DASHBOARD · DESIGNED FOR LG MDI ACCOUNTING</p>
        </footer>
      </div>
    </div>
  );
}
