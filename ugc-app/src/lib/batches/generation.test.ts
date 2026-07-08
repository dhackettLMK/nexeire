import { afterEach, describe, expect, it } from "vitest";
import {
  generatedMediaBucket,
  organizationGeneratedVideoPath,
} from "@/lib/assets/validation";
import { maxBatchSize } from "@/lib/batches/rules";
import { startRender } from "@/lib/providers/rendering";
import { videoDownloadUrl } from "@/lib/videos/downloads";
import {
  createDefaultRenderPlan,
  renderPlanAssetsFromRows,
} from "@/lib/videos/render-plan";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("batch generation with local render provider", () => {
  it("produces ten ready render artifacts with downloadable output URLs", async () => {
    process.env.RENDER_PROVIDER = "test";

    const outputs = await Promise.all(
      Array.from({ length: maxBatchSize }, async (_, index) => {
        const number = index + 1;
        const scriptId = `script-${number}`;
        const videoOutputId = `video-${number}`;
        const title = `Batch Output ${number}`;
        const voiceoverUrl = `https://storage.example/voiceover-${number}.mp3`;
        const render = await startRender({
          videoOutputId,
          scriptId,
          organizationId: "org-1",
          title,
          voiceoverUrl,
          brollUrls: [`https://storage.example/broll-${number}.mp4`],
          hook: `Hook ${number}`,
          caption: `Caption ${number}`,
          cta: "Book now",
          scenePlan: [],
          renderPlan: createDefaultRenderPlan({
            script: {
              title,
              hook: `Hook ${number}`,
              voiceover: `Voiceover for ${title}`,
              scene_plan: [],
              caption: `Caption ${number}`,
              cta: "Book now",
            },
            assets: renderPlanAssetsFromRows([
              {
                id: `asset-${number}`,
                storage_bucket: "client-assets",
                storage_path: `organizations/org-1/assets/asset-${number}/broll.mp4`,
                filename: `broll-${number}.mp4`,
                duration_seconds: 10,
                tags: ["product"],
              },
            ]),
            durationSeconds: 30,
          }),
        });
        const videoPath = organizationGeneratedVideoPath("org-1", videoOutputId);
        const downloadUrl = videoDownloadUrl(
          `https://storage.example/${generatedMediaBucket}/${videoPath}?token=${number}`,
          title,
        );

        return { downloadUrl, render, videoPath, voiceoverUrl };
      }),
    );

    expect(outputs).toHaveLength(10);
    expect(new Set(outputs.map((output) => output.videoPath)).size).toBe(10);
    expect(new Set(outputs.map((output) => output.render.providerJobId)).size).toBe(
      10,
    );
    for (const output of outputs) {
      expect(output.voiceoverUrl).toContain("voiceover-");
      expect(output.render.provider).toBe("test");
      expect(output.render.status).toBe("succeeded");
      expect(output.render.testVideoBytes?.byteLength).toBeGreaterThan(0);
      expect(output.downloadUrl).toContain("download=Batch%20Output");
    }
  });
});
