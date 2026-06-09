import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, type User,
} from "firebase/auth";
import { auth } from "./firebase";
import Logo from "../components/Logo";

type SimpleUser = { email: string };
type Ctx = { user: SimpleUser | null; logout: () => void };
const AuthCtx = createContext<Ctx>({ user: null, logout: () => {} });
export const useAuth = () => useContext(AuthCtx);

const FB_ERRORS: Record<string, string> = {
  "auth/invalid-email": "Ungültige E-Mail-Adresse.",
  "auth/missing-password": "Bitte ein Passwort eingeben.",
  "auth/weak-password": "Passwort zu kurz (mind. 6 Zeichen).",
  "auth/email-already-in-use": "Diese E-Mail ist schon registriert — melde dich an.",
  "auth/invalid-credential": "E-Mail oder Passwort falsch.",
  "auth/operation-not-allowed": "E-Mail/Passwort-Login in Firebase aktivieren (Authentication → Sign-in method).",
};

// ---- Lokales Konto (Fallback, nur dieses Gerät) ----
const L_USER = "fos_local_user";
const L_SESSION = "fos_local_session";
const readLocalUser = () => { try { return JSON.parse(localStorage.getItem(L_USER) || "null"); } catch { return null; } };

export function AuthGate({ children }: { children: ReactNode }) {
  const fb = !!auth;
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [localEmail, setLocalEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(fb);

  useEffect(() => {
    if (fb && auth) return onAuthStateChanged(auth, (u) => { setFbUser(u); setLoading(false); });
    if (typeof window !== "undefined") setLocalEmail(localStorage.getItem(L_SESSION));
  }, []);

  const email = fb ? (fbUser?.email ?? null) : localEmail;
  const logout = () => {
    if (fb && auth) signOut(auth);
    else { localStorage.removeItem(L_SESSION); setLocalEmail(null); }
  };

  if (fb && loading) return <div className="min-h-screen grid place-items-center text-muted">Lädt…</div>;
  if (!email) return <LoginScreen firebase={fb} onLocal={(e) => setLocalEmail(e)} />;
  return <AuthCtx.Provider value={{ user: { email }, logout }}>{children}</AuthCtx.Provider>;
}

function LoginScreen({ firebase, onLocal }: { firebase: boolean; onLocal: (email: string) => void }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    const mail = email.trim().toLowerCase();
    if (!mail) return setErr("Bitte E-Mail eingeben.");
    if (pw.length < 6) return setErr("Passwort muss mind. 6 Zeichen haben.");
    setBusy(true);
    try {
      if (firebase && auth) {
        if (signup) await createUserWithEmailAndPassword(auth, mail, pw);
        else await signInWithEmailAndPassword(auth, mail, pw);
      } else {
        // Lokales Konto
        if (signup) {
          localStorage.setItem(L_USER, JSON.stringify({ email: mail, pw: btoa(pw) }));
          localStorage.setItem(L_SESSION, mail);
          onLocal(mail);
        } else {
          const u = readLocalUser();
          if (!u) throw new Error("Noch kein Konto auf diesem Gerät — bitte zuerst registrieren.");
          if (u.email !== mail || u.pw !== btoa(pw)) throw new Error("E-Mail oder Passwort falsch.");
          localStorage.setItem(L_SESSION, mail);
          onLocal(mail);
        }
      }
    } catch (e: any) {
      setErr(FB_ERRORS[e?.code] || e?.message || "Anmeldung fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="card card-hl p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <Logo size={44} />
          <div>
            <div className="display font-semibold text-lg leading-tight">Financial OS</div>
            <div className="text-xs text-muted">{signup ? "Konto erstellen" : "Anmelden"}</div>
          </div>
        </div>
        <div className="space-y-3">
          <input className="input" type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          <input className="input" type="password" placeholder="Passwort (mind. 6 Zeichen)" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          {err && <div className="text-bad text-xs">⚠ {err}</div>}
          <button className="btn w-full" onClick={submit} disabled={busy}>{busy ? "…" : signup ? "Konto erstellen" : "Anmelden"}</button>
        </div>
        <button className="text-xs text-muted hover:text-ink2 mt-4 w-full text-center" onClick={() => { setSignup(s => !s); setErr(""); }}>
          {signup ? "Schon ein Konto? Anmelden" : "Noch kein Konto? Jetzt registrieren"}
        </button>
        {!firebase && <div className="text-[11px] text-muted mt-4 text-center">Lokales Konto (dieses Gerät). Sobald Firebase verbunden ist, wird daraus automatisch ein sicheres Cloud-Login.</div>}
      </div>
    </div>
  );
}
