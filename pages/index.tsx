import { useState } from "react";
import Dashboard from "../components/Dashboard";
import InvestmentPlanner from "../components/InvestmentPlanner";
import ExpertAdvisor from "../components/ExpertAdvisor";
import Portfolio from "../components/Portfolio";
import Market from "../components/Market";
import Budget from "../components/Budget";
import Immobilien from "../components/Immobilien";
import Assets from "../components/Assets";
import Goals from "../components/Goals";
import Ticker from "../components/Ticker";
import Logo from "../components/Logo";
import { cloudEnabled } from "../lib/store";
import { AuthGate, useAuth } from "../lib/auth";

const TABS = [
  { id: "dashboard", label: "Übersicht", icon: "◧" },
  { id: "market", label: "Markt", icon: "◮" },
  { id: "planner", label: "Planer", icon: "◭" },
  { id: "budget", label: "Budget", icon: "▤" },
  { id: "immo", label: "Immobilien", icon: "⌂" },
  { id: "assets", label: "Vermögen", icon: "◰" },
  { id: "goals", label: "Ziele", icon: "◎" },
  { id: "advisor", label: "Berater", icon: "✦" },
  { id: "portfolio", label: "Portfolio", icon: "◈" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  return <AuthGate><Shell /></AuthGate>;
}

function Shell() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const active = TABS.find(t => t.id === tab)!;
  const { user, logout } = useAuth();

  const titles: Record<TabId, string> = {
    dashboard: "Deine Finanzen auf einen Blick",
    market: "Märkte & Top Mover",
    planner: "Was dein Geld in Zukunft wird",
    budget: "Budget & Liquidität",
    immo: "Immobilien-Rechner DE vs. CH",
    assets: "Vermögen & Sachwerte",
    goals: "Deine Ziele",
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
            <span className="nav-accent" />{t.label}
          </button>
        ))}
        <div className="mt-auto px-2 space-y-2">
          {user && (
            <div className="text-[11px] text-muted truncate" title={user.email || ""}>{user.email}</div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className={`w-1.5 h-1.5 rounded-full ${cloudEnabled ? "bg-mint" : "bg-muted"}`} />
              {cloudEnabled ? "Cloud-Sync" : "Lokal"}
            </div>
            {user && <button onClick={logout} className="text-[11px] text-muted hover:text-bad">Abmelden</button>}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="px-5 md:px-8 pt-6 pb-3 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gold/80 mb-1">{active.label}</div>
            <h1 className="display text-2xl font-semibold">{titles[tab]}</h1>
          </div>
          {user && <button onClick={logout} className="md:hidden text-xs text-muted hover:text-bad">Abmelden</button>}
        </header>

        <Ticker />

        <main className="px-5 md:px-8 py-6 pb-28 md:pb-10 max-w-6xl w-full">
          {tab === "dashboard" && <Dashboard />}
          {tab === "market" && <Market />}
          {tab === "planner" && <InvestmentPlanner />}
          {tab === "budget" && <Budget />}
          {tab === "immo" && <Immobilien />}
          {tab === "assets" && <Assets />}
          {tab === "goals" && <Goals />}
          {tab === "advisor" && <ExpertAdvisor />}
          {tab === "portfolio" && <Portfolio />}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#080B16]/80 backdrop-blur-xl border-t border-line/60 flex overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex-1 min-w-[64px] py-3.5 text-[11px] font-semibold transition ${tab === t.id ? "text-gold" : "text-muted"}`}>
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-7 rounded-full transition" style={tab === t.id ? { background: "linear-gradient(90deg,#F5B544,#5EEAD4)", boxShadow: "0 0 10px rgba(245,181,68,0.7)" } : { background: "transparent" }} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
