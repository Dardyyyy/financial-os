// Hybrid-Speicher: nutzt Firestore wenn konfiguriert, sonst localStorage.
// Alle Funktionen sind async, damit Cloud und lokal gleich behandelt werden.

import { db, cloudEnabled } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type Tx = {
  id: string;
  date: string;
  desc: string;
  category: string;
  amount: number; // + Einnahme, - Ausgabe
};

export type Holding = {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  buyPrice: number;
  lastPrice: number;
  kind: "stock" | "crypto";
  cgId?: string; // CoinGecko-ID fuer Krypto (z.B. "bitcoin")
};

const KEY_TX = "fos_transactions_v2";
const KEY_HOLD = "fos_holdings_v2";

export const seedTransactions: Tx[] = [
  { id: "t1", date: "2026-06-01", desc: "Gehalt Roche", category: "Einkommen", amount: 5200 },
  { id: "t2", date: "2026-06-02", desc: "Miete", category: "Wohnen", amount: -1250 },
  { id: "t3", date: "2026-06-03", desc: "Lebensmittel", category: "Essen", amount: -320 },
  { id: "t4", date: "2026-06-04", desc: "ETF Sparplan", category: "Investment", amount: -800 },
  { id: "t5", date: "2026-06-05", desc: "Strom & Internet", category: "Wohnen", amount: -140 },
  { id: "t6", date: "2026-06-06", desc: "Restaurant", category: "Freizeit", amount: -85 },
];

export const seedHoldings: Holding[] = [
  { id: "h1", ticker: "NBIS", name: "Nebius Group", shares: 40, buyPrice: 32, lastPrice: 48, kind: "stock" },
  { id: "h2", ticker: "CRWV", name: "CoreWeave", shares: 15, buyPrice: 95, lastPrice: 118, kind: "stock" },
  { id: "h3", ticker: "VRT", name: "Vertiv Holdings", shares: 25, buyPrice: 88, lastPrice: 104, kind: "stock" },
  { id: "h4", ticker: "ENR", name: "Siemens Energy", shares: 30, buyPrice: 41, lastPrice: 62, kind: "stock" },
];

// ---------- localStorage helpers ----------
function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function writeLocal<T>(key: string, val: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(val));
}

// ---------- Firestore helpers (ein Dokument pro Sammlung) ----------
async function readCloud<T>(docId: string, fallback: T): Promise<T> {
  if (!db) return fallback;
  try {
    const snap = await getDoc(doc(db, "financial-os", docId));
    if (snap.exists() && snap.data().items !== undefined) {
      return snap.data().items as T;
    }
    // Erstbefuellung mit Seed
    await setDoc(doc(db, "financial-os", docId), { items: fallback });
    return fallback;
  } catch (e) {
    console.error("Firestore read error:", e);
    return readLocal(docId === "transactions" ? KEY_TX : KEY_HOLD, fallback);
  }
}
async function writeCloud<T>(docId: string, val: T) {
  if (!db) return;
  try {
    await setDoc(doc(db, "financial-os", docId), { items: val });
  } catch (e) {
    console.error("Firestore write error:", e);
  }
}

// ---------- Public API ----------
export async function loadTransactions(): Promise<Tx[]> {
  if (cloudEnabled && db) return readCloud<Tx[]>("transactions", seedTransactions);
  return readLocal<Tx[]>(KEY_TX, seedTransactions);
}
export async function saveTransactions(t: Tx[]) {
  if (cloudEnabled && db) return writeCloud("transactions", t);
  writeLocal(KEY_TX, t);
}
export async function loadHoldings(): Promise<Holding[]> {
  if (cloudEnabled && db) return readCloud<Holding[]>("holdings", seedHoldings);
  return readLocal<Holding[]>(KEY_HOLD, seedHoldings);
}
export async function saveHoldings(h: Holding[]) {
  if (cloudEnabled && db) return writeCloud("holdings", h);
  writeLocal(KEY_HOLD, h);
}

// ---------- Formatting ----------
export const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
export const eur2 = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
export const uid = () => Math.random().toString(36).slice(2, 10);
export { cloudEnabled };
