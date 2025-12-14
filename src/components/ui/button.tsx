import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        default: "text-white",
        ghost: "hover:bg-black/5 dark:hover:bg-white/5",
        outline: "bg-transparent border",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, style, ...props }, ref) => {
    const variantStyles: React.CSSProperties =
      variant === "default"
        ? {
            backgroundColor: "var(--primary)",
            ...style,
          }
        : variant === "ghost"
        ? {
            color: "var(--text-muted)",
            ...style,
          }
        : {
            borderColor: "var(--border)",
            color: "var(--text)",
            ...style,
          };

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={variantStyles}
        onMouseEnter={(e) => {
          if (variant === "default") {
            e.currentTarget.style.backgroundColor = "var(--primary-hover)";
          }
        }}
        onMouseLeave={(e) => {
          if (variant === "default") {
            e.currentTarget.style.backgroundColor = "var(--primary)";
          }
        }}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
