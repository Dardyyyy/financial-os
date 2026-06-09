# Financial OS

Persönliches Finanz-Cockpit als Next.js App. Dashboard, Investment-Planer,
KI-Expert-Advisor (Anthropic Claude) und Portfolio-Tracker — sofort auf Vercel deploybar.

## Stack
- Next.js 14 (Pages Router) + TypeScript
- Tailwind CSS
- Recharts (Charts)
- Anthropic Claude API (server-seitig über `/api/chat`)

## Environment Variables
| Variable | Pflicht | Beschreibung |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Key für den Expert Advisor Chat |
| `ANTHROPIC_MODEL` | – | Default `claude-sonnet-4-6` |
| `NEXT_PUBLIC_AIRTABLE_BASE_ID` | – | Phase 2 |
| `NEXT_PUBLIC_AIRTABLE_TOKEN` | – | Phase 2 |

## Struktur
```
financial-os/
├── pages/
│   ├── _app.tsx
│   ├── index.tsx          # Tab-Navigation
│   └── api/chat.ts        # Claude-Proxy (Key bleibt server-seitig)
├── components/
│   ├── Dashboard.tsx
│   ├── InvestmentPlanner.tsx
│   ├── ExpertAdvisor.tsx
│   └── Portfolio.tsx
├── lib/store.ts           # localStorage + Seed-Daten
├── styles/globals.css
├── .env.example
└── ...config
```

## Lokal starten
```bash
npm install
cp .env.example .env.local
npm run dev
```

Keine Anlageberatung — reine Informations- und Planungs-Tools.
