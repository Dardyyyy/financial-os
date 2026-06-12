import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import {
  SavedNote, ChatSession, Goal, loadChats, saveChats, loadNotes, saveNotes,
  loadGoals, saveGoals, loadTransactions, loadHoldings, uid, eur,
} from "../lib/store";

const MODES = {
  investment: { label: "Investment", icon: "📈", color: "#F5B544",
    system: "Du bist ein nuechterner Investment-Analyst mit Fokus auf KI-Infrastruktur und Energie. Antworte auf Deutsch, strukturiert und konkret. Nenne Chancen UND Risiken. Keine personalisierte Anlageberatung." },
  debt: { label: "Schulden", icon: "💳", color: "#FB7185",
    system: "Du bist ein empathischer Schuldenberater. Antworte auf Deutsch. Priorisiere Schulden (Lawine vs. Schneeball), erstelle realistische Abbauplaene." },
  tax: { label: "Steuer", icon: "🧾", color: "#5EEAD4",
    system: "Du bist ein Steuer-Erklaerer fuer Privatpersonen. Antworte auf Deutsch mit konkretem Bezug zur Gesetzeslage des angegebenen Landes (Deutschland ODER Schweiz). Beachte Unterschiede bei Kapitalertrag-/Verrechnungssteuer, Freibetraegen, Fristen. Du ersetzt keinen Steuerberater." },
  budget: { label: "Budget", icon: "📊", color: "#A78BFA",
    system: "Du bist ein praktischer Budget-Coach. Antworte auf Deutsch mit konkreten, umsetzbaren Tipps zu Sparquoten und Cashflow." },
} as const;
type ModeId = keyof typeof MODES;
const MODE_IDS = Object.keys(MODES) as ModeId[];

const emptyFor = (mode: ModeId): ChatSession => ({ id: mode, title: MODES[mode].label, mode, country: "DE", messages: [], ts: Date.now() });

// Aus altem Verlauf je Modus genau EINEN Chat machen (eigener Verlauf pro Bereich)
const ensureByMode = (list: ChatSession[]): ChatSession[] =>
  MODE_IDS.map(mode => {
    const found = (list || []).filter(s => (s.mode as ModeId) === mode)
      .sort((a, b) => (b.messages?.length || 0) - (a.messages?.length || 0) || b.ts - a.ts)[0];
    return found ? { ...found, id: mode, mode } : emptyFor(mode);
  });

export default function ExpertAdvisor() {
  const [sessions, setSessions] = useState<ChatSession[]>(MODE_IDS.map(emptyFor));
  const [activeMode, setActiveMode] = useState<ModeId>("investment");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [ctx, setCtx] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChats().then((list) => setSessions(ensureByMode(list || [])));
    loadNotes().then(setNotes);
    Promise.all([loadTransactions(), loadHoldings()]).then(([txs, holds]) => {
      const income = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const bal = income - expense, rate = income > 0 ? Math.round((bal / income) * 100) : 0;
      const cat = new Map<string, number>();
      txs.filter(t => t.amount < 0).forEach(t => cat.set(t.category, (cat.get(t.category) || 0) + Math.abs(t.amount)));
      const top = Array.from(cat, ([n, v]) => `${n} ${eur(v)}`).slice(0, 4).join(", ");
      const depot = holds.map(h => `${h.ticker} ${h.shares} Stk`).join(", ");
      setCtx(`FINANZDATEN DES NUTZERS (fuer persoenliche Beratung; nicht ungefragt vorlesen):\n- Einnahmen/Monat: ${eur(income)}\n- Ausgaben/Monat: ${eur(expense)}\n- Bilanz: ${eur(bal)} (Sparquote ~${rate}%)\n- Top-Ausgaben: ${top || "-"}\n- Depot: ${depot || "-"}`);
    });
  }, []);

  const active = sessions.find(s => s.id === activeMode) || sessions[0];
  const persist = (next: ChatSession[]) => { setSessions(next); saveChats(next); };
  const patchActive = (patch: Partial<ChatSession>) => persist(sessions.map(s => s.id === activeMode ? { ...s, ...patch } : s));
  const clearChat = () => patchActive({ messages: [] });

  const send = async () => {
    const text = input.trim(); if (!text || loading || !active) return;
    setError("");
    const msgs = [...active.messages, { role: "user" as const, content: text }];
    const updated = sessions.map(s => s.id === activeMode ? { ...s, messages: msgs } : s);
    persist(updated); setInput(""); setLoading(true);
    const m = MODES[activeMode];
    const system = `${m.system}\n\nLand fuer Steuer-/Rechtsfragen: ${active.country === "DE" ? "Deutschland" : "Schweiz"}.\n\n${ctx}`;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: msgs, system }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      persist(updated.map(s => s.id === activeMode ? { ...s, messages: [...msgs, { role: "assistant", content: data.text }] } : s));
      setTimeout(() => boxRef.current?.scrollTo(0, boxRef.current.scrollHeight), 50);
    } catch (e: any) { setError(e.message); setInput(text); }
    finally { setLoading(false); }
  };

  const pin = (text: string) => { const n = [{ id: uid(), mode: MODES[activeMode].label, label: text.slice(0, 60), text, ts: Date.now() }, ...notes]; setNotes(n); saveNotes(n); };
  const unpin = (id: string) => { const n = notes.filter(x => x.id !== id); setNotes(n); saveNotes(n); };
  const [goalMsg, setGoalMsg] = useState("");
  const asGoal = async (text: string) => {
    const g: Goal = { id: uid(), title: text.split("\n")[0].slice(0, 90), timeframe: "woche", category: MODES[activeMode].label, done: false, createdTs: Date.now() };
    const existing = await loadGoals(); await saveGoals([g, ...existing]);
    setGoalMsg("Als Ziel gespeichert — im Tab „Ziele“."); setTimeout(() => setGoalMsg(""), 2500);
  };

  const m = MODES[activeMode];

  return (
    <div className="space-y-4">
      {/* Bereiche = eigene Chats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODE_IDS.map(id => {
          const s = sessions.find(x => x.id === id);
          const count = s?.messages.length || 0;
          const act = id === activeMode;
          return (
            <button key={id} onClick={() => setActiveMode(id)}
              className="rounded-2xl p-3 text-left border transition"
              style={act ? { borderColor: MODES[id].color, background: `${MODES[id].color}1f` } : { borderColor: "#26314D", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between">
                <span className="text-lg">{MODES[id].icon}</span>
                {count > 0 && <span className="num text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${MODES[id].color}33`, color: MODES[id].color }}>{count}</span>}
              </div>
              <div className="font-semibold text-sm mt-1" style={act ? { color: MODES[id].color } : {}}>{MODES[id].label}</div>
              
            </button>
          );
        })}
      </div>

      {/* Land + Aktionen */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted">Land:</span>
          <button onClick={() => patchActive({ country: "DE" })} className="chip" style={active.country === "DE" ? { borderColor: "#F5B544", color: "#F5B544" } : {}}>{"🇩🇪"} DE</button>
          <button onClick={() => patchActive({ country: "CH" })} className="chip" style={active.country === "CH" ? { borderColor: "#F5B544", color: "#F5B544" } : {}}>{"🇨🇭"} CH</button>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => setShowNotes(s => !s)} className="text-xs text-muted hover:text-ink2">{"📌"} Gespeichert ({notes.length})</button>
          {active.messages.length > 0 && <button onClick={clearChat} className="text-xs text-muted hover:text-bad">Verlauf löschen</button>}
        </div>
      </div>

      {showNotes && (
        <div className="card p-4 space-y-2">
          <div className="font-semibold display text-sm">Gespeicherte Infos</div>
          {notes.length === 0 && <div className="text-muted text-xs">Noch nichts gespeichert. Tippe bei einer Antwort auf "Speichern".</div>}
          {notes.map(n => (
            <div key={n.id} className="flex items-start justify-between gap-3 border-b border-line/40 pb-2">
              <div className="min-w-0"><div className="text-[11px] text-gold">{n.mode} · {new Date(n.ts).toLocaleDateString("de-DE")}</div><div className="text-sm whitespace-pre-wrap">{n.text}</div></div>
              <button onClick={() => unpin(n.id)} className="x-btn">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="card card-hl flex flex-col" style={{ height: "54vh", minHeight: 380 }}>
        <div className="flex items-center gap-2 px-5 pt-4 pb-2 border-b border-line/50">
          <span>{m.icon}</span><b style={{ color: m.color }}>{m.label}-Berater</b>
          <span className="text-muted text-xs">· {active.country === "DE" ? "Deutschland" : "Schweiz"}</span>
        </div>
        <div ref={boxRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {active.messages.length === 0 && <div className="text-muted text-sm max-w-md">Frag den <b style={{ color: m.color }}>{m.label}-Berater</b> etwas. Jeder Bereich hat seinen eigenen Verlauf — wechselst du oben den Bereich, siehst du dessen eigene Unterhaltung.</div>}
          {active.messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[88%]">
                {msg.role === "user"
                  ? <div className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed text-ink font-medium" style={{ background: m.color }}>{msg.content}</div>
                  : <div className="rounded-2xl px-4 py-3 bg-panel2/70 border border-line"><Markdown text={msg.content} accent={m.color} /></div>}
                {msg.role === "assistant" && <div className="flex gap-3 mt-1 ml-1"><button onClick={() => pin(msg.content)} className="text-[11px] text-muted hover:text-gold">{"📌"} Speichern</button><button onClick={() => asGoal(msg.content)} className="text-[11px] text-muted hover:text-mint">{"🎯"} Als Ziel</button></div>}
              </div>
            </div>
          ))}
          {loading && <div className="text-muted text-sm flex items-center gap-2"><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: m.color }} />denkt nach…</div>}
        </div>
        <div className="border-t border-line/60 p-4">
          {goalMsg && <div className="text-mint text-xs mb-2">{goalMsg}</div>}
          {error && <div className="text-bad text-xs mb-2">⚠ {error}</div>}
          <div className="flex gap-2">
            <input className="input" placeholder={`Frage an den ${m.label}-Berater…`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
            <button className="btn" onClick={send} disabled={loading || !input.trim()}>Senden</button>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted">Keine Anlage-, Steuer- oder Rechtsberatung im rechtlichen Sinn.</div>
    </div>
  );
}
