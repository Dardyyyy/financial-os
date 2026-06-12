import { useEffect, useMemo, useState } from "react";
import { Goal, GoalTimeframe, Currency, loadGoals, saveGoals, loadSettings, fmt, uid, periodKey, rolloverGoals, RESET_LABEL, parseAmount} from "../lib/store";

const TF: { id: GoalTimeframe; label: string; color: string }[] = [
  { id: "tag",   label: "Heute / Täglich", color: "#5EEAD4" },
  { id: "woche", label: "Diese Woche",      color: "#F5B544" },
  { id: "monat", label: "Diesen Monat",     color: "#A78BFA" },
  { id: "jahr",  label: "Dieses Jahr",      color: "#FB7185" },
];
const TFC = (id: GoalTimeframe) => TF.find(t => t.id === id)!.color;

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [ready, setReady] = useState(false);
  const [cur, setCur] = useState<Currency>("CHF");

  const [title, setTitle] = useState("");
  const [tf, setTf] = useState<GoalTimeframe>("woche");
  const [cat, setCat] = useState("");
  const [target, setTarget] = useState("");
  const [due, setDue] = useState("");
  const [rec, setRec] = useState(false);

  useEffect(() => {
    loadGoals().then(g => { const r = rolloverGoals(g); if (r.changed) saveGoals(r.goals); setGoals(r.goals); setReady(true); });
    loadSettings().then(s => setCur(s.mainCurrency));
  }, []);
  const persist = (g: Goal[]) => { setGoals(g); saveGoals(g); };
  const num = (s: string) => parseAmount(s);

  const add = () => {
    if (!title.trim()) return;
    const t = num(target);
    persist([{ id: uid(), title: title.trim(), timeframe: tf, category: cat.trim() || undefined, done: false, target: t || undefined, current: t ? 0 : undefined, currency: t ? cur : undefined, due: due || undefined, createdTs: Date.now(), recurring: rec || undefined, periodKey: rec ? periodKey(tf) : undefined, streak: rec ? 0 : undefined }, ...goals]);
    setTitle(""); setTarget(""); setDue(""); setCat(""); setRec(false);
  };
  const toggle = (id: string) => persist(goals.map(g => g.id === id ? { ...g, done: !g.done, doneTs: !g.done ? Date.now() : undefined } : g));
  const setCurrent = (id: string, n: number) => persist(goals.map(g => g.id === id ? { ...g, current: n, done: g.target ? n >= g.target : g.done } : g));
  const remove = (id: string) => persist(goals.filter(g => g.id !== id));

  const done = goals.filter(g => g.done).length;
  const quote = goals.length ? Math.round((done / goals.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Fortschritt gesamt */}
      <div className="card card-hl p-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-muted">Erledigt</div>
            <div className="display text-3xl font-bold text-gold num">{done} <span className="text-muted text-lg">/ {goals.length}</span></div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted">Quote</div>
            <div className="display text-3xl font-bold num" style={{ color: quote >= 66 ? "#5EEAD4" : quote >= 33 ? "#F5B544" : "#FB7185" }}>{quote}%</div>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-panel2 mt-4 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${quote}%`, background: "linear-gradient(90deg,#F5B544,#5EEAD4)" }} />
        </div>
      </div>

      {/* Neues Ziel */}
      <div className="card p-6 space-y-3">
        <div className="font-semibold display">Neues Ziel</div>
        <input className="input" placeholder="Was willst du erreichen?" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <div className="flex gap-2 flex-wrap">
          {TF.map(t => (
            <button key={t.id} onClick={() => setTf(t.id)} className="chip" style={tf === t.id ? { borderColor: t.color, color: "#fff", background: `${t.color}1f` } : {}}>{t.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className="input" placeholder="Kategorie (optional)" value={cat} onChange={e => setCat(e.target.value)} />
          <input className="input num" placeholder={`Zielbetrag (${cur}, optional)`} value={target} onChange={e => setTarget(e.target.value)} />
          <input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} />
        </div>
        <button onClick={() => setRec(!rec)} className="chip w-full sm:w-auto" style={rec ? { borderColor: "#5EEAD4", color: "#fff", background: "#5EEAD41f" } : {}}>{rec ? "🔁 Wiederkehrend: an" : "🔁 Wiederkehrend"}</button>
        {rec && <div className="text-[11px] text-muted -mt-1">Setzt sich {RESET_LABEL[tf]} automatisch zurück.</div>}
        <button className="btn w-full" onClick={add} disabled={!title.trim()}>Ziel hinzufügen</button>
      </div>

      {/* Ziele nach Zeitraum */}
      {TF.map(t => {
        const list = goals.filter(g => g.timeframe === t.id);
        if (list.length === 0) return null;
        return (
          <div key={t.id} className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
              <div className="font-semibold display">{t.label}</div>
              <span className="num text-xs text-muted">{list.filter(g => g.done).length}/{list.length}</span>
            </div>
            <div className="space-y-3">
              {list.map(g => {
                const pct = g.target ? Math.min(100, Math.round(((g.current || 0) / g.target) * 100)) : null;
                return (
                  <div key={g.id} className="border-b border-line/40 pb-3 last:border-0">
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggle(g.id)} className="mt-0.5 w-6 h-6 rounded-lg shrink-0 flex items-center justify-center transition" style={g.done ? { background: t.color, color: "#0B1020" } : { border: "2px solid #3a466640" }}>{g.done ? "✓" : ""}</button>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium ${g.done ? "line-through text-muted" : ""}`}>{g.title}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {g.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${t.color}22`, color: t.color }}>{g.category}</span>}
                          {g.recurring && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-panel2 text-muted">🔁 {RESET_LABEL[g.timeframe]}</span>}
                          {g.recurring && (g.streak || 0) > 0 && <span className="text-[10px] num text-gold">🔥 {g.streak}</span>}
                          {g.due && <span className="text-[10px] text-muted num">bis {new Date(g.due).toLocaleDateString("de-DE")}</span>}
                        </div>
                        {pct !== null && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                              <span className="flex items-center gap-1">Fortschritt
                                <input className="input num w-24 py-0.5 px-2 text-xs ml-1" defaultValue={g.current || 0} onBlur={e => setCurrent(g.id, num(e.target.value))} />
                                <span>/ {fmt(g.target!, (g.currency || cur))}</span>
                              </span>
                              <span className="num" style={{ color: t.color }}>{pct}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-panel2 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: t.color }} /></div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => remove(g.id)} className="x-btn">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {ready && goals.length === 0 && <div className="card p-8 text-center text-muted text-sm">Noch keine Ziele. Leg oben dein erstes an — oder tippe im Berater bei einer Antwort auf "Als Ziel".</div>}
    </div>
  );
}
