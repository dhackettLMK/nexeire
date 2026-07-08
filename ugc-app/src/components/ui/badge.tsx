import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Small status pill: mono, uppercase, hairline ring. */
export const badgeClasses = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] ring-1 whitespace-nowrap",
  {
    variants: {
      variant: {
        muted: "bg-muted text-muted-foreground ring-foreground/10",
        primary: "bg-primary/10 text-primary ring-primary/20",
        success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
        danger: "bg-red-50 text-red-700 ring-red-600/20",
        outline: "bg-card text-foreground ring-foreground/15",
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
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeClasses>) {
  return (
    <span className={cn(badgeClasses({ variant }), className)} {...props}>
      {children}
    </span>
  );
}
