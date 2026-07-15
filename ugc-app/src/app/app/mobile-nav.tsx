"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { LogOut, Menu, X } from "lucide-react";
import { buttonClasses, iconButtonClasses } from "@/components/ui/button";
import { AppNav, type NavItem } from "./app-nav";

/**
 * Below `lg` the sidebar in AppLayout is hidden entirely, so this renders the
 * sticky glass topbar + slide-over sheet that gives small screens the same
 * Dashboard / Brand / Uploads / Videos navigation, unchanged in content.
 */
export function MobileNav({
  items,
  orgName,
  orgInitial,
}: {
  items: NavItem[];
  orgName: string;
  orgInitial: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="app-glass sticky top-0 z-30 flex items-center justify-between border-b border-border/70 px-5 py-4 lg:hidden">
        <Link href="/app" className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
            {orgInitial}
          </span>
          <span className="truncate text-base font-semibold tracking-tight text-foreground">
            {orgName}
          </span>
        </Link>
        <Dialog.Trigger
          className={buttonClasses({
            variant: "outline",
            size: "sm",
            className: "px-3",
          })}
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Dialog.Trigger>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay
          className={
            "fixed inset-0 z-40 bg-[#050510]/60 backdrop-blur-sm lg:hidden " +
            "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:duration-200 " +
            "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:duration-150"
          }
        />
        <Dialog.Content
          className={
            "app-glass fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-xs flex-col border-r border-border/70 px-4 py-6 shadow-xl outline-none lg:hidden " +
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=open]:duration-300 " +
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=closed]:duration-200"
          }
        >
          <div className="flex items-center justify-between px-2">
            <Dialog.Title className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.32em] text-primary">
              Nexeire
            </Dialog.Title>
            <Dialog.Close
              className={iconButtonClasses({ variant: "outline" })}
              aria-label="Close navigation menu"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Navigate the Nexeire app: Dashboard, Brand, Uploads, and Videos.
          </Dialog.Description>

          <div onClick={() => setOpen(false)}>
            <AppNav items={items} />
          </div>

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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
