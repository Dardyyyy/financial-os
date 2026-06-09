export default function Logo({ size = 40, rounded = 12 }: { size?: number; rounded?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Financial OS">
      <defs>
        <linearGradient id="fosg" x1="6" y1="40" x2="42" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5B544" />
          <stop offset="1" stopColor="#5EEAD4" />
        </linearGradient>
        <filter id="fosglow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx={rounded} fill="#0B1020" stroke="#26314D" />
      {/* aufsteigende Candlesticks */}
      <rect x="11" y="27" width="3" height="9" rx="1.5" fill="url(#fosg)" opacity="0.85" />
      <rect x="18" y="22" width="3" height="14" rx="1.5" fill="url(#fosg)" opacity="0.85" />
      <rect x="25" y="17" width="3" height="19" rx="1.5" fill="url(#fosg)" opacity="0.85" />
      {/* Aufwaerts-Linie mit Pfeilspitze */}
      <g filter="url(#fosglow)">
        <path d="M9 32 L19 24 L27 28 L39 13" stroke="url(#fosg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M33 12.5 L40 12 L39.4 19" stroke="url(#fosg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}
