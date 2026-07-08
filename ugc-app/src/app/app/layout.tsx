import Link from "next/link";
import { LogOut } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import {
  getCurrentOrganizationForUser,
  requireUser,
} from "@/lib/customer/organization";
import { AppNav, type NavItem } from "./app-nav";

const navItems: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: "dashboard" },
  { href: "/app/brand", label: "Brand", icon: "brand" },
  { href: "/app/assets", label: "Uploads", icon: "broll" },
  { href: "/app/inbox", label: "Videos", icon: "inbox" },
];

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { supabase, user } = await requireUser("/app");
  const { organization } = await getCurrentOrganizationForUser(supabase, user);
  const visibleNavItems: NavItem[] = organization
    ? navItems
    : [{ href: "/app/setup", label: "Setup", icon: "setup" }];
  const orgName = organization?.name ?? "Setup";
  const orgInitial = orgName.charAt(0).toUpperCase();

  return (
    <div className="app-canvas min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[17rem] flex-col border-r border-border/70 bg-sidebar/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/app" className="group block rounded-2xl px-2 py-1">
          <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.32em] text-primary">
            Nexeire
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
              {orgInitial}
            </span>
            <p className="truncate font-display text-lg font-medium tracking-tight">
              {orgName}
            </p>
          </div>
        </Link>

        <AppNav items={visibleNavItems} />

        <form action="/logout" method="post" className="mt-auto pt-6">
          <button
            className={buttonClasses({
              variant: "outline",
              size: "sm",
              className: "w-full text-muted-foreground hover:text-foreground",
            })}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </aside>
      <div className="lg:pl-[17rem]">
        <main className="mx-auto w-full max-w-6xl px-5 py-10 lg:px-10 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
