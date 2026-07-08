"use client";

import { Agentation } from "agentation";

export function AgentationToolbar() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_PUBLIC_ENABLE_AGENTATION !== "true"
  ) {
    return null;
  }

  return (
    <Agentation
      endpoint={process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || undefined}
    />
  );
}
