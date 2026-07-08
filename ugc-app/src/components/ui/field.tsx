import { cn } from "@/lib/utils";

/** Shared input/textarea/select styling — soft ring, no hard gray border. */
export const inputClasses = cn(
  "w-full rounded-xl bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm ring-1 ring-input",
  "transition-shadow duration-200 placeholder:text-muted-foreground/60",
  "focus:outline-none focus:ring-2 focus:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export function Label({
  className,
  children,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-sm font-medium text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

/** Label + control wrapper with consistent vertical rhythm. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
