# 🧭 Nächste Schritte

## Jetzt (nach dem Deploy)
1. **Redeploy** nach dem Eintragen der Env-Variablen, sonst greift der Chat nicht.
2. `FINNHUB_API_KEY` setzen (kostenlos auf finnhub.io) → „↻ Live-Kurse aktualisieren" im Portfolio testen.
3. Firebase-Projekt anlegen und `NEXT_PUBLIC_FIREBASE_*` setzen → Daten landen in der Cloud statt nur lokal.

## Als Nächstes sinnvoll
- **Login / Multi-User**: Firebase Auth (E-Mail oder Google), damit die Cloud-Daten pro Nutzer getrennt und Firestore-Regeln sicher sind.
- **Krypto-Positionen**: im Portfolio „Krypto" wählen und CoinGecko-ID angeben (z.B. `bitcoin`, `ethereum`) → Live-Kurse ohne Key.
- **Auto-Refresh der Kurse**: Intervall (z.B. alle 60s) statt nur auf Knopfdruck.
- **Sparziele**: Zielbetrag + Fortschrittsbalken im Dashboard.
- **Kategorie-Budgets**: pro Kategorie ein Monatslimit + Warnung bei Überschreitung.
- **Historie & Trend**: Depotwert über Zeit speichern (Firestore) und als Linie zeigen.

## Später (aus der ursprünglichen Roadmap)
- News/Earnings via n8n-Workflow + Quellen-Verifikation im Berater.
- Export (CSV/PDF) für Steuer.
- PWA/Mobile-Install (Manifest + Icons).

## Sicherheit
- Firestore-Regeln verschärfen, sobald Login steht (nicht dauerhaft `allow … if true`).
- Keys ausschließlich in Vercel Environment Variables.
