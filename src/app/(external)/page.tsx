"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, LayoutDashboard, Briefcase } from 'lucide-react';

// 통합 자산 데이터 정의
const INITIAL_STOCKS = [
  { name: "삼천당제약", code: "000250", qty: 41, avg: 428801, current: 435000 },
  { name: "삼성전자", code: "005930", qty: 460, avg: 134408, current: 84200 },
  { name: "SK하이닉스", code: "000660", qty: 40, avg: 836150, current: 188000 },
  { name: "SK텔레콤", code: "017670", qty: 100, avg: 68400, current: 52000 },
  { name: "현대차", code: "005380", qty: 20, avg: 249246, current: 242000 },
  { name: "KODEX 코스닥150레버리지", code: "233740", qty: 600, avg: 14609, current: 15200 },
  { name: "TIME 코스닥액티브", code: "461580", qty: 387, avg: 12132, current: 12500 },
  { name: "KODEX 반도체레버리지", code: "263370", qty: 185, avg: 66401, current: 68000 },
  { name: "지아이이노베이션", code: "358570", qty: 200, avg: 17332, current: 16500 },
  { name: "TIGER AI전력인프라", code: "485290", qty: 40, avg: 20885, current: 21500 },
  { name: "TIGER 글로벌AI액티브", code: "471150", qty: 25, avg: 23840, current: 24500 },
  { name: "TIGER 미국S&P500", code: "360750", qty: 55, avg: 25260, current: 26000 },
  { name: "TIGER 미국나스닥100", code: "133690", qty: 7, avg: 167645, current: 172000 },
];

export default function SeokyeongwonDashboard() {
  const [stocks, setStocks] = useState(INITIAL_STOCKS);
  const [totalValue, setTotalValue] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  useEffect(() => {
    // 💡 실시간 주가 변동 시뮬레이션 (구글 시트 연동 전까지)
    const interval = setInterval(() => {
      setStocks(prev => prev.map(s => ({
        ...s,
        current: s.current * (1 + (Math.random() * 0.002 - 0.001)) // 0.1% 범위 내 변동
      })));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const totalVal = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
    const totalBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
    setTotalValue(totalVal);
    setTotalProfit(totalVal - totalBuy);
  }, [stocks]);

  const totalYield = ((totalProfit / (totalValue - totalProfit)) * 100).toFixed(2);

  return (
    <div className="min-h-screen bg-[#0c0e12] text-white p-6 md:p-10 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter italic">SEOKYEONGWON ASSETS</h1>
          <p className="text-gray-500 mt-1">LG MDI Accounting Dept · Investment Portfolio</p>
        </div>
        <div className="flex gap-2 bg-[#161a22] p-1 rounded-xl border border-gray-800 text-xs">
          <button className="px-4 py-2 bg-sky-600 rounded-lg font-bold">전체</button>
          <button className="px-4 py-2 text-gray-500 hover:text-white">국내주식</button>
          <button className="px-4 py-2 text-gray-500 hover:text-white">해외주식</button>
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 bg-gradient-to-br from-sky-600 to-indigo-700 p-8 rounded-[32px] shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-sky-100/80 text-sm font-medium mb-1">총 자산 가치</p>
            <h2 className="text-5xl font-black mb-6">
              {Math.round(totalValue).toLocaleString()} <span className="text-2xl font-normal opacity-70">KRW</span>
            </h2>
            <div className="flex gap-6">
              <div>
                <p className="text-sky-100/60 text-xs uppercase tracking-wider mb-1">총 수익금</p>
                <p className="text-xl font-bold">+{Math.round(totalProfit).toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-sky-100/60 text-xs uppercase tracking-wider mb-1">총 수익률</p>
                <p className="text-xl font-bold">{totalYield}%</p>
              </div>
            </div>
          </div>
          <Wallet className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/10 rotate-12" />
        </div>
        
        <div className="bg-[#161a22] p-8 rounded-[32px] border border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-gray-400 text-sm font-bold mb-4 uppercase">Top Sector</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">반도체 / Tech</span>
                <span className="text-sky-400 font-bold">45%</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full w-[45%]"></div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm">바이오 / Bio</span>
                <span className="text-emerald-400 font-bold">32%</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[32%]"></div>
              </div>
            </div>
          </div>
          <button className="w-full py-4 mt-6 bg-gray-800 hover:bg-gray-700 rounded-2xl text-sm font-bold transition-all">
            섹터 상세 분석 보기
          </button>
        </div>
      </div>

      {/* Stock List Section */}
      <div className="bg-[#161a22] rounded-[32px] border border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h3 className="font-bold">Holdings ({stocks.length})</h3>
          <span className="text-xs text-sky-500 animate-pulse font-mono">● LIVE TICKER ACTIVE</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
                <th className="px-6 py-4 font-medium">종목명</th>
                <th className="px-6 py-4 font-medium">보유량</th>
                <th className="px-6 py-4 font-medium">평균단가</th>
                <th className="px-6 py-4 font-medium">현재가</th>
                <th className="px-6 py-4 font-medium text-right">수익률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.sort((a, b) => (b.current * b.qty) - (a.current * a.qty)).map((stock) => {
                const yieldRate = ((stock.current - stock.avg) / stock.avg * 100).toFixed(2);
                const isUp = Number(yieldRate) >= 0;
                
                return (
                  <tr key={stock.code} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-bold group-hover:text-sky-400 transition-colors">{stock.name}</div>
                      <div className="text-xs text-gray-600 font-mono mt-0.5">{stock.code}</div>
                    </td>
                    <td className="px-6 py-5 text-sm font-medium">{stock.qty}주</td>
                    <td className="px-6 py-5 text-sm text-gray-400">{Math.round(stock.avg).toLocaleString()}원</td>
                    <td className="px-6 py-5 font-bold text-sm">
                      {Math.round(stock.current).toLocaleString()}원
                    </td>
                    <td className={`px-6 py-5 text-right font-black ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {yieldRate}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
