import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { BudgetData, Currency, loadBudget, saveBudget, loadSettings, saveSettings, fmt, fmt2, uid, parseAmount} from "../lib/store";
import CountUp from "./CountUp";
import CurrencySelect from "./CurrencySelect";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default function Budget() {
  const [data, setData] = useState<BudgetData>({ income: 0, fixed: [], oneTime: [] });
  const [ready, setReady] = useState(false);

  // Eingabe-Felder
  const [fName, setFName] = useState(""); const [fAmt, setFAmt] = useState("");
  const [oName, setOName] = useState(""); const [oAmt, setOAmt] = useState(""); const [oMonth, setOMonth] = useState(1);
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1); // ab welchem Monat das Diagramm startet
  const [cur, setCur] = useState<Currency>("CHF");

  useEffect(() => {
    loadSettings().then(st => setCur(st.mainCurrency));
    loadBudget().then(d => { setData(d); if (d.currency) setCur(d.currency); setReady(true); });
  }, []);
  const e = (n: number) => fmt(n, cur);
  const e2 = (n: number) => fmt2(n, cur);
  const sym = cur === "EUR" ? "€" : cur === "USD" ? "$" : "CHF";
  const changeCur = (c: Currency) => { setCur(c); saveSettings({ mainCurrency: c }); persist({ ...data, currency: c }); };
  const persist = (d: BudgetData) => { setData(d); saveBudget(d); };

  const fixedTotal = useMemo(() => data.fixed.reduce((s, f) => s + (f.amount || 0), 0), [data.fixed]);
  const annualOneTime = useMemo(() => data.oneTime.reduce((s, o) => s + (o.amount || 0), 0), [data.oneTime]);
  const ruecklage = annualOneTime / 12;                          // Sparbetrag/Monat für einmalige Kosten (Sinking Fund)
  const freiZumAnlegen = data.income - fixedTotal - ruecklage;   // geglätteter Überschuss

  // 12-Monats-Verlauf ab gewähltem Startmonat (rollierend)
  const months = useMemo(() => {
    let bal = 0, reserve = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const cm = ((startMonth - 1 + i) % 12) + 1;          // Kalendermonat 1..12
      const label = MONTHS[cm - 1];
      const einmalig = data.oneTime.filter(o => o.month === cm).reduce((s, o) => s + (o.amount || 0), 0);
      const frei = data.income - fixedTotal - einmalig;     // echter Cash-Überschuss des Monats
      bal += frei;
      reserve += ruecklage - einmalig;                      // Rücklagen-Konto (Sparen minus Abfluss)
      return { label, fix: Math.round(fixedTotal), einmalig: Math.round(einmalig), einnahmen: Math.round(data.income), frei: Math.round(frei), kontostand: Math.round(bal), reserve: Math.round(reserve) };
    });
  }, [data, fixedTotal, ruecklage, startMonth]);

  const minKonto = Math.min(...months.map(m => m.kontostand), 0);
  const minReserve = Math.min(...months.map(m => m.reserve), 0);
  const startpolster = Math.max(0, Math.ceil(-minReserve / 50) * 50);  // empfohlenes Startpolster, auf 50 gerundet

  const addFixed = () => { const a = parseAmount(fAmt); if (!fName.trim() || !a) return; persist({ ...data, fixed: [...data.fixed, { id: uid(), name: fName.trim(), amount: a }] }); setFName(""); setFAmt(""); };
  const editFixed = (id: string, amount: number) => persist({ ...data, fixed: data.fixed.map(f => f.id === id ? { ...f, amount } : f) });
  const rmFixed = (id: string) => persist({ ...data, fixed: data.fixed.filter(f => f.id !== id) });
  const addOne = () => { const a = parseAmount(oAmt); if (!oName.trim() || !a) return; persist({ ...data, oneTime: [...data.oneTime, { id: uid(), name: oName.trim(), amount: a, month: oMonth }] }); setOName(""); setOAmt(""); };
  const rmOne = (id: string) => persist({ ...data, oneTime: data.oneTime.filter(o => o.id !== id) });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <CurrencySelect value={cur} onChange={changeCur} />
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5"><div className="text-sm text-muted">Einkommen / Monat</div><div className="display text-2xl font-bold mt-1 num text-ink2">{ready ? <CountUp value={data.income} format={e} /> : "—"}</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Fixkosten / Monat</div><div className="display text-2xl font-bold mt-1 num text-bad">{ready ? <CountUp value={fixedTotal} format={e} /> : "—"}</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Ø Einmalkosten / Monat</div><div className="display text-2xl font-bold mt-1 num text-muted">{ready ? <CountUp value={ruecklage} format={e} /> : "—"}<div className="text-[10px] text-muted num mt-0.5">{e(annualOneTime)} / Jahr</div></div></div>
        <div className="card card-hl p-5"><div className="text-sm text-muted">Frei zum Anlegen</div><div className={`display text-2xl font-bold mt-1 num ${freiZumAnlegen >= 0 ? "text-mint" : "text-bad"}`}>{ready ? <CountUp value={freiZumAnlegen} format={e} /> : "—"}<div className="text-[10px] text-muted mt-0.5">pro Monat, geglättet</div></div></div>
      </div>

      {/* Empfehlung */}
      <div className="card card-hl p-6 space-y-3">
        <div className="display text-lg font-semibold">So legst du in naher Zukunft Geld zur Seite</div>
        {freiZumAnlegen >= 0 ? (
          <p className="text-sm text-ink2 leading-relaxed">
            Deine einmaligen Kosten von <b className="text-gold">{e(annualOneTime)}/Jahr</b> verteilst du am besten gleichmäßig:
            Leg dafür jeden Monat <b className="text-gold">{e(ruecklage)}</b> als <b>Rücklage</b> zur Seite (z.B. auf ein Tagesgeldkonto).
            Danach bleiben dir realistisch <b className="text-mint">{e(freiZumAnlegen)}/Monat</b> zum Investieren — diesen Betrag kannst du im <b>Planer</b> als Sparrate ansetzen.
          </p>
        ) : (
          <p className="text-sm text-bad leading-relaxed">
            Achtung: Fixkosten ({e(fixedTotal)}) + anteilige Einmalkosten ({e(ruecklage)}) übersteigen dein Einkommen ({e(data.income)}).
            Es fehlen rund <b>{e(-freiZumAnlegen)}/Monat</b>. Senke Fixkosten oder verschiebe einmalige Ausgaben, bevor du investierst.
          </p>
        )}
        {startpolster > 0 && freiZumAnlegen >= 0 && (
          <div className="text-xs text-muted border-t border-line/50 pt-3">
            💡 Manche Kosten fallen früh im Jahr an, bevor die Rücklage gewachsen ist. Mit einem <b className="text-ink2">Startpolster von ~{e(startpolster)}</b> bist du ganzjährig liquide und musst nie ins Minus.
          </div>
        )}
      </div>

      {/* 12-Monats-Chart */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div className="font-semibold display">Dein Jahr im Cashflow</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Start ab</span>
            <select className="input w-auto py-1.5 text-sm" value={startMonth} onChange={e => setStartMonth(+e.target.value)}>
              {MONTHS.map((mn, i) => <option key={mn} value={i + 1}>{mn}{i + 1 === (new Date().getMonth() + 1) ? " (dieser Monat)" : ""}</option>)}
            </select>
          </div>
        </div>
        <div className="text-xs text-muted mb-4">Balken = Ausgaben pro Monat (fix + einmalig), Linie = Kontostand-Verlauf ab <b className="text-ink2">{MONTHS[startMonth - 1]}</b>, wenn du den Überschuss liegen lässt.</div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <ComposedChart data={months} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8794B0", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12 }} labelStyle={{ color: "#F5B544" }} itemStyle={{ fontFamily: "var(--font-mono)" }}
                formatter={(v: any, n: string) => [e2(Number(v)), n === "fix" ? "Fixkosten" : n === "einmalig" ? "Einmalig" : n === "kontostand" ? "Kontostand" : n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === "fix" ? "Fixkosten" : v === "einmalig" ? "Einmalig" : "Kontostand"} />
              <ReferenceLine y={data.income} stroke="#5EEAD4" strokeDasharray="4 4" label={{ value: "Einkommen", fill: "#5EEAD4", fontSize: 11, position: "insideTopRight" }} />
              <ReferenceLine y={0} stroke="#FB7185" strokeOpacity={0.4} />
              <Bar dataKey="fix" stackId="a" fill="#3B4763" radius={[0, 0, 0, 0]} />
              <Bar dataKey="einmalig" stackId="a" fill="#FB7185" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="kontostand" stroke="#F5B544" strokeWidth={2.5} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {minKonto < 0 && <div className="text-xs text-bad mt-2">⚠ Ohne Rücklage rutscht dein Kontostand im Jahresverlauf bis auf {e(minKonto)} — genau dafür ist das Startpolster oben.</div>}
      </div>

      {/* Editoren */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Einkommen + Fixkosten */}
        <div className="card p-6 space-y-4">
          <div className="font-semibold display">Einkommen & Fixkosten</div>
          <div>
            <div className="text-xs text-muted mb-1">Netto-Einkommen / Monat</div>
            <input className="input num" value={data.income} onChange={e => persist({ ...data, income: parseAmount(e.target.value) })} />
          </div>
          <div className="space-y-2">
            {data.fixed.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-2 border-b border-line/40 pb-2">
                <span className="text-sm flex-1 min-w-0 whitespace-normal break-normal">{f.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <input className="input num w-24 text-right py-1.5" defaultValue={f.amount} onBlur={e => editFixed(f.id, parseAmount(e.target.value))} />
                  <span className="text-xs text-muted">{sym}</span>
                  <button onClick={() => rmFixed(f.id)} className="x-btn">✕</button>
                </div>
              </div>
            ))}
            {data.fixed.length === 0 && <div className="text-muted text-sm">Noch keine Fixkosten.</div>}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1 min-w-0" placeholder="z.B. Fitnessstudio" value={fName} onChange={e => setFName(e.target.value)} />
            <input className="input num w-28" placeholder={`${sym}/Monat`} value={fAmt} onChange={e => setFAmt(e.target.value)} onKeyDown={e => e.key === "Enter" && addFixed()} />
            <button className="btn-ghost px-4 rounded-xl" onClick={addFixed}>+</button>
          </div>
        </div>

        {/* Einmalige Kosten */}
        <div className="card p-6 space-y-4">
          <div className="font-semibold display">Einmalige Kosten im Jahr</div>
          <div className="text-xs text-muted -mt-2">Trag größere Ausgaben in den Monat ein, in dem sie anfallen (Versicherung, Urlaub, Steuer …).</div>
          <div className="space-y-2">
            {[...data.oneTime].sort((a, b) => a.month - b.month).map(o => (
              <div key={o.id} className="flex items-center justify-between gap-2 border-b border-line/40 pb-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap"><span className="text-sm whitespace-normal break-normal">{o.name}</span> <span className="text-[10px] text-gold border border-gold/40 rounded px-1 num shrink-0">{MONTHS[o.month - 1]}</span></div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="num text-sm">{e(o.amount)}</span>
                  <button onClick={() => rmOne(o.id)} className="x-btn">✕</button>
                </div>
              </div>
            ))}
            {data.oneTime.length === 0 && <div className="text-muted text-sm">Noch keine einmaligen Kosten.</div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input className="input flex-1 min-w-[120px]" placeholder="z.B. Urlaub" value={oName} onChange={e => setOName(e.target.value)} />
            <input className="input num w-24" placeholder={sym} value={oAmt} onChange={e => setOAmt(e.target.value)} />
            <select className="input w-24" value={oMonth} onChange={e => setOMonth(+e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            <button className="btn-ghost px-4 rounded-xl" onClick={addOne}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
