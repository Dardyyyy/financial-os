import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Asset, AssetKind, loadAssets, saveAssets, loadHoldings, getUsdEur, eur, eur2, uid } from "../lib/store";
import CountUp from "./CountUp";

const KIND: Record<AssetKind, { label: string; icon: string; color: string }> = {
  immobilie:   { label: "Immobilie",       icon: "🏠", color: "#F5B544" },
  bargeld:     { label: "Bargeld / Konto",  icon: "💶", color: "#5EEAD4" },
  edelmetall:  { label: "Edelmetall",       icon: "🥇", color: "#FBBF24" },
  beteiligung: { label: "Beteiligung",      icon: "🏢", color: "#A78BFA" },
  sonstiges:   { label: "Sonstiges",        icon: "📦", color: "#60A5FA" },
};
const KINDS = Object.keys(KIND) as AssetKind[];

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [depot, setDepot] = useState(0);

  const [kind, setKind] = useState<AssetKind>("immobilie");
  const [name, setName] = useState(""); const [val, setVal] = useState(""); const [debt, setDebt] = useState("");

  useEffect(() => {
    loadAssets().then(a => { setAssets(a); setReady(true); });
    (async () => {
      const [h, fx] = await Promise.all([loadHoldings(), getUsdEur()]);
      setDepot(h.reduce((s, x) => s + x.shares * x.lastPrice * (x.currency === "USD" ? fx : 1), 0));
    })();
  }, []);
  const persist = (a: Asset[]) => { setAssets(a); saveAssets(a); };

  const grossAssets = useMemo(() => assets.reduce((s, a) => s + (a.value || 0), 0), [assets]);
  const debts = useMemo(() => assets.reduce((s, a) => s + (a.debt || 0), 0), [assets]);
  const gross = grossAssets + depot;
  const net = gross - debts;

  // Allokation nach Typ (Brutto) + Depot
  const pie = useMemo(() => {
    const byKind: Record<string, number> = {};
    assets.forEach(a => { byKind[a.kind] = (byKind[a.kind] || 0) + (a.value || 0); });
    const slices = KINDS.filter(k => byKind[k] > 0).map(k => ({ name: KIND[k].label, value: Math.round(byKind[k]), color: KIND[k].color }));
    if (depot > 0) slices.push({ name: "Depot (Aktien/Krypto)", value: Math.round(depot), color: "#FB7185" });
    return slices;
  }, [assets, depot]);

  const add = () => {
    const v = parseFloat(val.replace(",", ".")); if (!name.trim() || isNaN(v)) return;
    const d = parseFloat(debt.replace(",", ".")) || 0;
    persist([...assets, { id: uid(), name: name.trim(), kind, value: v, debt: d }]);
    setName(""); setVal(""); setDebt("");
  };
  const edit = (id: string, field: "value" | "debt", n: number) => persist(assets.map(a => a.id === id ? { ...a, [field]: n } : a));
  const remove = (id: string) => persist(assets.filter(a => a.id !== id));

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hl p-5"><div className="text-sm text-muted">Nettovermögen</div><div className={`display text-2xl font-bold mt-1 num ${net >= 0 ? "text-gold" : "text-bad"}`}>{ready ? <CountUp value={net} format={eur} /> : "—"}</div><div className="text-[10px] text-muted mt-0.5">Sachwerte + Depot − Schulden</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Sachwerte & Anlagen</div><div className="display text-2xl font-bold mt-1 num text-ink2">{ready ? <CountUp value={gross} format={eur} /> : "—"}</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Depot (aus Portfolio)</div><div className="display text-2xl font-bold mt-1 num text-mint">{ready ? <CountUp value={depot} format={eur} /> : "—"}</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Schulden</div><div className="display text-2xl font-bold mt-1 num text-bad">{ready ? <CountUp value={debts} format={eur} /> : "—"}</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        {/* Liste + Hinzufuegen */}
        <div className="card p-6">
          <div className="font-semibold display mb-4">Deine Werte</div>
          <div className="space-y-3">
            {assets.map(a => {
              const k = KIND[a.kind]; const eq = (a.value || 0) - (a.debt || 0);
              return (
                <div key={a.id} className="border-b border-line/40 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl">{k.icon}</span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{a.name}</div>
                        <div className="text-[11px]" style={{ color: k.color }}>{k.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right"><div className="text-[10px] text-muted">Wert</div><input className="input num w-28 text-right py-1.5" defaultValue={a.value} onBlur={e => edit(a.id, "value", parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
                      <button onClick={() => remove(a.id)} className="text-muted hover:text-bad">✕</button>
                    </div>
                  </div>
                  {(a.kind === "immobilie" || a.debt > 0) && (
                    <div className="flex items-center justify-end gap-3 mt-2 text-sm">
                      <span className="text-[11px] text-muted">davon Kredit</span>
                      <input className="input num w-28 text-right py-1.5" defaultValue={a.debt} onBlur={e => edit(a.id, "debt", parseFloat(e.target.value.replace(",", ".")) || 0)} />
                      <span className="text-[11px] text-muted">Eigenkapital</span>
                      <span className={`num w-24 text-right ${eq >= 0 ? "text-mint" : "text-bad"}`}>{eur(eq)}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {depot > 0 && (
              <div className="flex items-center justify-between gap-3 pb-1 opacity-90">
                <div className="flex items-center gap-3"><span className="text-xl">📈</span><div><div className="font-semibold">Depot</div><div className="text-[11px] text-bad">Aktien & Krypto · aus Portfolio</div></div></div>
                <div className="num text-right w-28 pr-7">{eur(depot)}</div>
              </div>
            )}
            {ready && assets.length === 0 && depot === 0 && <div className="text-muted text-sm">Noch keine Werte erfasst.</div>}
          </div>

          {/* Hinzufuegen */}
          <div className="mt-6 border-t border-line/50 pt-5 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {KINDS.map(k => (
                <button key={k} onClick={() => setKind(k)} className="chip" style={kind === k ? { borderColor: KIND[k].color, color: "#fff", background: `${KIND[k].color}18` } : {}}>
                  {KIND[k].icon} {KIND[k].label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className="input" placeholder={kind === "immobilie" ? "z.B. Eigentumswohnung" : "Bezeichnung"} value={name} onChange={e => setName(e.target.value)} />
              <input className="input num" placeholder="Wert (€)" value={val} onChange={e => setVal(e.target.value)} />
            </div>
            {kind === "immobilie" && <input className="input num" placeholder="Restschuld Kredit (€, optional)" value={debt} onChange={e => setDebt(e.target.value)} />}
            <button className="btn w-full" onClick={add}>{KIND[kind].icon} {KIND[kind].label} hinzufügen</button>
          </div>
        </div>

        {/* Allokation */}
        <div className="card p-6">
          <div className="font-semibold display mb-2">Vermögens-Allokation</div>
          {pie.length > 0 ? (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={56} outerRadius={94} paddingAngle={3} stroke="none">{pie.map((s, i) => <Cell key={i} fill={s.color} />)}</Pie>
                  <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12 }} labelStyle={{ color: "#F5B544" }} itemStyle={{ color: "#fff", fontFamily: "var(--font-mono)" }} formatter={(v) => [eur2(Number(v)), "Wert"]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#8794B0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-muted text-sm py-10 text-center">Füg Werte hinzu, um die Verteilung zu sehen.</div>}
          <div className="text-[11px] text-muted mt-2">Schulden zählen nicht zur Allokation, werden aber vom Nettovermögen abgezogen.</div>
        </div>
      </div>
    </div>
  );
}
