"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ToastInput, useToast } from "@/components/ui/toast";

function generatedToast(pathname: string): ToastInput {
  if (pathname === "/app/inbox") {
    return {
      title: "Video generation started.",
      description: "Check the video inbox page for status updates.",
      variant: "success",
    };
  }

  return { title: "Generation finished.", variant: "success" };
}

function savedToast(pathname: string): ToastInput {
  if (pathname === "/app/brand") {
    return { title: "Brand intake saved.", variant: "success" };
  }

  if (pathname.endsWith("/assets")) {
    return { title: "Asset saved.", variant: "success" };
  }

  return { title: "Changes saved.", variant: "success" };
}

function toastsForParams(pathname: string, params: URLSearchParams) {
  const toasts: ToastInput[] = [];
  const consumedParams = new Set<string>();

  if (params.get("saved") === "1") {
    toasts.push(savedToast(pathname));
    consumedParams.add("saved");
  }

  if (params.get("generated") === "1") {
    toasts.push(generatedToast(pathname));
    consumedParams.add("generated");
  }

  return { toasts, consumedParams };
}

export function RouteToastBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const lastHandledRef = React.useRef<string | null>(null);
  const search = searchParams.toString();

  React.useEffect(() => {
    const handledKey = `${pathname}?${search}`;

    if (!search || lastHandledRef.current === handledKey) {
      return;
    }

    const currentParams = new URLSearchParams(search);
    const { toasts, consumedParams } = toastsForParams(pathname, currentParams);

    if (toasts.length === 0) {
      return;
    }

    lastHandledRef.current = handledKey;
    toasts.forEach((toast) => showToast(toast));
    consumedParams.forEach((param) => currentParams.delete(param));

    const nextSearch = currentParams.toString();
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, search, showToast]);

  return null;
}
