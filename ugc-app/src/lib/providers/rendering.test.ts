import { afterEach, describe, expect, it } from "vitest";
import {
  configuredRenderProvider,
  startRender,
} from "@/lib/providers/rendering";
import {
  createDefaultRenderPlan,
  renderPlanAssetsFromRows,
} from "@/lib/videos/render-plan";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

const renderRequest = {
  videoOutputId: "video-1",
  scriptId: "script-1",
  organizationId: "org-1",
  title: "Demo video",
  voiceoverUrl: "https://example.com/voiceover.mp3",
  brollUrls: ["https://example.com/broll.mp4"],
  hook: "Need a simpler next step?",
  caption: "Book today.",
  cta: "Book a trial",
  scenePlan: [],
  renderPlan: createDefaultRenderPlan({
    script: {
      title: "Demo video",
      hook: "Need a simpler next step?",
      voiceover: "Voiceover",
      scene_plan: [],
      caption: "Book today.",
      cta: "Book a trial",
    },
    assets: renderPlanAssetsFromRows([
      {
        id: "asset-1",
        storage_bucket: "client-assets",
        storage_path: "organizations/org-1/assets/asset-1/demo.mp4",
        filename: "demo.mp4",
        duration_seconds: 10,
        tags: ["product"],
      },
    ]),
    durationSeconds: 30,
  }),
};

describe("render provider", () => {
  it("creates deterministic test render output only when configured", async () => {
    process.env.RENDER_PROVIDER = "test";

    const result = await startRender(renderRequest);

    expect(result.provider).toBe("test");
    expect(result.providerJobId).toBe("test-render:video-1");
    expect(result.status).toBe("succeeded");
    expect(result.testVideoBytes?.byteLength).toBeGreaterThan(0);
  });

  it("defaults production rendering to Remotion", async () => {
    delete process.env.RENDER_PROVIDER;
    delete process.env.BLOB_READ_WRITE_TOKEN;

    expect(configuredRenderProvider()).toBe("remotion");
  });
});
