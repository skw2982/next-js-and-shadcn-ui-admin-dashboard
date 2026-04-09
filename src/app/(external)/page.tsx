"use client";

import React, { useState, useEffect } from 'react';

// 1. 데이터 규격(타입) 정의 - 타입 오류 해결
interface Stock {
  name: string;
  code: string;
  qty: number;
  avg: number;
  current: number;
}

export default function SeokyeongwonFinalDashboard() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  // 콤마(,)가 포함된 문자열 숫자를 안전하게 숫자로 바꾸는 함수
  const parseSafeFloat = (val: string) => {
    if (!val) return 0;
    // 콤마 제거 후 숫자 변환
    return parseFloat(val.replace(/,/g, '').replace(/"/g, '')) || 0;
  };

  const fetchData = async () => {
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      
      // 엑셀에서 따옴표(") 안에 콤마가 있는 경우를 처리하기 위한 로직
      const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);
      const dataRows = rows.slice(1);

      const parsed: Stock[] = dataRows.map(row => {
        // 단순 split(',') 대신 따옴표 안의 콤마를 무시하는 정규식 사용
        const columns = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const cleanCols = columns.map(col => col.replace(/"/g, '').trim());

        // 시트 순서: A:이름(0), B:티커(1), C:비고(2), D:수량(3), E:평단(4), F:현재가(5)
        return {
          name: cleanCols[0] || "",
          code: cleanCols[1] || "",
          qty: parseSafeFloat(cleanCols[3]),
          avg: parseSafeFloat(cleanCols[4]),
          current: parseSafeFloat(cleanCols[5])
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
    <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white">
      <p className="text-xl font-bold tracking-widest animate-pulse font-sans">ASSET DATA UPDATING...</p>
    </div>
  );

  const totalValue = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
  const totalProfit = totalValue - totalBuy;
  const totalYield = totalBuy > 0 ? ((totalProfit / totalBuy) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-6 md:p-12 font-sans selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">석경원 자산 대시보드</h1>
            <p className="text-slate-500 text-xs mt-1 font-medium">LG MDI 회계부 · 실시간 자산 관리</p>
          </div>
          <div className="text-[10px] text-sky-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 font-mono">
            UPDATED: {lastUpdated}
          </div>
        </div>

        {/* Total Asset Card */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 p-8 rounded-[40px] shadow-2xl mb-8 relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-blue-100/70 text-xs font-bold uppercase tracking-widest mb-2">총 평가 자산 (Total Assets)</p>
            <h2 className="text-5xl font-black text-white mb-8 tracking-tighter">
              {Math.round(totalValue).toLocaleString()} <span className="text-xl font-normal opacity-60">원</span>
            </h2>
            <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
              <div>
                <p className="text-blue-100/50 text-[10px] font-bold uppercase mb-1">평가 손익</p>
                <p className="text-2xl font-black text-white leading-none">
                  {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-blue-100/50 text-[10px] font-bold uppercase mb-1">수익률</p>
                <p className="text-2xl font-black text-white leading-none">{totalYield}%</p>
              </div>
            </div>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] text-white/5 text-[12rem] font-black italic select-none pointer-events-none group-hover:scale-110 transition-transform duration-1000">KRW</div>
        </div>

        {/* Holdings List */}
        <div className="bg-[#161a22] rounded-[40px] border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-8 py-6 border-b border-slate-800 font-bold text-white flex justify-between items-center bg-slate-900/30">
            <span className="tracking-tight">보유 종목 현황 ({stocks.length})</span>
            <span className="text-[10px] text-emerald-400 animate-pulse tracking-widest uppercase font-mono font-bold">● MARKET LIVE</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-600 text-[10px] uppercase font-black tracking-widest border-b border-slate-800 bg-slate-900/10">
                  <th className="px-8 py-4">자산명</th>
                  <th className="px-8 py-4">보유수량</th>
                  <th className="px-8 py-4 text-right">수익률 / 평가손익</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stocks.sort((a,b) => (b.current*b.qty)-(a.current*a.qty)).map((stock, idx) => {
                  const yieldRate = ((stock.current - stock.avg) / stock.avg * 100).toFixed(2);
                  const profitVal = (stock.current - stock.avg) * stock.qty;
                  const isUp = parseFloat(yieldRate) >= 0;
                  
                  return (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="font-bold text-white group-hover:text-sky-400 transition-colors tracking-tight">{stock.name}</div>
                        <div className="text-[10px] text-slate-600 font-mono mt-1 uppercase tracking-tighter">{stock.code}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-slate-300">{stock.qty.toLocaleString()} <span className="text-[10px] opacity-40 font-normal">주</span></div>
                        <div className="text-[10px] text-slate-600 mt-1">평단: {Math.round(stock.avg).toLocaleString()}원</div>
                      </td>
                      <td className={`px-8 py-6 text-right font-black ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                        <div className="text-lg tracking-tighter leading-none mb-1">{isUp ? '▲' : '▼'} {yieldRate}%</div>
                        <div className="text-[10px] opacity-70 font-bold">{isUp ? '+' : ''}{Math.round(profitVal).toLocaleString()} 원</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="mt-16 text-center">
            <p className="text-slate-800 text-[10px] font-black uppercase tracking-[0.4em]">© 2026 Seokyeongwon Dashboard · Managed with Google Sheets</p>
        </footer>
      </div>
    </div>
  );
}
