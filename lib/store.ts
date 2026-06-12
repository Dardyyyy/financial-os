// Hybrid-Speicher mit lokalem Safety-Net: schreibt IMMER localStorage und
// zusaetzlich Firestore (wenn konfiguriert). Liest Firestore, faellt bei
// Fehlern/leeren Daten auf localStorage zurueck -> Daten gehen nie verloren.

import { db, cloudEnabled, auth } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type Currency = "EUR" | "USD" | "CHF";
export type Tx = { id: string; date: string; desc: string; category: string; amount: number; currency: Currency };
export type Holding = {
  id: string; ticker: string; name: string; shares: number; buyPrice: number; lastPrice: number;
  kind: "stock" | "crypto"; currency: "USD" | "EUR"; cgId?: string;
};
export type Msg = { role: "user" | "assistant"; content: string };
export type SavedNote = { id: string; mode: string; label: string; text: string; ts: number };
export type ChatSession = { id: string; title: string; mode: string; country: "DE" | "CH"; messages: Msg[]; ts: number };
export type FixedCost = { id: string; name: string; amount: number };                 // monatlich wiederkehrend
export type OneTimeCost = { id: string; name: string; amount: number; month: number }; // month 1..12 (Jan..Dez)
export type BudgetData = { income: number; fixed: FixedCost[]; oneTime: OneTimeCost[] };
export type AssetKind = "immobilie" | "bargeld" | "edelmetall" | "beteiligung" | "sonstiges";
export type Mortgage = { price: number; equity: number; ratePct: number; tilgungPct: number; start: string }; // start "YYYY-MM"
export type Asset = { id: string; name: string; kind: AssetKind; value: number; debt: number; note?: string; mortgage?: Mortgage };

const KEY_TX = "fos_transactions_v3";
const KEY_HOLD = "fos_holdings_v3";
const KEY_WATCH = "fos_watchlist_v1";
const KEY_CHATS = "fos_chats_v1";
const KEY_NOTES = "fos_notes_v1";
const KEY_BUDGET = "fos_budget_v1";
const KEY_ASSETS = "fos_assets_v1";

export const seedTransactions: Tx[] = [
  { id: "t1", date: "2026-06-01", desc: "Gehalt Roche", category: "Einkommen", amount: 5200, currency: "EUR" },
  { id: "t2", date: "2026-06-02", desc: "Miete", category: "Wohnen", amount: -1250, currency: "EUR" },
  { id: "t3", date: "2026-06-03", desc: "Lebensmittel", category: "Essen", amount: -320, currency: "EUR" },
  { id: "t4", date: "2026-06-04", desc: "ETF Sparplan", category: "Investment", amount: -800, currency: "EUR" },
  { id: "t5", date: "2026-06-05", desc: "Strom & Internet", category: "Wohnen", amount: -140, currency: "EUR" },
];
export const seedHoldings: Holding[] = [
  { id: "h1", ticker: "NBIS", name: "Nebius Group", shares: 40, buyPrice: 32, lastPrice: 48, kind: "stock", currency: "USD" },
  { id: "h2", ticker: "CRWV", name: "CoreWeave", shares: 15, buyPrice: 95, lastPrice: 118, kind: "stock", currency: "USD" },
  { id: "h3", ticker: "VRT", name: "Vertiv Holdings", shares: 25, buyPrice: 88, lastPrice: 104, kind: "stock", currency: "USD" },
  { id: "h4", ticker: "ENR", name: "Siemens Energy", shares: 30, buyPrice: 41, lastPrice: 62, kind: "stock", currency: "EUR" },
];
export const defaultWatchlist = ["NBIS", "CRWV", "VRT", "NVDA", "AMD", "AVGO", "GEV", "VST", "CEG", "ETN", "ANET", "TSM"];

// Ticker -> ausgeschriebener Firmenname (fuer schoenere Anzeige)
export const COMPANY_NAMES: Record<string, string> = {
  NBIS: "Nebius Group", CRWV: "CoreWeave", VRT: "Vertiv Holdings", NVDA: "NVIDIA", AMD: "Advanced Micro Devices",
  AVGO: "Broadcom", GEV: "GE Vernova", VST: "Vistra", CEG: "Constellation Energy", ETN: "Eaton",
  ANET: "Arista Networks", TSM: "Taiwan Semiconductor", MSCI: "MSCI Inc.", ENR: "Siemens Energy", SMCI: "Super Micro Computer",
  AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Alphabet (Google)", GOOG: "Alphabet (Google)", AMZN: "Amazon",
  META: "Meta Platforms", TSLA: "Tesla", NFLX: "Netflix", INTC: "Intel", MU: "Micron Technology",
  DELL: "Dell Technologies", PLTR: "Palantir", ORCL: "Oracle", CRM: "Salesforce", ADBE: "Adobe",
  QCOM: "Qualcomm", TXN: "Texas Instruments", MRVL: "Marvell", ASML: "ASML", ARM: "Arm Holdings",
  COIN: "Coinbase", MSTR: "MicroStrategy", PYPL: "PayPal", SHOP: "Shopify", UBER: "Uber",
  DIS: "Walt Disney", BA: "Boeing", JPM: "JPMorgan Chase", V: "Visa", MA: "Mastercard",
  KO: "Coca-Cola", PEP: "PepsiCo", MCD: "McDonald's", NKE: "Nike", SBUX: "Starbucks",
  WMT: "Walmart", COST: "Costco", PG: "Procter & Gamble", JNJ: "Johnson & Johnson", PFE: "Pfizer",
  XOM: "Exxon Mobil", CVX: "Chevron", BAC: "Bank of America", AMAT: "Applied Materials", LRCX: "Lam Research",
};
export const companyName = (ticker: string) => COMPANY_NAMES[ticker] || ticker;

export const seedBudget: BudgetData = {
  income: 5200,
  fixed: [
    { id: "f1", name: "Miete", amount: 1250 },
    { id: "f2", name: "Strom & Internet", amount: 140 },
    { id: "f3", name: "Lebensmittel", amount: 420 },
    { id: "f4", name: "Abos & Handy", amount: 80 },
    { id: "f5", name: "Mobilität / Auto", amount: 220 },
  ],
  oneTime: [
    { id: "o1", name: "KFZ-Versicherung", amount: 900, month: 1 },
    { id: "o2", name: "Urlaub", amount: 1800, month: 7 },
    { id: "o3", name: "Geschenke / Weihnachten", amount: 600, month: 12 },
  ],
};

function readLocal<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = window.localStorage.getItem(key); return r ? JSON.parse(r) as T : fb; } catch { return fb; }
}
function writeLocal<T>(key: string, v: T) { if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(v)); }

function cloudRef(docId: string) {
  const u = auth?.currentUser?.uid;
  return (db && u) ? doc(db, "users", u, "data", docId) : null;
}

async function readCloud<T>(docId: string, fb: T, localKey: string): Promise<T> {
  const ref = cloudRef(docId);
  if (!ref) return readLocal(localKey, fb);         // nicht eingeloggt -> lokal
  try {
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().items !== undefined) return snap.data().items as T;
    const fromLocal = readLocal(localKey, fb);
    try { await setDoc(ref, { items: fromLocal }); } catch { /* Regeln? egal */ }
    return fromLocal;
  } catch { return readLocal(localKey, fb); }
}

async function save<T>(localKey: string, docId: string, v: T) {
  writeLocal(localKey, v);                          // immer lokal (Safety-Net)
  const ref = cloudRef(docId);
  if (ref) { try { await setDoc(ref, { items: v }); } catch { /* ignore */ } }
}

export const loadTransactions = () => cloudEnabled ? readCloud("transactions", seedTransactions, KEY_TX) : Promise.resolve(readLocal(KEY_TX, seedTransactions));
export const saveTransactions = (t: Tx[]) => save(KEY_TX, "transactions", t);
export const loadHoldings = () => cloudEnabled ? readCloud("holdings", seedHoldings, KEY_HOLD) : Promise.resolve(readLocal(KEY_HOLD, seedHoldings));
export const saveHoldings = (h: Holding[]) => save(KEY_HOLD, "holdings", h);
export const loadWatchlist = () => cloudEnabled ? readCloud("watchlist", defaultWatchlist, KEY_WATCH) : Promise.resolve(readLocal(KEY_WATCH, defaultWatchlist));
export const saveWatchlist = (w: string[]) => save(KEY_WATCH, "watchlist", w);
export const loadChats = () => cloudEnabled ? readCloud<ChatSession[]>("chats", [], KEY_CHATS) : Promise.resolve(readLocal<ChatSession[]>(KEY_CHATS, []));
export const saveChats = (c: ChatSession[]) => save(KEY_CHATS, "chats", c);
export const loadNotes = () => cloudEnabled ? readCloud<SavedNote[]>("notes", [], KEY_NOTES) : Promise.resolve(readLocal<SavedNote[]>(KEY_NOTES, []));
export const saveNotes = (n: SavedNote[]) => save(KEY_NOTES, "notes", n);
export const loadBudget = () => cloudEnabled ? readCloud<BudgetData>("budget", seedBudget, KEY_BUDGET) : Promise.resolve(readLocal<BudgetData>(KEY_BUDGET, seedBudget));
export const saveBudget = (b: BudgetData) => save(KEY_BUDGET, "budget", b);

export const seedAssets: Asset[] = [
  { id: "as1", name: "Notgroschen (Tagesgeld)", kind: "bargeld", value: 8000, debt: 0 },
];
export const loadAssets = () => cloudEnabled ? readCloud<Asset[]>("assets", seedAssets, KEY_ASSETS) : Promise.resolve(readLocal<Asset[]>(KEY_ASSETS, seedAssets));
export const saveAssets = (a: Asset[]) => save(KEY_ASSETS, "assets", a);

// ---- FX (alles -> EUR) ----
const FB: Record<string, number> = { USD: 0.92, CHF: 1.05 };
export async function getFxToEur(cur: string): Promise<number> {
  if (cur === "EUR") return 1;
  try {
    const r = await fetch(`/api/quote?type=fx&from=${cur}&to=EUR`);
    const d = await r.json();
    if (d?.rate) { if (typeof window !== "undefined") window.localStorage.setItem(`fos_fx_${cur}`, String(d.rate)); return d.rate; }
  } catch { /* ignore */ }
  if (typeof window !== "undefined") { const c = window.localStorage.getItem(`fos_fx_${cur}`); if (c) return parseFloat(c); }
  return FB[cur] ?? 1;
}
export async function getFxMap(curs: string[]): Promise<Record<string, number>> {
  const uniq = Array.from(new Set(curs.filter(c => c !== "EUR")));
  const pairs = await Promise.all(uniq.map(async c => [c, await getFxToEur(c)] as const));
  return Object.fromEntries([["EUR", 1], ...pairs]);
}
export const getUsdEur = () => getFxToEur("USD");

export const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
export const eur2 = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
export const money = (n: number, c: Currency) => new Intl.NumberFormat("de-DE", { style: "currency", currency: c }).format(n);
export const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export const uid = () => Math.random().toString(36).slice(2, 10);
export { cloudEnabled };
