# Financial OS

Persönliches Finanz-Cockpit als Next.js App: Übersicht, Investment-Planer,
KI-Berater (Anthropic Claude), Portfolio mit Live-Kursen. Cloud-Sync via Firebase
(optional) — sofort auf Vercel deploybar.

## Stack
- Next.js 14 (Pages Router) + TypeScript
- Tailwind CSS · Space Grotesk / Inter / JetBrains Mono (next/font)
- Recharts
- Anthropic Claude API (server-seitig, `/api/chat`)
- Marktdaten: Finnhub (Aktien) + CoinGecko (Krypto), `/api/quote`
- Firebase Firestore (optional, mit localStorage-Fallback)

## Architektur
```
financial-os/
├── pages/
│   ├── _app.tsx                # Fonts + Layout
│   ├── index.tsx               # App-Shell (Sidebar + Bottom-Nav + Ticker)
│   └── api/
│       ├── chat.ts             # Claude-Proxy
│       └── quote.ts            # Live-Kurse (Finnhub/CoinGecko)
├── components/
│   ├── Dashboard.tsx · InvestmentPlanner.tsx · ExpertAdvisor.tsx · Portfolio.tsx
│   ├── Ticker.tsx              # laufender Kurs-Ticker
│   └── CountUp.tsx             # animierte Zahlen
├── lib/
│   ├── firebase.ts             # Firebase-Init (no-config → aus)
│   └── store.ts                # Hybrid-Speicher Firestore/localStorage
└── styles/globals.css
```

## Speicher
Ohne Firebase-Variablen: alle Daten lokal im Browser (localStorage).
Mit Firebase-Variablen: Daten in Firestore (`financial-os/transactions`, `financial-os/holdings`).

Keine Anlageberatung — Informations- und Planungs-Tools.
