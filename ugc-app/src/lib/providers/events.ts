import type { VideoStatus } from "@/lib/batches/rules";

export type ProviderEventRecord = {
  provider: string;
  providerEventId: string;
};

export type RenderWebhookInput = {
  provider: "creatomate" | "test";
  providerEventId: string;
  providerRenderId: string;
  status: "succeeded" | "failed";
  videoUrl?: string | null;
  errorMessage?: string | null;
};

export type RenderWebhookState = {
  status: VideoStatus;
  providerRenderId?: string | null;
  videoPath?: string | null;
  errorMessage?: string | null;
};

export function hasProcessedProviderEvent(
  events: ProviderEventRecord[],
  provider: string,
  providerEventId: string,
) {
  return events.some(
    (event) =>
      event.provider === provider && event.providerEventId === providerEventId,
  );
}

export function statusFromRenderWebhook(event: RenderWebhookInput): VideoStatus {
  return event.status === "succeeded" ? "ready" : "failed";
}

export function applyRenderWebhookState(
  current: RenderWebhookState,
  event: RenderWebhookInput,
): RenderWebhookState {
  if (
    current.status === "ready" &&
    event.status === "succeeded" &&
    current.providerRenderId === event.providerRenderId
  ) {
    return current;
  }

  return {
    ...current,
    status: statusFromRenderWebhook(event),
    providerRenderId: event.providerRenderId,
    errorMessage:
      event.status === "failed"
        ? event.errorMessage ?? "Render failed"
        : current.errorMessage ?? null,
  };
}

export function parseCreatomateWebhookPayload(payload: unknown): RenderWebhookInput {
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const renderId =
    stringValue(record.render_id) ??
    stringValue(record.id) ??
    stringValue(record.renderId);
  const statusRaw = stringValue(record.status)?.toLowerCase();
  const url =
    stringValue(record.url) ??
    stringValue(record.video_url) ??
    stringValue(record.output_url);

  if (!renderId) {
    throw new Error("Missing render id");
  }

  return {
    provider: "creatomate",
    providerEventId:
      stringValue(record.event_id) ??
      stringValue(record.eventId) ??
      `${renderId}:${statusRaw ?? "unknown"}`,
    providerRenderId: renderId,
    status:
      statusRaw === "succeeded" ||
      statusRaw === "finished" ||
      statusRaw === "ready"
        ? "succeeded"
        : "failed",
    videoUrl: url,
    errorMessage:
      stringValue(record.error) ??
      stringValue(record.error_message) ??
      stringValue(record.message),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
