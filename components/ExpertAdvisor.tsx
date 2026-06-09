import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const MODES = {
  investment: {
    label: "Investment Analyst",
    icon: "📈",
    system:
      "Du bist ein nüchterner Investment-Analyst mit Fokus auf KI-Infrastruktur und Energie. " +
      "Antworte auf Deutsch, strukturiert und konkret. Nenne Chancen UND Risiken (Bull/Bear). " +
      "Du gibst KEINE personalisierte Anlageberatung und weist darauf hin, dass Entscheidungen beim Nutzer liegen.",
  },
  debt: {
    label: "Schuldenberater",
    icon: "💳",
    system:
      "Du bist ein empathischer Schuldenberater. Antworte auf Deutsch. Hilf, Schulden zu priorisieren " +
      "(Lawine vs. Schneeball), erstelle realistische Abbaupläne und erkläre Optionen sachlich.",
  },
  tax: {
    label: "Steuer-Helfer",
    icon: "🧾",
    system:
      "Du bist ein Steuer-Erklärer für Privatpersonen in Deutschland/Schweiz (Grenzgänger-Kontext möglich). " +
      "Antworte auf Deutsch, allgemein und verständlich. Du ersetzt keinen Steuerberater und sagst das auch.",
  },
  budget: {
    label: "Budget-Coach",
    icon: "📊",
    system:
      "Du bist ein praktischer Budget-Coach. Antworte auf Deutsch. Gib konkrete, umsetzbare Tipps " +
      "zu Sparquoten, 50/30/20-Regeln und Cashflow-Optimierung.",
  },
} as const;

type ModeId = keyof typeof MODES;

export default function ExpertAdvisor() {
  const [mode, setMode] = useState<ModeId>("investment");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, system: MODES[mode].system }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setMessages([...next, { role: "assistant", content: data.text }]);
      setTimeout(() => boxRef.current?.scrollTo(0, boxRef.current.scrollHeight), 50);
    } catch (e: any) {
      setError(e.message);
      setMessages(messages); // rollback
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode picker */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(MODES) as ModeId[]).map((id) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`chip ${mode === id ? "bg-accent/15 border-accent text-white" : "text-muted"}`}
          >
            <span className="mr-1">{MODES[id].icon}</span>{MODES[id].label}
          </button>
        ))}
      </div>

      <div className="card flex flex-col" style={{ height: "62vh", minHeight: 420 }}>
        {/* Messages */}
        <div ref={boxRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="text-muted text-sm">
              Frag den <b className="text-white">{MODES[mode].label}</b> alles — z.B. „Lohnt sich ein
              monatlicher ETF-Sparplan von 800 €?" oder „Wie baue ich 5.000 € Schulden am schnellsten ab?"
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user" ? "bg-accent text-white" : "bg-panel2 border border-line"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-muted text-sm">Denkt nach…</div>}
        </div>

        {/* Input */}
        <div className="border-t border-line/60 p-4">
          {error && <div className="text-bad text-xs mb-2">⚠ {error}</div>}
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Deine Frage…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button className="btn" onClick={send} disabled={loading || !input.trim()}>
              Senden
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted">
        Läuft über deinen <code>ANTHROPIC_API_KEY</code> (server-seitig). Keine Anlageberatung.
      </div>
    </div>
  );
}
