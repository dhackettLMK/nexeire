import { cn } from "@/lib/utils";
import { Card } from "./card";

/** Centered placeholder for empty lists/sections. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-dashed py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {icon}
        </span>
      ) : null}
      <h3 className="font-display text-lg font-medium tracking-tight">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}
