import "../styles/globals.css";
import { useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export default function App({ Component, pageProps }: AppProps) {
  // Cursor-gesteuerte 3D-Neigung + Lichtschein auf allen .card-Elementen (nur Maus, ohne reduced-motion)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let cur: HTMLElement | null = null;
    const reset = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };
    const onMove = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest(".card") as HTMLElement | null;
      if (t !== cur) { reset(cur); cur = t; }
      if (!t) return;
      const r = t.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const max = 5.5;
      t.style.setProperty("--rx", `${(px - 0.5) * 2 * max}deg`);
      t.style.setProperty("--ry", `${-(py - 0.5) * 2 * max}deg`);
      t.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      t.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <>
      <Head>
        <title>Financial OS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0B1020" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
      </Head>
      <div className={`${display.variable} ${sans.variable} ${mono.variable} min-h-screen`}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
