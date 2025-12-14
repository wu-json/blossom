interface BlossomIconProps {
  className?: string;
  style?: React.CSSProperties;
}

export function BlossomIcon({ className, style }: BlossomIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
    >
      {/* 5 petals arranged around center */}
      <ellipse cx="12" cy="5.5" rx="3" ry="4.5" />
      <ellipse cx="12" cy="5.5" rx="3" ry="4.5" transform="rotate(72 12 12)" />
      <ellipse cx="12" cy="5.5" rx="3" ry="4.5" transform="rotate(144 12 12)" />
      <ellipse cx="12" cy="5.5" rx="3" ry="4.5" transform="rotate(216 12 12)" />
      <ellipse cx="12" cy="5.5" rx="3" ry="4.5" transform="rotate(288 12 12)" />
      {/* Center circle */}
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
