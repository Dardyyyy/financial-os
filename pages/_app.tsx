import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Financial OS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0B1020" />
      </Head>
      <div className={`${display.variable} ${sans.variable} ${mono.variable} min-h-screen`}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
