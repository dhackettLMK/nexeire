import { cn } from "@/lib/utils";

/** Microscopic uppercase mono pill that precedes a section heading. */
export function Eyebrow({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span className={cn("eyebrow", className)} {...props}>
      {children}
    </span>
  );
}
