"use client";

import React, { useState, useEffect } from 'react';

export default function SeokyeongwonLiveDashboard() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub?gid=0&single=true&output=csv";

  const fetchData = async () => {
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);
      const dataRows = rows.slice(1);

      const parsed = dataRows.map(row => {
        const columns = row.split(',').map(col => col.replace(/"/g, '').trim());
        return {
          name: columns[0],
          code: columns[1],
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
    <div style={{backgroundColor: '#0c0e12', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif'}}>
      <p style={{fontSize: '1.5rem', fontWeight: 'bold'}}>CONNECTING TO ASSETS...</p>
    </div>
  );

  const totalValue = stocks.reduce((acc, s) => acc + (s.current * s.qty), 0);
  const totalBuy = stocks.reduce((acc, s) => acc + (s.avg * s.qty), 0);
  const totalProfit = totalValue - totalBuy;
  const totalYield = totalBuy > 0 ? ((totalProfit / totalBuy) * 100).toFixed(2) : "0.00";

  return (
    <div style={{backgroundColor: '#0c0e12', color: '#e2e8f0', minHeight: '100vh', padding: '40px 20px', fontFamily: 'sans-serif'}}>
      <div style={{maxWidth: '1100px', margin: '0 auto'}}>
        
        {/* Header */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px'}}>
          <div>
            <h1 style={{fontSize: '2rem', fontWeight: '900', color: 'white', margin: 0, fontStyle: 'italic'}}>SEOKYEONGWON ASSETS</h1>
            <p style={{color: '#64748b', fontSize: '0.9rem', marginTop: '5px'}}>LG MDI Accounting Dept · Real-time Portfolio</p>
          </div>
          <div style={{fontSize: '0.7rem', color: '#38bdf8', border: '1px solid #1e293b', padding: '8px 15px', borderRadius: '15px', backgroundColor: '#161a22'}}>
            LIVE STATUS: {lastUpdated}
          </div>
        </div>

        {/* Main Card */}
        <div style={{background: 'linear-gradient(135deg, #2563eb, #4338ca)', padding: '40px', borderRadius: '30px', marginBottom: '30px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'}}>
          <p style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#dbeafe', marginBottom: '10px', letterSpacing: '2px'}}>CURRENT ASSET VALUE</p>
          <h2 style={{fontSize: '3.5rem', fontWeight: '900', color: 'white', margin: '0 0 30px 0'}}>
            {Math.round(totalValue).toLocaleString()} <span style={{fontSize: '1.5rem', fontWeight: 'normal', opacity: 0.7}}>KRW</span>
          </h2>
          <div style={{display: 'flex', gap: '40px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px'}}>
            <div>
              <p style={{fontSize: '0.7rem', color: '#bfdbfe', margin: '0 0 5px 0'}}>PROFIT/LOSS (평가손익)</p>
              <p style={{fontSize: '1.5rem', fontWeight: 'bold', color: 'white', margin: 0}}>{totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}원</p>
            </div>
            <div>
              <p style={{fontSize: '0.7rem', color: '#bfdbfe', margin: '0 0 5px 0'}}>TOTAL YIELD (%)</p>
              <p style={{fontSize: '1.5rem', fontWeight: 'bold', color: 'white', margin: 0}}>{totalYield}%</p>
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div style={{backgroundColor: '#161a22', borderRadius: '30px', border: '1px solid #1e293b', overflow: 'hidden'}}>
          <div style={{padding: '20px 30px', borderBottom: '1px solid #1e293b', fontWeight: 'bold', color: 'white'}}>
            HOLDINGS ({stocks.length})
          </div>
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #1e293b'}}>
                  <th style={{padding: '20px 30px'}}>Asset</th>
                  <th style={{padding: '20px 30px'}}>Quantity</th>
                  <th style={{padding: '20px 30px'}}>Price (Avg/Current)</th>
                  <th style={{padding: '20px 30px', textAlign: 'right'}}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock, idx) => {
                  const profit = (stock.current - stock.avg) * stock.qty;
                  const yieldRate = ((stock.current - stock.avg) / stock.avg * 100).toFixed(2);
                  const isUp = parseFloat(yieldRate) >= 0;
                  return (
                    <tr key={idx} style={{borderBottom: '1px solid #0f172a'}}>
                      <td style={{padding: '25px 30px'}}>
                        <div style={{fontWeight: 'bold', color: 'white'}}>{stock.name}</div>
                        <div style={{fontSize: '0.7rem', color: '#475569', marginTop: '4px'}}>{stock.code}</div>
                      </td>
                      <td style={{padding: '25px 30px', fontSize: '0.9rem'}}>{stock.qty.toLocaleString()} 주</td>
                      <td style={{padding: '25px 30px'}}>
                        <div style={{fontSize: '0.7rem', color: '#475569', marginBottom: '4px'}}>AVG: {Math.round(stock.avg).toLocaleString()}</div>
                        <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#f1f5f9'}}>{Math.round(stock.current).toLocaleString()} 원</div>
                      </td>
                      <td style={{padding: '25px 30px', textAlign: 'right', fontWeight: 'bold', color: isUp ? '#f43f5e' : '#3b82f6'}}>
                        <div style={{fontSize: '1.1rem'}}>{isUp ? '▲' : '▼'} {yieldRate}%</div>
                        <div style={{fontSize: '0.7rem', opacity: 0.8, marginTop: '4px'}}>{Math.round(profit).toLocaleString()} 원</div>
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
