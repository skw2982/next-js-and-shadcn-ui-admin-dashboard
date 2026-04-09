"use client";

import React, { useState, useEffect } from 'react';

// 데이터 규격 정의
interface Stock {
  name: string;
  code: string;
  qty: number;
  avg: number;
  current: number;
}

export default function SeokyeongwonDashboard() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  // 회계 데이터용 숫자 정제 함수 (콤마, 따옴표 제거)
  const cleanNum = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/[," ]/g, '')) || 0;
  };

  const fetchData = async () => {
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);
      const dataRows = rows.slice(1); // 첫 줄 헤더 제외

      const parsed: Stock[] = dataRows.map(row => {
        // 따옴표 안의 콤마를 무시하고 분리
        const cols = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const c = cols.map(v => v.replace(/"/g, '').trim());

        // 🔍 경원님 시트 열 매핑 (정밀 수정)
        // 0:종목명, 1:티커, 2:수량, 3:평단, 4:현재가
        return {
          name: c[0] || "알 수 없음",
          code: c[1] || "",
          qty: cleanNum(c[2]),     // 수량
          avg: cleanNum(c[3]),     // 평단
          current: cleanNum(c[4])  // 현재가
        };
      }).filter(s => s.qty > 0);

      setStocks(parsed);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("데이터 로드 실패", e);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white font-sans font-bold">
      데이터 동기화 중...
    </div>
  );

  // 총 합계 계산
  const totalVal = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
  const totalProfit = totalVal - totalBuy;
  const yieldRate = totalBuy > 0 ? ((totalProfit / totalBuy) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-6 md:p-12 font-sans selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        
        {/* 상단 헤더 */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">SEOKYEONGWON ASSETS</h1>
            <p className="text-slate-500 text-xs mt-2 font-bold tracking-widest uppercase opacity-80">LG MDI Accounting Dept · Portfolio</p>
          </div>
          <div className="text-[10px] text-sky-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 font-mono font-bold shadow-lg">
            LIVE: {lastUpdated}
          </div>
        </div>

        {/* 메인 총 자산 카드 */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-10 rounded-[48px] shadow-2xl mb-10 relative overflow-hidden border border-white/10 group">
          <div className="relative z-10">
            <p className="text-blue-100/70 text-xs font-black mb-3 uppercase tracking-[0.2em]">Total Asset Valuation</p>
            <h2 className="text-6xl font-black text-white mb-10 tracking-tighter">
              {Math.round(totalVal).toLocaleString()} <span className="text-2xl font-light opacity-60 ml-1">원</span>
            </h2>
            <div className="grid grid-cols-2 gap-10 border-t border-white/10 pt-8">
              <div>
                <p className="text-blue-100/50 text-[10px] font-black uppercase mb-2 tracking-widest">평가 손익</p>
                <p className="text-3xl font-black text-white leading-none">
                  {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-blue-100/50 text-[10px] font-black uppercase mb-2 tracking-widest">수익률</p>
                <p className="text-3xl font-black text-white leading-none">{yieldRate}%</p>
              </div>
            </div>
          </div>
          <div className="absolute right-[-30px] bottom-[-30px] text-white/5 text-[15rem] font-black italic select-none pointer-events-none group-hover:scale-110 transition-transform duration-1000">KRW</div>
        </div>

        {/* 종목별 리스트 */}
        <div className="bg-[#161a22] rounded-[48px] border border-slate-800 overflow-hidden shadow-2xl">
          <div className="px-10 py-8 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
            <h3 className="font-black text-white text-lg tracking-tight">보유 종목 현황 ({stocks.length})</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] text-emerald-400 font-black tracking-widest uppercase">Market Active</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-600 text-[10px] uppercase font-black tracking-[0.2em] border-b border-slate-800 bg-slate-900/20">
                  <th className="px-10 py-5">Asset</th>
                  <th className="px-10 py-5 text-center">Qty / Price</th>
                  <th className="px-10 py-5 text-right">Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-sans">
                {stocks.sort((a,b) => (b.current*b.qty)-(a.current*a.qty)).map((s, i) => {
                  const sYield = ((s.current - s.avg) / s.avg * 100).toFixed(2);
                  const sProfit = (s.current - s.avg) * s.qty;
                  const isUp = parseFloat(sYield) >= 0;
                  
                  return (
                    <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="px-10 py-7">
                        <div className="font-black text-white group-hover:text-blue-400 transition-colors text-base tracking-tight mb-1">{s.name}</div>
                        <div className="text-[10px] text-slate-600 font-mono font-bold tracking-widest uppercase">{s.code}</div>
                      </td>
                      <td className="px-10 py-7 text-center">
                        <div className="text-sm font-black text-slate-300 mb-1">{s.qty.toLocaleString()} <span className="text-[10px] opacity-30 font-normal">주</span></div>
                        <div className="text-[10px] text-slate-600 font-bold uppercase">평단: {Math.round(s.avg).toLocaleString()}</div>
                      </td>
                      <td className={`px-10 py-7 text-right font-black ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                        <div className="text-xl tracking-tighter leading-none mb-2">{isUp ? '▲' : '▼'} {sYield}%</div>
                        <div className="text-[10px] opacity-70 font-bold tracking-tight">{isUp ? '+' : ''}{Math.round(sProfit).toLocaleString()} 원</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="mt-20 pb-12 text-center opacity-30">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">Systemized by Gemini · LG MDI Accounting Dept</p>
        </footer>
      </div>
    </div>
  );
}
