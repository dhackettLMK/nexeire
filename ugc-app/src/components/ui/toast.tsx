"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { Toast } from "radix-ui";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastRecord = ToastInput & {
  id: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function createToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") {
    return <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />;
  }

  if (variant === "error") {
    return <CircleAlert className="size-4 text-destructive" aria-hidden="true" />;
  }

  return <Info className="size-4 text-primary" aria-hidden="true" />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = React.useCallback((toast: ToastInput) => {
    setToasts((current) => [
      ...current,
      {
        id: createToastId(),
        variant: toast.variant ?? "info",
        ...toast,
      },
    ]);
  }, []);

  const contextValue = React.useMemo(() => ({ showToast }), [showToast]);

  return (
    <Toast.Provider swipeDirection="right" duration={4200}>
      <ToastContext.Provider value={contextValue}>{children}</ToastContext.Provider>
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          duration={toast.duration}
          open
          onOpenChange={(open) => {
            if (!open) {
              dismissToast(toast.id);
            }
          }}
          className={cn(
            "grid w-[min(420px,calc(100vw_-_32px))] grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-primary/25",
            "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-2",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-right-4",
            "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full",
          )}
        >
          <ToastIcon variant={toast.variant} />
          <div className="grid gap-1">
            <Toast.Title className="font-semibold text-foreground">
              {toast.title}
            </Toast.Title>
            {toast.description ? (
              <Toast.Description className="leading-5 text-muted-foreground">
                {toast.description}
              </Toast.Description>
            ) : null}
          </div>
          <Toast.Close className="-mr-2 -mt-2 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Dismiss notification</span>
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed right-4 top-4 z-50 grid gap-3 outline-none sm:right-6 sm:top-6" />
    </Toast.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
