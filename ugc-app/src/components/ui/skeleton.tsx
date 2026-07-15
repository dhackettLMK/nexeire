import { cn } from "@/lib/utils";

/** Pulsing placeholder surface for route-level loading states. */
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-muted/60 motion-reduce:animate-none",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Standard page-masthead skeleton: eyebrow pill + title + description lines. */
export function PageHeaderSkeleton() {
  return (
    <div>
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="mt-4 h-9 w-64 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
    </div>
  );
}
