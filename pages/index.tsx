import { useState } from "react";
import Dashboard from "../components/Dashboard";
import InvestmentPlanner from "../components/InvestmentPlanner";
import ExpertAdvisor from "../components/ExpertAdvisor";
import Portfolio from "../components/Portfolio";
import Market from "../components/Market";
import Ticker from "../components/Ticker";
import Logo from "../components/Logo";
import { cloudEnabled } from "../lib/store";

const TABS = [
  { id: "dashboard", label: "Übersicht", icon: "◧" },
  { id: "market", label: "Markt", icon: "◮" },
  { id: "planner", label: "Planer", icon: "◭" },
  { id: "advisor", label: "Berater", icon: "✦" },
  { id: "portfolio", label: "Portfolio", icon: "◈" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const active = TABS.find(t => t.id === tab)!;

  const titles: Record<TabId, string> = {
    dashboard: "Deine Finanzen auf einen Blick",
    market: "Märkte & Top Mover",
    planner: "Was dein Geld in Zukunft wird",
    advisor: "Frag deinen Berater",
    portfolio: "Dein Depot in Echtzeit",
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line/60 px-4 py-6 gap-1 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2 mb-7">
          <Logo size={40} />
          <div>
            <div className="font-semibold display leading-tight">Financial OS</div>
            <div className="text-[11px] text-muted leading-tight">Personal Finance</div>
          </div>
        </div>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`nav-item ${tab === t.id ? "active" : ""}`}>
            <span className="text-lg leading-none w-5 text-center">{t.icon}</span>{t.label}
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
        <header className="px-5 md:px-8 pt-6 pb-3">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/80 mb-1">{active.label}</div>
          <h1 className="display text-2xl font-semibold">{titles[tab]}</h1>
        </header>

        <Ticker />

        <main className="px-5 md:px-8 py-6 pb-28 md:pb-10 max-w-6xl w-full">
          {tab === "dashboard" && <Dashboard />}
          {tab === "market" && <Market />}
          {tab === "planner" && <InvestmentPlanner />}
          {tab === "advisor" && <ExpertAdvisor />}
          {tab === "portfolio" && <Portfolio />}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-ink/90 backdrop-blur border-t border-line/60 flex">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold ${tab === t.id ? "text-gold" : "text-muted"}`}>
            <span className="text-lg leading-none">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
