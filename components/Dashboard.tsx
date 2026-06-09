import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Tx, loadTransactions, saveTransactions, eur, eur2, uid } from "../lib/store";

export default function Dashboard() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Essen");

  useEffect(() => { setTxs(loadTransactions()); }, []);

  const income = useMemo(() => txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [txs]);
  const expense = useMemo(() => txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [txs]);
  const balance = income - expense;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    txs.filter(t => t.amount < 0).forEach(t => {
      m.set(t.category, (m.get(t.category) || 0) + Math.abs(t.amount));
    });
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txs]);

  const palette = ["#3b82f6", "#22d3ee", "#34d399", "#f59e0b", "#f87171", "#a78bfa"];

  const addTx = () => {
    const val = parseFloat(amount.replace(",", "."));
    if (!desc.trim() || isNaN(val)) return;
    const next = [
      { id: uid(), date: new Date().toISOString().slice(0, 10), desc: desc.trim(), category, amount: val },
      ...txs,
    ];
    setTxs(next); saveTransactions(next);
    setDesc(""); setAmount("");
  };

  const removeTx = (id: string) => {
    const next = txs.filter(t => t.id !== id);
    setTxs(next); saveTransactions(next);
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Bilanz (Monat)" value={eur(balance)} tone={balance >= 0 ? "good" : "bad"} />
        <Kpi label="Einnahmen" value={eur(income)} tone="good" />
        <Kpi label="Ausgaben" value={eur(expense)} tone="bad" />
      </div>

      {/* Chart */}
      <div className="card p-5">
        <div className="font-semibold mb-4">Ausgaben nach Kategorie</div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243049" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#8b98b3", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8b98b3", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(59,130,246,0.08)" }}
                contentStyle={{ background: "#121826", border: "1px solid #243049", borderRadius: 12 }}
                formatter={(v: number) => eur2(v)}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {byCategory.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Add transaction */}
      <div className="card p-5">
        <div className="font-semibold mb-4">Transaktion hinzufügen</div>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-3">
          <input className="input" placeholder="Beschreibung" value={desc} onChange={e => setDesc(e.target.value)} />
          <input className="input" placeholder="Betrag (z.B. -50)" value={amount} onChange={e => setAmount(e.target.value)} />
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            {["Einkommen", "Wohnen", "Essen", "Freizeit", "Investment", "Sonstiges"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="btn" onClick={addTx}>Hinzufügen</button>
        </div>
        <div className="text-xs text-muted mt-2">Tipp: positiver Betrag = Einnahme, negativer = Ausgabe.</div>
      </div>

      {/* Transactions */}
      <div className="card p-5">
        <div className="font-semibold mb-4">Letzte Transaktionen</div>
        <div className="divide-y divide-line/60">
          {txs.map(t => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{t.desc}</div>
                <div className="text-xs text-muted">{t.date} · {t.category}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className={t.amount >= 0 ? "text-good font-semibold" : "text-bad font-semibold"}>
                  {t.amount >= 0 ? "+" : ""}{eur2(t.amount)}
                </div>
                <button onClick={() => removeTx(t.id)} className="text-muted hover:text-bad text-sm">✕</button>
              </div>
            </div>
          ))}
          {txs.length === 0 && <div className="text-muted text-sm py-4">Noch keine Transaktionen.</div>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === "good" ? "text-good" : "text-bad"}`}>{value}</div>
    </div>
  );
}
