import Link from "next/link";
import { LogOut } from "lucide-react";
import { signedOrganizationLogoUrl } from "@/lib/assets/logo";
import { BrandMark } from "@/components/ui/brand-mark";
import { buttonClasses } from "@/components/ui/button";
import { WorkspaceAvatar } from "@/components/ui/workspace-avatar";
import {
  getCurrentOrganizationForUser,
  requireUser,
} from "@/lib/customer/organization";
import { AppNav, type NavItem } from "./app-nav";
import { MobileNav } from "./mobile-nav";

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
  const logoUrl = await signedOrganizationLogoUrl(
    supabase,
    organization?.logo_path ?? null,
  );

  return (
    <div className="app-canvas min-h-dvh">
      <MobileNav
        items={visibleNavItems}
        orgName={orgName}
        orgInitial={orgInitial}
        logoUrl={logoUrl}
      />
      <aside className="app-glass fixed inset-y-0 left-0 z-20 hidden w-[17rem] flex-col border-r border-border/70 px-4 py-6 lg:flex">
        <Link href="/app" className="group block rounded-2xl px-2 py-1">
          <span className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <span className="text-gradient-brand text-xl font-bold tracking-tight">
              nexeire
            </span>
          </span>
          <div className="mt-4 flex items-center gap-3">
            <WorkspaceAvatar logoUrl={logoUrl} initial={orgInitial} size={36} />
            <p className="truncate text-lg font-semibold tracking-tight text-foreground">
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
        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
