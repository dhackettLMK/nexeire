import { cn } from "@/lib/utils";

/** Workspace avatar: the uploaded brand logo when present, otherwise the
 *  organization's initial on a solid tile. Used anywhere the app shell
 *  represents the current workspace (sidebar, mobile topbar). */
export function WorkspaceAvatar({
  logoUrl,
  initial,
  size = 36,
  className,
}: {
  logoUrl: string | null;
  initial: string;
  size?: number;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <span
        className={cn(
          "block shrink-0 overflow-hidden rounded-xl bg-card ring-1 ring-border",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}
