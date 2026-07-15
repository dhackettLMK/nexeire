import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pill button with spring-physics hover. Use `buttonClasses(...)` directly on
 * `next/link` / `<a>` / form `<button>` elements throughout the app.
 */
export const buttonClasses = cva(
  cn(
    "group inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,filter,opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
    "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "motion-reduce:transition-none motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    variants: {
      variant: {
        primary: cn(
          "bg-linear-to-br from-[#6366f1] to-[#8b94fa] text-white",
          "shadow-[0_0_28px_rgba(99,102,241,0.35),0_2px_8px_rgba(5,5,16,0.5)]",
          "hover:brightness-110 hover:-translate-y-px",
          "hover:shadow-[0_0_44px_rgba(99,102,241,0.5),0_4px_12px_rgba(5,5,16,0.5)]",
          "motion-reduce:hover:translate-y-0",
        ),
        secondary:
          "bg-card text-foreground ring-1 ring-primary/20 shadow-sm hover:ring-primary/40 hover:shadow-[0_0_24px_rgba(99,102,241,0.18)]",
        ghost: "text-foreground hover:bg-accent",
        outline:
          "ring-1 ring-input text-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-[0.9375rem]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonClasses>;

/** Icon-only command button with a 40-44px hit target. */
export const iconButtonClasses = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground",
    "transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
    "active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "motion-reduce:transition-none motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    variants: {
      variant: {
        ghost: "hover:bg-accent hover:text-foreground",
        outline:
          "ring-1 ring-primary/20 hover:bg-accent hover:text-foreground hover:ring-primary/40",
      },
      size: {
        sm: "size-10",
        md: "size-11",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "sm",
    },
  },
);

/**
 * "Button-in-button" trailing icon: the icon lives inside its own circular
 * wrapper and drifts diagonally on group hover for internal kinetic tension.
 */
export function ButtonIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "-mr-2 flex size-7 items-center justify-center rounded-full bg-white/15 text-current",
        "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "group-hover:translate-x-0.5 group-hover:-translate-y-px",
        "motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0",
        className,
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
