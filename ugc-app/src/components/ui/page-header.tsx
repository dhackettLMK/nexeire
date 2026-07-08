import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";

/**
 * Standard page masthead: eyebrow tag, Fraunces display title, supporting copy,
 * and an optional right-aligned actions slot. Used at the top of every page.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1
          className={cn(
            "font-display text-3xl font-medium leading-[1.1] tracking-tight text-balance sm:text-4xl",
            eyebrow && "mt-4",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-base leading-7 text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}

/** Smaller section heading used inside a page (eyebrow optional + serif title). */
export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2
          className={cn(
            "font-display text-xl font-medium tracking-tight sm:text-2xl",
            eyebrow && "mt-3",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
