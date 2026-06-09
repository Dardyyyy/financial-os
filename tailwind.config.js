/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0e17",
        panel: "#121826",
        panel2: "#1a2234",
        line: "#243049",
        accent: "#3b82f6",
        accent2: "#22d3ee",
        good: "#34d399",
        bad: "#f87171",
        muted: "#8b98b3",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
