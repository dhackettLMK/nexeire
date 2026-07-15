"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { pollRendersAction } from "@/app/app/actions";

const POLL_INTERVAL_MS = 30_000;
// ~20 minutes of polling; the stale-job sweep fails orphaned renders after
// the same window, so by attempt 40 the row will have flipped to `failed`
// and polling can stop.
const MAX_ATTEMPTS = 40;

/**
 * Mounted on pages that list video_outputs. While any video is `rendering`,
 * polls the detached Remotion render status every 30s so completions (or
 * timeouts) show up without waiting on the once-daily cron backstop.
 */
export function RenderPollingBridge({ active }: { active: boolean }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!active) {
      return;
    }

    let attempts = 0;
    let cancelled = false;

    const interval = setInterval(() => {
      attempts += 1;

      if (attempts > MAX_ATTEMPTS) {
        clearInterval(interval);
        setTimedOut(true);
        return;
      }

      pollRendersAction()
        .then(() => {
          if (!cancelled) {
            router.refresh();
          }
        })
        .catch((error) => {
          console.error("Render polling failed", error);
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active, router]);

  if (!timedOut) {
    return null;
  }

  return (
    <p
      className="app-rise-in rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-600/20"
      role="status"
    >
      Still waiting on a render — this is taking longer than usual. It will
      time out and become retryable shortly.
    </p>
  );
}
