"use client";

import * as React from "react";

/**
 * Counts up from 0 to `value` on mount using requestAnimationFrame (ease-out
 * cubic). No layout is animated — only the text node — so it's safe inside
 * `font-display` stat tiles. Respects `prefers-reduced-motion` by snapping
 * straight to the final value.
 */
export function AnimatedNumber({
  value,
  suffix = "",
  duration = 900,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  // Always start from 0 on both server and client render so hydration
  // doesn't mismatch; the effect below animates up (or snaps) on mount.
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    const start = performance.now();

    function tick(now: number) {
      if (reduceMotion) {
        setDisplay(value);
        return;
      }

      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className={className}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
