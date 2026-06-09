import { useState } from "react";
import Dashboard from "../components/Dashboard";
import InvestmentPlanner from "../components/InvestmentPlanner";
import ExpertAdvisor from "../components/ExpertAdvisor";
import Portfolio from "../components/Portfolio";
import Ticker from "../components/Ticker";
import { cloudEnabled } from "../lib/store";

const TABS = [
  { id: "dashboard", label: "Übersicht", icon: "◧" },
  { id: "planner", label: "Planer", icon: "◭" },
  { id: "advisor", label: "Berater", icon: "✦" },
  { id: "portfolio", label: "Portfolio", icon: "◈" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const active = TABS.find(t => t.id === tab)!;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line/60 px-4 py-6 gap-1 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2 mb-7">
          <div className="w-10 h-10 rounded-xl grid place-items-center font-bold display text-ink"
            style={{ background: "linear-gradient(160deg,#F5B544,#5EEAD4)" }}>₣</div>
          <div>
            <div className="font-semibold display leading-tight">Financial OS</div>
            <div className="text-[11px] text-muted leading-tight">Personal Finance</div>
          </div>
        </div>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`nav-item ${tab === t.id ? "active" : ""}`}>
            <span className="text-lg leading-none w-5 text-center">{t.icon}</span>
            {t.label}
          </button>
        ))}
        <div className="mt-auto px-2 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${cloudEnabled ? "bg-mint" : "bg-muted"}`} />
            {cloudEnabled ? "Cloud-Sync aktiv" : "Lokaler Speicher"}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="px-5 md:px-8 pt-6 pb-3 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gold/80 mb-1">{active.label}</div>
            <h1 className="display text-2xl font-semibold">
              {tab === "dashboard" && "Deine Finanzen auf einen Blick"}
              {tab === "planner" && "Was dein Geld in Zukunft wird"}
              {tab === "advisor" && "Frag deinen Berater"}
              {tab === "portfolio" && "Dein Depot in Echtzeit"}
            </h1>
          </div>
        </header>

        <Ticker />

        {/* Content */}
        <main className="px-5 md:px-8 py-6 pb-28 md:pb-10 max-w-6xl w-full">
          {tab === "dashboard" && <Dashboard />}
          {tab === "planner" && <InvestmentPlanner />}
          {tab === "advisor" && <ExpertAdvisor />}
          {tab === "portfolio" && <Portfolio />}
        </main>
      </div>

      {/* Bottom nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-ink/90 backdrop-blur border-t border-line/60 flex">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-[11px] font-semibold ${tab === t.id ? "text-gold" : "text-muted"}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
