import { cn } from "@/lib/utils";
import { Card } from "./card";

/** Compact metric tile: mono label, large display value, supporting line. */
export function Stat({
  label,
  value,
  hint,
  icon,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "default" | "positive" | "warning";
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              accent === "positive" && "bg-emerald-50 text-emerald-600",
              accent === "warning" && "bg-amber-50 text-amber-600",
              (!accent || accent === "default") &&
                "bg-accent text-accent-foreground",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-4 font-display text-4xl font-medium tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );
}
