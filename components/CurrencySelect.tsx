import { Currency, CURRENCIES } from "../lib/store";

export default function CurrencySelect({ value, onChange, label = "Währung" }: { value: Currency; onChange: (c: Currency) => void; label?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      {label && <span className="text-xs text-muted">{label}</span>}
      <div className="inline-flex p-0.5 rounded-xl bg-panel2/60 border border-line">
        {CURRENCIES.map(c => (
          <button key={c} onClick={() => onChange(c)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
            style={value === c ? { background: "#F5B544", color: "#0B1020" } : { color: "#8794B0" }}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
