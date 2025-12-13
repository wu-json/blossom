interface FlowerIconProps {
  className?: string;
  style?: React.CSSProperties;
}

// Japanese Cherry Blossom (桜) - delicate 5-petal flower with notched petals
export function SakuraIcon({ className, style }: FlowerIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} style={style}>
      {/* 5 heart-shaped petals */}
      <path d="M32 8 C28 8, 24 12, 24 18 C24 22, 27 26, 32 28 C37 26, 40 22, 40 18 C40 12, 36 8, 32 8" transform="rotate(0 32 32)" />
      <path d="M32 8 C28 8, 24 12, 24 18 C24 22, 27 26, 32 28 C37 26, 40 22, 40 18 C40 12, 36 8, 32 8" transform="rotate(72 32 32)" />
      <path d="M32 8 C28 8, 24 12, 24 18 C24 22, 27 26, 32 28 C37 26, 40 22, 40 18 C40 12, 36 8, 32 8" transform="rotate(144 32 32)" />
      <path d="M32 8 C28 8, 24 12, 24 18 C24 22, 27 26, 32 28 C37 26, 40 22, 40 18 C40 12, 36 8, 32 8" transform="rotate(216 32 32)" />
      <path d="M32 8 C28 8, 24 12, 24 18 C24 22, 27 26, 32 28 C37 26, 40 22, 40 18 C40 12, 36 8, 32 8" transform="rotate(288 32 32)" />
      {/* Center */}
      <circle cx="32" cy="32" r="6" />
    </svg>
  );
}

// Chinese Plum Blossom (梅花) - 5 round petals with prominent stamens
export function MeiHuaIcon({ className, style }: FlowerIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} style={style}>
      {/* 5 round petals */}
      <circle cx="32" cy="12" r="10" transform="rotate(0 32 32)" />
      <circle cx="32" cy="12" r="10" transform="rotate(72 32 32)" />
      <circle cx="32" cy="12" r="10" transform="rotate(144 32 32)" />
      <circle cx="32" cy="12" r="10" transform="rotate(216 32 32)" />
      <circle cx="32" cy="12" r="10" transform="rotate(288 32 32)" />
      {/* Stamens */}
      <circle cx="32" cy="24" r="1.5" transform="rotate(0 32 32)" />
      <circle cx="32" cy="24" r="1.5" transform="rotate(60 32 32)" />
      <circle cx="32" cy="24" r="1.5" transform="rotate(120 32 32)" />
      <circle cx="32" cy="24" r="1.5" transform="rotate(180 32 32)" />
      <circle cx="32" cy="24" r="1.5" transform="rotate(240 32 32)" />
      <circle cx="32" cy="24" r="1.5" transform="rotate(300 32 32)" />
      {/* Center */}
      <circle cx="32" cy="32" r="5" />
    </svg>
  );
}

// Korean Rose of Sharon (무궁화) - 5 broad petals with layered center
export function MugunghwaIcon({ className, style }: FlowerIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} style={style}>
      {/* 5 broad, slightly overlapping petals */}
      <ellipse cx="32" cy="14" rx="9" ry="14" transform="rotate(0 32 32)" />
      <ellipse cx="32" cy="14" rx="9" ry="14" transform="rotate(72 32 32)" />
      <ellipse cx="32" cy="14" rx="9" ry="14" transform="rotate(144 32 32)" />
      <ellipse cx="32" cy="14" rx="9" ry="14" transform="rotate(216 32 32)" />
      <ellipse cx="32" cy="14" rx="9" ry="14" transform="rotate(288 32 32)" />
      {/* Distinctive pistil/stamen column */}
      <ellipse cx="32" cy="32" rx="4" ry="4" />
      <circle cx="32" cy="26" r="2" />
      <circle cx="32" cy="22" r="1.5" />
    </svg>
  );
}
