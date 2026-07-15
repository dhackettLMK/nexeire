import { cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

const cardSurface = cn(
  "rounded-2xl bg-card p-6 text-card-foreground shadow-sm ring-1 ring-primary/15",
  "shadow-[inset_0_1px_0_0_rgba(165,180,252,0.07)]",
);

/**
 * Premium dark surface card. Periwinkle-tinted hairline ring + a faint inner
 * top highlight for a "machined glass" feel on the violet-black canvas.
 * Pass `asChild` to apply the surface to the single child element (e.g. a form).
 */
export function Card({
  className,
  children,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return cloneElement(child, {
      className: cn(cardSurface, className, child.props.className),
    });
  }

  return (
    <div className={cn(cardSurface, className)} {...props}>
      {children}
    </div>
  );
}

/** Card variant that lifts on hover — used for clickable navigation tiles. */
export function CardLink({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group rounded-2xl bg-card p-6 text-card-foreground shadow-sm ring-1 ring-primary/15",
        "transition-[box-shadow,transform,ring-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "hover:-translate-y-1 hover:ring-primary/40 hover:shadow-[0_0_36px_rgba(99,102,241,0.22),0_18px_40px_-16px_rgba(5,5,16,0.6)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
