import { useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { eur, eur2 } from "../lib/store";

export default function InvestmentPlanner() {
  const [start, setStart] = useState(10000);
  const [monthly, setMonthly] = useState(800);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(7); // % p.a.

  const data = useMemo(() => {
    const r = rate / 100 / 12;
    const pts: { year: number; eingezahlt: number; wert: number }[] = [];
    let value = start;
    let contributed = start;
    pts.push({ year: 0, eingezahlt: Math.round(contributed), wert: Math.round(value) });
    for (let m = 1; m <= years * 12; m++) {
      value = value * (1 + r) + monthly;
      contributed += monthly;
      if (m % 12 === 0) {
        pts.push({ year: m / 12, eingezahlt: Math.round(contributed), wert: Math.round(value) });
      }
    }
    return pts;
  }, [start, monthly, years, rate]);

  const final = data[data.length - 1];
  const totalContributed = final?.eingezahlt ?? 0;
  const finalValue = final?.wert ?? 0;
  const gain = finalValue - totalContributed;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Inputs */}
        <div className="card p-5 space-y-4">
          <div className="font-semibold">Parameter</div>
          <Field label={`Startkapital: ${eur(start)}`}>
            <input type="range" min={0} max={100000} step={500} value={start}
              onChange={e => setStart(+e.target.value)} className="w-full accent-accent" />
          </Field>
          <Field label={`Monatliche Sparrate: ${eur(monthly)}`}>
            <input type="range" min={0} max={3000} step={50} value={monthly}
              onChange={e => setMonthly(+e.target.value)} className="w-full accent-accent" />
          </Field>
          <Field label={`Laufzeit: ${years} Jahre`}>
            <input type="range" min={1} max={40} step={1} value={years}
              onChange={e => setYears(+e.target.value)} className="w-full accent-accent" />
          </Field>
          <Field label={`Rendite p.a.: ${rate}%`}>
            <input type="range" min={0} max={15} step={0.5} value={rate}
              onChange={e => setRate(+e.target.value)} className="w-full accent-accent" />
          </Field>
        </div>

        {/* Result */}
        <div className="card p-5">
          <div className="grid grid-cols-3 gap-4 mb-5">
            <Stat label="Endwert" value={eur(finalValue)} tone="accent" />
            <Stat label="Eingezahlt" value={eur(totalContributed)} tone="muted" />
            <Stat label="Zinsgewinn" value={eur(gain)} tone="good" />
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b98b3" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#8b98b3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#243049" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: "#8b98b3", fontSize: 12 }} axisLine={false} tickLine={false}
                  tickFormatter={(y) => `${y}J`} />
                <YAxis tick={{ fill: "#8b98b3", fontSize: 12 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ background: "#121826", border: "1px solid #243049", borderRadius: 12 }}
                  formatter={(v: number, n) => [eur2(v), n === "wert" ? "Depotwert" : "Eingezahlt"]}
                  labelFormatter={(l) => `Jahr ${l}`}
                />
                <Area type="monotone" dataKey="eingezahlt" stroke="#8b98b3" fill="url(#g2)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="wert" stroke="#3b82f6" fill="url(#g1)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted mt-3">
            Zinseszins, monatliche Verzinsung. Reine Modellrechnung — keine Anlageberatung.
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-sm mb-2">{label}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "accent" | "good" | "muted" }) {
  const color = tone === "accent" ? "text-white" : tone === "good" ? "text-good" : "text-muted";
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
