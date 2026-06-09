/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B1020",
        panel: "#111A2E",
        panel2: "#172238",
        line: "#26314D",
        gold: "#F5B544",
        golddim: "#C28A2E",
        mint: "#5EEAD4",
        good: "#5EEAD4",
        bad: "#FB7185",
        muted: "#8794B0",
        ink2: "#E8ECF6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245,181,68,0.0), 0 8px 40px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
