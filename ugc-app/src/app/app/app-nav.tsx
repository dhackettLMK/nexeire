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

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-8 grid gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
              "transition-[background-color,box-shadow,color,ring-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/[0.06]"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary",
                "transition-opacity duration-300",
                active ? "opacity-100" : "opacity-0",
              )}
              aria-hidden="true"
            />
            <Icon
              className={cn(
                "size-[1.05rem] shrink-0 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground",
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
