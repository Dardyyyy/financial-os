import { useState } from "react";
import Dashboard from "../components/Dashboard";
import InvestmentPlanner from "../components/InvestmentPlanner";
import ExpertAdvisor from "../components/ExpertAdvisor";
import Portfolio from "../components/Portfolio";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "planner", label: "Investment Planner", icon: "📈" },
  { id: "advisor", label: "Expert Advisor", icon: "🤖" },
  { id: "portfolio", label: "Portfolio", icon: "💼" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-line/60 sticky top-0 z-20 backdrop-blur bg-ink/70">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent2 grid place-items-center font-bold text-ink">
              F
            </div>
            <div>
              <div className="font-semibold leading-tight">Financial OS</div>
              <div className="text-xs text-muted leading-tight">Personal Finance Cockpit</div>
            </div>
          </div>
          <div className="text-xs text-muted hidden sm:block">Rheinfelden · Kaiseraugst</div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="max-w-6xl mx-auto px-4 pt-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`chip whitespace-nowrap ${
                tab === t.id ? "bg-accent/15 border-accent text-white" : "text-muted"
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "dashboard" && <Dashboard />}
        {tab === "planner" && <InvestmentPlanner />}
        {tab === "advisor" && <ExpertAdvisor />}
        {tab === "portfolio" && <Portfolio />}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-xs text-muted">
        Financial OS · gebaut für Dardy · Daten liegen lokal im Browser (localStorage)
      </footer>
    </div>
  );
}
