"use client";

import React, { useState, useEffect } from 'react';

interface Stock {
  name: string;
  code: string;
  qty: number;
  avg: number;
  current: number;
}

export default function SeokyeongwonSmartDashboard() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  const cleanNum = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/[,"'원\s]/g, '')) || 0;
  };

  const fetchData = async () => {
    try {
      const response = await fetch(`${SHEET_CSV_URL}&t=${new Date().getTime()}`);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(r => r.trim()).filter(r => r);
      
      if (rows.length < 2) {
        setErrorMsg("시트에 데이터가 부족합니다.");
        return;
      }

      // 1. 헤더 분석: 코드가 직접 열의 위치를 찾습니다.
      const headers = rows[0].split(',').map(h => h.replace(/"/g, '').trim());
      
      const idxName = headers.findIndex(h => h.includes("종목") || h.includes("이름") || h.includes("Asset"));
      const idxCode = headers.findIndex(h => h.includes("티커") || h.includes("코드") || h.includes("Ticker"));
      const idxQty = headers.findIndex(h => h.includes("수량") || h.includes("Qty") || h.includes("보유"));
      const idxAvg = headers.findIndex(h => h.includes("평단") || h.includes("평균") || h.includes("Avg"));
      const idxCurrent = headers.findIndex(h => h.includes("현재") || h.includes("Price") || h.includes("Current"));

      // 위치를 못 찾았을 경우의 기본값 세팅
      const finalIdx = {
        name: idxName !== -1 ? idxName : 0,
        code: idxCode !== -1 ? idxCode : 1,
        qty: idxQty !== -1 ? idxQty : 3,
        avg: idxAvg !== -1 ? idxAvg : 4,
        current: idxCurrent !== -1 ? idxCurrent : 5
      };

      const parsed: Stock[] = rows.slice(1).map(row => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
        return {
          name: c[finalIdx.name] || "Unknown",
          code: c[finalIdx.code] || "",
          qty: cleanNum(c[finalIdx.qty]),
          avg: cleanNum(c[finalIdx.avg]),
          current: cleanNum(c[finalIdx.current])
        };
      }).filter(s => s.qty > 0);

      if (parsed.length === 0) {
        setErrorMsg("보유 수량이 0인 데이터만 있거나, 열 위치를 찾지 못했습니다.");
      } else {
        setErrorMsg("");
      }

      setStocks(parsed);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setErrorMsg("구글 시트 연결 실패");
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-white font-black animate-pulse">
      {errorMsg || "ASSET SYNCING..."}
    </div>
  );

  const totalVal = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
  const totalProfit = totalVal - totalBuy;
  const yieldRate = totalBuy > 0 ? ((totalProfit / totalBuy) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <header className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">SEOKYEONGWON ASSETS</h1>
            <p className="text-slate-500 text-[10px] mt-2 font-bold tracking-widest uppercase opacity-70">LG MDI Accounting Dept</p>
          </div>
          <div className="text-[10px] text-sky-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full font-mono font-bold">
            LIVE: {lastUpdated}
          </div>
        </header>

        {errorMsg && (
          <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-2xl mb-8 text-red-400 text-sm font-bold text-center">
            ⚠️ {errorMsg} (구글 시트의 첫 줄 제목을 확인해 주세요)
          </div>
        )}

        {/* Total Stats Card */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-indigo-900 p-10 rounded-[48px] shadow-2xl mb-10 relative overflow-hidden group border border-white/5">
          <div className="relative z-10">
            <p className="text-blue-100/60 text-[10px] font-black mb-3 uppercase tracking-[0.2em]">Asset Valuation</p>
            <h2 className="text-6xl font-black text-white mb-10 tracking-tighter">
              {Math.round(totalVal).toLocaleString()} <span className="text-2xl font-light opacity-60 ml-1 font-sans">원</span>
            </h2>
            <div className="grid grid-cols-2 gap-10 border-t border-white/10 pt-8">
              <div>
                <p className="text-blue-100/40 text-[10px] font-black uppercase mb-2 tracking-widest">평가 손익</p>
                <p className="text-3xl font-black text-white leading-none">
                  {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-blue-100/40 text-[10px] font-black uppercase mb-2 tracking-widest">수익률</p>
                <p className="text-3xl font-black text-white leading-none">{yieldRate}%</p>
              </div>
            </div>
          </div>
          <div className="absolute right-[-20px] bottom-[-40px] text-white/5 text-[14rem] font-black italic select-none pointer-events-none group-hover:scale-110 transition-transform duration-1000">KRW</div>
        </div>

        {/* Asset Table */}
        <div className="bg-[#161a22] rounded-[48px] border border-slate-800 overflow-hidden shadow-2xl">
          <div className="px-10 py-8 border-b border-slate-800 font-black text-white flex justify-between items-center bg-slate-900/40">
            <span>Portfolio Holdings ({stocks.length})</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] text-emerald-400 font-black tracking-widest uppercase">Connected</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-600 text-[10px] uppercase font-black tracking-widest border-b border-slate-800 bg-slate-900/20">
                  <th className="px-10 py-5">Stock</th>
                  <th className="px-10 py-5 text-center">Qty / Avg</th>
                  <th className="px-10 py-5 text-right">Profit / Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stocks.sort((a,b) => (b.current*b.qty)-(a.current*a.qty)).map((s, i) => {
                  const sYield = ((s.current - s.avg) / s.avg * 100).toFixed(2);
                  const sProfit = (s.current - s.avg) * s.qty;
                  const isUp = parseFloat(sYield) >= 0;
                  return (
                    <tr key={i} className="hover:bg-white/[0.03] transition-all group">
                      <td className="px-10 py-7">
                        <div className="font-black text-white group-hover:text-blue-400 transition-colors text-base mb-1">{s.name}</div>
                        <div className="text-[10px] text-slate-600 font-mono font-bold tracking-widest uppercase">{s.code}</div>
                      </td>
                      <td className="px-10 py-7 text-center">
                        <div className="text-sm font-black text-slate-300 mb-1">{s.qty.toLocaleString()} <span className="text-[10px] opacity-30 font-normal">주</span></div>
                        <div className="text-[9px] text-slate-600 font-black uppercase tracking-tighter">AVG: {Math.round(s.avg).toLocaleString()}</div>
                      </td>
                      <td className={`px-10 py-7 text-right font-black ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                        <div className="text-xl tracking-tighter leading-none mb-2 font-sans">{isUp ? '▲' : '▼'} {sYield}%</div>
                        <div className="text-[10px] opacity-70 font-bold tracking-tight">{isUp ? '+' : ''}{Math.round(sProfit).toLocaleString()} 원</div>
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
