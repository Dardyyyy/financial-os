# 🚀 START HERE — Financial OS in 5 Minuten online

## 0. Sicherheit zuerst
API-Keys gehören NUR in Environment Variables, nie in den Code. Falls ein Key je
im Klartext geteilt wurde: in der jeweiligen Console widerrufen und neu erstellen.

## 1. Auf GitHub hochladen
Lade den **Inhalt** des Ordners ins Repo-Root (so liegt `package.json` ganz oben).
`node_modules` und `.env*` werden dank `.gitignore` ignoriert.

## 2. Auf Vercel deployen
1. https://vercel.com → Add New → Project → dein Repo importieren
2. Framework = Next.js (automatisch)
3. Environment Variables eintragen (siehe unten) → Deploy

### Environment Variables
| Variable | Wofür |
|---|---|
| `ANTHROPIC_API_KEY` | Berater-Chat (Pflicht für den Chat) |
| `ANTHROPIC_MODEL` | optional, Default `claude-sonnet-4-6` |
| `FINNHUB_API_KEY` | optional, Live-Aktienkurse (finnhub.io, kostenlos) |
| `NEXT_PUBLIC_FIREBASE_*` | optional, Cloud-Sync (sonst lokaler Speicher) |

> Wichtig: Nach dem Eintragen neuer Variablen einmal **Redeploy** — sonst greifen sie nicht.

## 3. Firebase einschalten (optional)
1. https://console.firebase.google.com → Projekt anlegen
2. Build → Firestore Database → Datenbank erstellen
3. Projekt-Einstellungen → „Web-App" hinzufügen → die `firebaseConfig`-Werte
   in die `NEXT_PUBLIC_FIREBASE_*` Variablen übertragen
4. Firestore-Regeln (Start, später verschärfen):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /financial-os/{doc} { allow read, write: if true; }
     }
   }
   ```
   → Daten landen dann in der Cloud. Ohne Firebase läuft alles lokal im Browser.

## 4. Lokal testen (optional)
```bash
npm install
cp .env.example .env.local   # Keys eintragen
npm run dev                  # http://localhost:3000
```

## Tabs
- **Übersicht** — Einnahmen/Ausgaben, eigene Kategorien, Sparquote
- **Planer** — Zinseszins-Rechner mit Chart
- **Berater** — Claude-Chat in 4 Modi
- **Portfolio** — Positionen, Live-Kurse, Allokation, Gewinn/Verlust
