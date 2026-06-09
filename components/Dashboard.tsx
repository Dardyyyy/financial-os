import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { Tx, Currency, loadTransactions, saveTransactions, getFxMap, eur, eur2, money, uid } from "../lib/store";
import CountUp from "./CountUp";

const CURRENCIES: Currency[] = ["EUR", "USD", "CHF"];

export default function Dashboard() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [ready, setReady] = useState(false);
  const [fxMap, setFxMap] = useState<Record<string, number>>({ EUR: 1, USD: 0.92, CHF: 1.05 });
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [curr, setCurr] = useState<Currency>("EUR");

  useEffect(() => {
    loadTransactions().then(t => { setTxs(t); setReady(true); });
    getFxMap(["USD", "CHF"]).then(setFxMap);
  }, []);

  const toEur = (amt: number, c: Currency) => amt * (fxMap[c] ?? 1);

  const categorySuggestions = useMemo(() => {
    const d = ["Einkommen", "Wohnen", "Essen", "Freizeit", "Investment", "Sonstiges"];
    return Array.from(new Set([...d, ...txs.map(t => t.category)]));
  }, [txs]);

  const income = useMemo(() => txs.filter(t => t.amount > 0).reduce((s, t) => s + toEur(t.amount, t.currency), 0), [txs, fxMap]);
  const expense = useMemo(() => txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(toEur(t.amount, t.currency)), 0), [txs, fxMap]);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.max(0, (balance / income) * 100) : 0;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    txs.filter(t => t.amount < 0).forEach(t => m.set(t.category, (m.get(t.category) || 0) + Math.abs(toEur(t.amount, t.currency))));
    return Array.from(m, ([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [txs, fxMap]);

  const palette = ["#F5B544", "#5EEAD4", "#A78BFA", "#FB7185", "#60A5FA", "#FBBF24"];

  const addTx = () => {
    const raw = parseFloat(amount.replace(",", "."));
    const cat = category.trim() || "Sonstiges";
    if (!desc.trim() || isNaN(raw)) return;
    const signed = txType === "income" ? Math.abs(raw) : -Math.abs(raw);
    const next = [{ id: uid(), date: new Date().toISOString().slice(0, 10), desc: desc.trim(), category: cat, amount: signed, currency: curr }, ...txs];
    setTxs(next); saveTransactions(next);
    setDesc(""); setAmount(""); setCategory("");
  };
  const removeTx = (id: string) => { const n = txs.filter(t => t.id !== id); setTxs(n); saveTransactions(n); };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <div className="card card-hl p-6">
          <div className="text-sm text-muted">Netto-Bilanz · diesen Monat</div>
          <div className={`display text-4xl font-bold mt-2 ${balance >= 0 ? "text-gold" : "text-bad"}`}>{ready ? <CountUp value={balance} format={eur} /> : "—"}</div>
          <div className="text-xs text-muted mt-3">Sparquote <span className="num text-mint">{savingsRate.toFixed(0)}%</span></div>
        </div>
        <Kpi label="Einnahmen" value={income} tone="mint" ready={ready} />
        <Kpi label="Ausgaben" value={expense} tone="bad" ready={ready} />
      </div>

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
                <YAxis tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  cursor={{ fill: "rgba(245,181,68,0.07)" }}
                  contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12, padding: "10px 12px" }}
                  labelStyle={{ color: "#F5B544", fontWeight: 700, marginBottom: 4, fontSize: 13 }}
                  itemStyle={{ color: "#FFFFFF", fontSize: 14, fontFamily: "var(--font-mono)" }}
                  formatter={(v) => [eur2(Number(v)), "Ausgaben"]}
                />
                <Bar dataKey="value" radius={[7, 7, 0, 0]} maxBarSize={56}>
                  {byCategory.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="font-semibold display mb-4">Transaktion erfassen</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={() => setTxType("expense")} className="chip" style={txType === "expense" ? { background: "rgba(251,113,133,0.15)", borderColor: "#FB7185", color: "#fff" } : {}}>− Ausgabe</button>
          <button onClick={() => setTxType("income")} className="chip" style={txType === "income" ? { background: "rgba(94,234,212,0.15)", borderColor: "#5EEAD4", color: "#fff" } : {}}>+ Einnahme</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto_1.4fr_auto] gap-3">
          <input className="input" placeholder="Beschreibung" value={desc} onChange={e => setDesc(e.target.value)} />
          <input className="input num" placeholder="Betrag z.B. 1000" value={amount} onChange={e => setAmount(e.target.value)} />
          <select className="input" value={curr} onChange={e => setCurr(e.target.value as Currency)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input" placeholder="Kategorie (frei wählbar)" list="cat-list" value={category} onChange={e => setCategory(e.target.value)} />
          <datalist id="cat-list">{categorySuggestions.map(c => <option key={c} value={c} />)}</datalist>
          <button className="btn" onClick={addTx}>Hinzufügen</button>
        </div>
      </div>

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
                <div className="text-right">
                  <div className={`num font-semibold ${t.amount >= 0 ? "text-mint" : "text-ink2"}`}>{t.amount >= 0 ? "+" : ""}{money(t.amount, t.currency)}</div>
                  {t.currency !== "EUR" && <div className="num text-[11px] text-muted">≈ {eur2(t.amount * (fxMap[t.currency] ?? 1))}</div>}
                </div>
                <button onClick={() => removeTx(t.id)} className="text-muted hover:text-bad text-sm opacity-0 group-hover:opacity-100 transition">✕</button>
              </div>
            </div>
          ))}
          {ready && txs.length === 0 && <div className="text-muted text-sm py-4">Noch keine Transaktionen.</div>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, ready }: { label: string; value: number; tone: "mint" | "bad"; ready: boolean }) {
  return (
    <div className="card p-6">
      <div className="text-sm text-muted">{label}</div>
      <div className={`display text-2xl font-bold mt-2 ${tone === "mint" ? "text-mint" : "text-bad"}`}>{ready ? <CountUp value={value} format={eur} /> : "—"}</div>
    </div>
  );
}
