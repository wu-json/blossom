import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "text-white shadow-md hover:shadow-lg",
        ghost: "",
        outline: "bg-transparent",
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
            color: "var(--text)",
            ...style,
          }
        : {
            border: "1px solid var(--border)",
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
          } else {
            e.currentTarget.style.backgroundColor = "var(--border)";
          }
        }}
        onMouseLeave={(e) => {
          if (variant === "default") {
            e.currentTarget.style.backgroundColor = "var(--primary)";
          } else {
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
