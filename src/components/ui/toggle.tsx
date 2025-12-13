import * as React from "react";
import { cn } from "../../lib/utils";

export interface ToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, pressed, children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={pressed}
        className={cn(
          "inline-flex items-center justify-center rounded-xl p-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          className
        )}
        style={{
          backgroundColor: pressed ? "var(--border)" : "transparent",
          ...style,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--border)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = pressed
            ? "var(--border)"
            : "transparent";
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Toggle.displayName = "Toggle";

export { Toggle };
