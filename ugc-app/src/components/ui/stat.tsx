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
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-primary/80">
          {label}
        </p>
        {icon ? (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              accent === "positive" && "bg-emerald-400/10 text-emerald-300",
              accent === "warning" && "bg-amber-400/10 text-amber-300",
              (!accent || accent === "default") &&
                "bg-accent text-accent-foreground",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-4xl font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );
}
