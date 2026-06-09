import { useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { eur, eur2 } from "../lib/store";
import CountUp from "./CountUp";

export default function InvestmentPlanner() {
  const [start, setStart] = useState(10000);
  const [monthly, setMonthly] = useState(800);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(7);

  const data = useMemo(() => {
    const r = rate / 100 / 12;
    const pts: { year: number; eingezahlt: number; wert: number }[] = [];
    let value = start, contributed = start;
    pts.push({ year: 0, eingezahlt: Math.round(contributed), wert: Math.round(value) });
    for (let m = 1; m <= years * 12; m++) {
      value = value * (1 + r) + monthly;
      contributed += monthly;
      if (m % 12 === 0) pts.push({ year: m / 12, eingezahlt: Math.round(contributed), wert: Math.round(value) });
    }
    return pts;
  }, [start, monthly, years, rate]);

  const final = data[data.length - 1];
  const totalContributed = final?.eingezahlt ?? 0;
  const finalValue = final?.wert ?? 0;
  const gain = finalValue - totalContributed;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-5">
      <div className="card p-6 space-y-5">
        <div className="font-semibold display">Parameter</div>
        <Slider label="Startkapital" value={eur(start)}>
          <input type="range" min={0} max={100000} step={500} value={start} onChange={e => setStart(+e.target.value)} className="w-full accent-gold" />
        </Slider>
        <Slider label="Monatliche Sparrate" value={eur(monthly)}>
          <input type="range" min={0} max={3000} step={50} value={monthly} onChange={e => setMonthly(+e.target.value)} className="w-full accent-gold" />
        </Slider>
        <Slider label="Laufzeit" value={`${years} Jahre`}>
          <input type="range" min={1} max={40} step={1} value={years} onChange={e => setYears(+e.target.value)} className="w-full accent-gold" />
        </Slider>
        <Slider label="Rendite p.a." value={`${rate}%`}>
          <input type="range" min={0} max={15} step={0.5} value={rate} onChange={e => setRate(+e.target.value)} className="w-full accent-gold" />
        </Slider>
      </div>

      <div className="card card-hl p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Stat label="Endwert" tone="gold"><CountUp value={finalValue} format={eur} /></Stat>
          <Stat label="Eingezahlt" tone="muted"><CountUp value={totalContributed} format={eur} /></Stat>
          <Stat label="Zinsgewinn" tone="mint"><CountUp value={gain} format={eur} /></Stat>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="gWert" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5B544" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#F5B544" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gEin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5EEAD4" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#5EEAD4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#8794B0", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(y) => `${y}J`} />
              <YAxis tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #26314D", borderRadius: 12, fontFamily: "var(--font-mono)" }}
                formatter={(v, n) => [eur2(Number(v)), n === "wert" ? "Depotwert" : "Eingezahlt"]} labelFormatter={(l) => `Jahr ${l}`} />
              <Area type="monotone" dataKey="eingezahlt" stroke="#5EEAD4" fill="url(#gEin)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="wert" stroke="#F5B544" fill="url(#gWert)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-muted mt-3">Zinseszins, monatliche Verzinsung. Reine Modellrechnung — keine Anlageberatung.</div>
      </div>
    </div>
  );
}

function Slider({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-muted">{label}</span>
        <span className="num text-ink2 font-semibold">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, tone, children }: { label: string; tone: "gold" | "mint" | "muted"; children: ReactNode }) {
  const color = tone === "gold" ? "text-gold" : tone === "mint" ? "text-mint" : "text-muted";
  return (
    <div>
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`display text-xl font-bold ${color}`}>{children}</div>
    </div>
  );
}
