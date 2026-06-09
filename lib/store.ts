// Einfacher lokaler Datenspeicher (localStorage). Kein Backend nötig.
// In Phase 2 kannst du das gegen Airtable / eine echte DB tauschen.

export type Tx = {
  id: string;
  date: string;        // ISO yyyy-mm-dd
  desc: string;
  category: string;
  amount: number;      // + Einnahme, - Ausgabe
};

export type Holding = {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  buyPrice: number;    // Kaufpreis pro Stück
  lastPrice: number;   // aktueller Kurs (manuell, später API)
};

const KEY_TX = "fos_transactions_v1";
const KEY_HOLD = "fos_holdings_v1";

export const seedTransactions: Tx[] = [
  { id: "t1", date: "2026-06-01", desc: "Gehalt Roche", category: "Einkommen", amount: 5200 },
  { id: "t2", date: "2026-06-02", desc: "Miete", category: "Wohnen", amount: -1250 },
  { id: "t3", date: "2026-06-03", desc: "Lebensmittel", category: "Essen", amount: -320 },
  { id: "t4", date: "2026-06-04", desc: "ETF Sparplan", category: "Investment", amount: -800 },
  { id: "t5", date: "2026-06-05", desc: "Strom & Internet", category: "Wohnen", amount: -140 },
  { id: "t6", date: "2026-06-06", desc: "Restaurant", category: "Freizeit", amount: -85 },
];

export const seedHoldings: Holding[] = [
  { id: "h1", ticker: "NBIS", name: "Nebius Group", shares: 40, buyPrice: 32, lastPrice: 48 },
  { id: "h2", ticker: "CRWV", name: "CoreWeave", shares: 15, buyPrice: 95, lastPrice: 118 },
  { id: "h3", ticker: "VRT", name: "Vertiv Holdings", shares: 25, buyPrice: 88, lastPrice: 104 },
  { id: "h4", ticker: "ENR", name: "Siemens Energy", shares: 30, buyPrice: 41, lastPrice: 62 },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, val: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(val));
}

export const loadTransactions = () => read<Tx[]>(KEY_TX, seedTransactions);
export const saveTransactions = (t: Tx[]) => write(KEY_TX, t);
export const loadHoldings = () => read<Holding[]>(KEY_HOLD, seedHoldings);
export const saveHoldings = (h: Holding[]) => write(KEY_HOLD, h);

export const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export const eur2 = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export const uid = () => Math.random().toString(36).slice(2, 10);
