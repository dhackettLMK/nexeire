import { describe, expect, it } from "vitest";
import {
  applyRenderWebhookState,
  hasProcessedProviderEvent,
  parseCreatomateWebhookPayload,
} from "@/lib/providers/events";

describe("provider events", () => {
  it("detects duplicate provider event ids", () => {
    expect(
      hasProcessedProviderEvent(
        [{ provider: "creatomate", providerEventId: "evt_1" }],
        "creatomate",
        "evt_1",
      ),
    ).toBe(true);
  });

  it("parses Creatomate completion payloads", () => {
    expect(
      parseCreatomateWebhookPayload({
        id: "render_1",
        event_id: "evt_1",
        status: "succeeded",
        url: "https://example.com/video.mp4",
      }),
    ).toMatchObject({
      provider: "creatomate",
      providerEventId: "evt_1",
      providerRenderId: "render_1",
      status: "succeeded",
    });
  });

  it("does not corrupt already-ready state on duplicate success", () => {
    const current = {
      status: "ready" as const,
      providerRenderId: "render_1",
      videoPath: "organizations/org/videos/video.mp4",
    };

    expect(
      applyRenderWebhookState(current, {
        provider: "creatomate",
        providerEventId: "evt_1",
        providerRenderId: "render_1",
        status: "succeeded",
      }),
    ).toBe(current);
  });
});
