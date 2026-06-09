# 🚀 START HERE — Financial OS in 5 Minuten online

## 0. WICHTIG zuerst
Falls du irgendwo alte API-Keys oder GitHub-Tokens im Klartext hattest:
**sofort widerrufen** und neue erstellen. Keys gehören NUR in Environment Variables, nie in den Code.

## 1. Auf GitHub hochladen
1. Neues Repo erstellen, z.B. `financial-os`
2. Den **kompletten Ordner-Inhalt** hochladen (alle Dateien + Unterordner)
3. Commit & Push

> `node_modules` und `.env*` werden dank `.gitignore` automatisch ignoriert — perfekt.

## 2. Auf Vercel deployen
1. https://vercel.com → **Add New… → Project**
2. Dein GitHub-Repo importieren
3. Framework wird automatisch als **Next.js** erkannt → nichts ändern
4. Unter **Environment Variables** eintragen:
   - `ANTHROPIC_API_KEY` = dein NEUER Anthropic Key
   - (optional) `ANTHROPIC_MODEL` = `claude-sonnet-4-6`
5. **Deploy** klicken → fertig 🎉

## 3. (Optional) Lokal testen
```bash
npm install
cp .env.example .env.local   # und ANTHROPIC_API_KEY eintragen
npm run dev
# → http://localhost:3000
```

## Tabs
- **Dashboard** — Einnahmen/Ausgaben, Kategorien, Transaktionen
- **Investment Planner** — Zinseszins-Rechner mit Chart
- **Expert Advisor** — Claude-Chat (Investment / Schulden / Steuer / Budget)
- **Portfolio** — Positionen, Allokation, Gewinn/Verlust

Alle Daten liegen lokal im Browser (localStorage). Kein extra Backend nötig.
