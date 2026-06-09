import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Tx, loadTransactions, saveTransactions, eur, eur2, uid } from "../lib/store";
import CountUp from "./CountUp";

export default function Dashboard() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [ready, setReady] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [txType, setTxType] = useState<"expense" | "income">("expense");

  useEffect(() => { loadTransactions().then(t => { setTxs(t); setReady(true); }); }, []);

  const categorySuggestions = useMemo(() => {
    const defaults = ["Einkommen", "Wohnen", "Essen", "Freizeit", "Investment", "Sonstiges"];
    return Array.from(new Set([...defaults, ...txs.map(t => t.category)]));
  }, [txs]);

  const income = useMemo(() => txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [txs]);
  const expense = useMemo(() => txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [txs]);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.max(0, (balance / income) * 100) : 0;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    txs.filter(t => t.amount < 0).forEach(t => m.set(t.category, (m.get(t.category) || 0) + Math.abs(t.amount)));
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txs]);

  const palette = ["#F5B544", "#5EEAD4", "#A78BFA", "#FB7185", "#60A5FA", "#FBBF24"];

  const addTx = () => {
    const raw = parseFloat(amount.replace(",", "."));
    const cat = category.trim() || "Sonstiges";
    if (!desc.trim() || isNaN(raw)) return;
    const signed = txType === "income" ? Math.abs(raw) : -Math.abs(raw);
    const next = [{ id: uid(), date: new Date().toISOString().slice(0, 10), desc: desc.trim(), category: cat, amount: signed }, ...txs];
    setTxs(next); saveTransactions(next);
    setDesc(""); setAmount(""); setCategory("");
  };

  const removeTx = (id: string) => {
    const next = txs.filter(t => t.id !== id);
    setTxs(next); saveTransactions(next);
  };

  return (
    <div className="space-y-5">
      {/* Hero KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <div className="card card-hl p-6">
          <div className="text-sm text-muted">Netto-Bilanz · diesen Monat</div>
          <div className={`display text-4xl font-bold mt-2 ${balance >= 0 ? "text-gold" : "text-bad"}`}>
            {ready ? <CountUp value={balance} format={eur} /> : "—"}
          </div>
          <div className="text-xs text-muted mt-3">
            Sparquote <span className="num text-mint">{savingsRate.toFixed(0)}%</span> deines Einkommens
          </div>
        </div>
        <Kpi label="Einnahmen" value={income} tone="mint" ready={ready} />
        <Kpi label="Ausgaben" value={expense} tone="bad" ready={ready} />
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="font-semibold display mb-5">Ausgaben nach Kategorie</div>
        {byCategory.length === 0 ? (
          <div className="text-muted text-sm py-10 text-center">Noch keine Ausgaben erfasst.</div>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={byCategory} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#8794B0", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip cursor={{ fill: "rgba(245,181,68,0.06)" }}
                  contentStyle={{ background: "#0C1322", border: "1px solid #26314D", borderRadius: 12, fontFamily: "var(--font-mono)" }}
                  formatter={(v) => eur2(Number(v))} />
                <Bar dataKey="value" radius={[7, 7, 0, 0]} maxBarSize={56}>
                  {byCategory.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Add transaction */}
      <div className="card p-6">
        <div className="font-semibold display mb-4">Transaktion erfassen</div>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setTxType("expense")}
            className={`chip ${txType === "expense" ? "!text-white" : ""}`}
            style={txType === "expense" ? { background: "rgba(251,113,133,0.15)", borderColor: "#FB7185", color: "#fff" } : {}}>− Ausgabe</button>
          <button onClick={() => setTxType("income")}
            className={`chip ${txType === "income" ? "!text-white" : ""}`}
            style={txType === "income" ? { background: "rgba(94,234,212,0.15)", borderColor: "#5EEAD4", color: "#fff" } : {}}>+ Einnahme</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.4fr_auto] gap-3">
          <input className="input" placeholder="Beschreibung" value={desc} onChange={e => setDesc(e.target.value)} />
          <input className="input num" placeholder="Betrag z.B. 1000" value={amount} onChange={e => setAmount(e.target.value)} />
          <input className="input" placeholder="Kategorie (frei wählbar)" list="cat-list" value={category} onChange={e => setCategory(e.target.value)} />
          <datalist id="cat-list">{categorySuggestions.map(c => <option key={c} value={c} />)}</datalist>
          <button className="btn" onClick={addTx}>Hinzufügen</button>
        </div>
        <div className="text-xs text-muted mt-2">Typ oben wählen, Betrag positiv eingeben. Kategorie frei tippen — bekannte werden vorgeschlagen.</div>
      </div>

      {/* Transactions */}
      <div className="card p-6">
        <div className="font-semibold display mb-4">Letzte Transaktionen</div>
        <div className="divide-y divide-line/50">
          {txs.map(t => (
            <div key={t.id} className="flex items-center justify-between py-3 group">
              <div>
                <div className="font-medium">{t.desc}</div>
                <div className="text-xs text-muted">{t.date} · {t.category}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`num font-semibold ${t.amount >= 0 ? "text-mint" : "text-ink2"}`}>
                  {t.amount >= 0 ? "+" : ""}{eur2(t.amount)}
                </div>
                <button onClick={() => removeTx(t.id)} className="text-muted hover:text-bad text-sm opacity-0 group-hover:opacity-100 transition">✕</button>
              </div>
            </div>
          ))}
          {ready && txs.length === 0 && <div className="text-muted text-sm py-4">Noch keine Transaktionen. Erfasse oben deine erste.</div>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, ready }: { label: string; value: number; tone: "mint" | "bad"; ready: boolean }) {
  return (
    <div className="card p-6">
      <div className="text-sm text-muted">{label}</div>
      <div className={`display text-2xl font-bold mt-2 ${tone === "mint" ? "text-mint" : "text-bad"}`}>
        {ready ? <CountUp value={value} format={eur} /> : "—"}
      </div>
    </div>
  );
}
