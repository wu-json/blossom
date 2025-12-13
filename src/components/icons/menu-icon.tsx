import * as React from "react";

interface MenuIconProps {
  isOpen: boolean;
  className?: string;
}

export function MenuIcon({ isOpen, className }: MenuIconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={{ color: "var(--text-muted)" }}
    >
      {/* Five petals that bloom outward when open */}
      {[0, 72, 144, 216, 288].map((rotation, i) => (
        <ellipse
          key={i}
          cx="10"
          cy="10"
          rx="2.5"
          ry={isOpen ? "6" : "4"}
          fill="currentColor"
          opacity={isOpen ? 0.7 : 0.5}
          style={{
            transformOrigin: "10px 10px",
            transform: `rotate(${rotation}deg) translateY(${isOpen ? -3 : -1}px)`,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      ))}
      {/* Center circle */}
      <circle
        cx="10"
        cy="10"
        r={isOpen ? "3" : "3.5"}
        fill="currentColor"
        style={{
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </svg>
  );
}
