"use client";

import React, { useState, useEffect } from 'react';

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

  // 콤마 제거 후 숫자로 변환하는 안전한 함수
  const parseSafeFloat = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/,/g, '')) || 0;
  };

  const fetchData = async () => {
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);
      const dataRows = rows.slice(1);

      const parsed: Stock[] = dataRows.map(row => {
        const columns = row.split(',').map(col => col.replace(/"/g, '').trim());
        
        // 시트 기준: A(이름:0), B(티커:1), C(수량:2), D(평단:3), E(현재가:4)
        return {
          name: columns[0] || "",
          code: columns[1] || "",
          qty: parseSafeFloat(columns[2]),
          avg: parseSafeFloat(columns[3]),
          current: parseSafeFloat(columns[4])
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
      <p className="text-xl font-bold tracking-widest animate-pulse">ASSET DATA UPDATING...</p>
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
            <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">석경원 자산 대시보드</h1>
            <p className="text-slate-500 text-xs mt-1">LG MDI 회계부 · 실시간 데이터 연동</p>
          </div>
          <div className="text-[10px] text-sky-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            마지막 업데이트: {lastUpdated}
          </div>
        </div>

        {/* Total Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-[40px] shadow-2xl mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-blue-100/70 text-xs font-bold uppercase tracking-widest mb-2">총 평가 금액</p>
            <h2 className="text-5xl font-black text-white mb-8 tracking-tighter">
              {Math.round(totalValue).toLocaleString()} <span className="text-xl font-normal opacity-60">원</span>
            </h2>
            <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
              <div>
                <p className="text-blue-100/50 text-[10px] font-bold uppercase mb-1">총 손익</p>
                <p className="text-2xl font-black text-white">
                  {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-blue-100/50 text-[10px] font-bold uppercase mb-1">수익
