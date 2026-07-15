import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Small status pill on the dark palette: mono, uppercase, luminous tint + hairline ring. */
export const badgeClasses = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] ring-1 whitespace-nowrap",
  {
    variants: {
      variant: {
        muted: "bg-muted text-muted-foreground ring-border",
        primary: "bg-primary/10 text-primary ring-primary/30",
        success: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
        warning: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
        danger: "bg-red-400/10 text-red-300 ring-red-400/30",
        outline: "bg-transparent text-primary ring-primary/30",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeClasses>["variant"]>;

export function Badge({
  variant,
  className,
  children,
  dot = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeClasses> & {
    /** Leading status dot, like the marketing site's "● Early access" pill. */
    dot?: boolean;
  }) {
  return (
    <span className={cn(badgeClasses({ variant }), className)} {...props}>
      {dot ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
