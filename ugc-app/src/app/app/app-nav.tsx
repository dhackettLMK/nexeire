"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  Settings,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icons live here (client side) so the server layout only passes serializable
// data across the boundary — component references can't be serialized.
const ICONS = {
  dashboard: LayoutDashboard,
  brand: MessagesSquare,
  broll: UploadCloud,
  inbox: Inbox,
  setup: Settings,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

// Row height + gap the sliding indicator below is keyed to (h-11 + gap-1).
const NAV_ROW_HEIGHT = 44;
const NAV_ROW_GAP = 4;

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const activeIndex = items.findIndex((item) =>
    item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href),
  );

  return (
    <nav className="relative mt-8 grid gap-1" aria-label="Primary">
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/25",
          "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "motion-reduce:transition-none",
          activeIndex === -1 && "opacity-0",
        )}
        style={{
          transform: `translateY(${Math.max(activeIndex, 0) * (NAV_ROW_HEIGHT + NAV_ROW_GAP)}px)`,
        }}
      />
      {items.map((item, index) => {
        const Icon = ICONS[item.icon];
        const active = index === activeIndex;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative z-10 inline-flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
              "transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-[1.05rem] shrink-0 transition-colors duration-200",
                active
                  ? "text-primary"
                  : "text-muted-foreground/80 group-hover:text-foreground",
              )}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
