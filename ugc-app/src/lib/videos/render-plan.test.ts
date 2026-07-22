import { describe, expect, it } from "vitest";
import {
  createDefaultRenderPlan,
  maxTotalDurationSeconds,
  normalizePersistedRenderPlan,
  renderPlanAssetsFromRows,
  renderPlanVersion,
  resolveCaptionStyle,
  sanitizeRenderPlan,
  withSignedAssetUrls,
} from "@/lib/videos/render-plan";

const assets = renderPlanAssetsFromRows([
  {
    id: "asset-1",
    storage_bucket: "client-assets",
    storage_path: "organizations/org-1/assets/asset-1/a.mp4",
    filename: "a.mp4",
    content_type: "video/mp4",
    duration_seconds: "12.4",
    tags: ["product"],
  },
  {
    id: "asset-2",
    storage_bucket: "client-assets",
    storage_path: "organizations/org-1/assets/asset-2/b.mp4",
    filename: "b.mp4",
    content_type: "video/mp4",
    duration_seconds: 8,
    tags: ["lifestyle"],
  },
  {
    id: "asset-3",
    storage_bucket: "client-assets",
    storage_path: "organizations/org-1/assets/asset-3/music.mp3",
    filename: "music.mp3",
    content_type: "audio/mpeg",
    duration_seconds: 18,
    tags: [],
  },
]);

const script = {
  title: "Launch video",
  hook: "Stop wasting time",
  voiceover: "Voiceover copy",
  scene_plan: [
    {
      visual_direction: "Show the dashboard",
      on_screen_text: "All work in one place",
    },
    {
      visual_direction: "Show the booking flow",
      on_screen_text: "Book in seconds",
    },
  ],
  caption: "Work faster.",
  cta: "Book now",
};

describe("render plans", () => {
  it("creates timed scenes from scene_plan and organization assets", () => {
    const plan = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });

    expect(plan.durationSeconds).toBe(20);
    expect(plan.version).toBe(renderPlanVersion);
    expect(plan.scenes).toHaveLength(2);
    expect(plan.scenes[0]).toMatchObject({
      assetId: "asset-1",
      startSeconds: 0,
      durationSeconds: 10,
      caption: "All work in one place",
      trimEndSeconds: null,
      transition: "cut",
    });
    expect(plan.scenes[1]).toMatchObject({
      assetId: "asset-2",
      startSeconds: 10,
      durationSeconds: 10,
      caption: "Book in seconds",
    });
  });

  it("sanitizes edited scenes against available asset ids", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        scenes: [
          {
            ...fallback.scenes[1],
            assetId: "asset-2",
            caption: "Second scene first",
          },
          {
            ...fallback.scenes[0],
            assetId: "not-owned",
            caption: "Invalid asset",
          },
        ],
      },
      fallback,
      assets,
      script,
    });

    expect(plan.scenes[0]).toMatchObject({
      assetId: "asset-2",
      storagePath: "organizations/org-1/assets/asset-2/b.mp4",
      startSeconds: 0,
    });
    expect(plan.scenes[1]).toMatchObject({
      assetId: null,
      storagePath: null,
      startSeconds: 10,
    });
  });

  it("migrates persisted v1 plans to v2 defaults", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = normalizePersistedRenderPlan({
      value: {
        version: 1,
        durationSeconds: 18,
        title: "Saved title",
        hook: "Saved hook",
        caption: "Saved caption",
        cta: "Saved CTA",
        voiceoverText: "Saved voiceover",
        scenes: [
          {
            ...fallback.scenes[0],
            durationSeconds: 7,
            trimStartSeconds: 1.4,
          },
          {
            ...fallback.scenes[1],
            durationSeconds: 11,
            trimStartSeconds: 0.8,
          },
        ],
      },
      script,
      assets,
      durationSeconds: 20,
    });

    expect(plan).not.toBeNull();
    expect(plan).toMatchObject({
      version: renderPlanVersion,
      captionStyle: {
        preset: "subtitle",
        color: "#ffffff",
        highlightColor: "#facc15",
        fontScale: 1,
        position: "bottom",
      },
      voiceoverCues: null,
      voiceoverStale: false,
      voiceoverStoragePath: null,
      musicSource: "none",
      musicUrl: null,
      musicAssetId: null,
      musicStoragePath: null,
      musicVolume: 0.18,
      duckMusicUnderVoiceover: true,
    });
    expect(plan?.durationSeconds).toBe(18);
    expect(plan?.scenes[0]).toMatchObject({
      startSeconds: 0,
      durationSeconds: 7,
      trimStartSeconds: 1.4,
      trimEndSeconds: null,
      transition: "cut",
      captionOverride: null,
    });
    expect(plan?.scenes[1]).toMatchObject({
      startSeconds: 7,
      durationSeconds: 11,
      trimStartSeconds: 0.8,
      trimEndSeconds: null,
      transition: "cut",
      captionOverride: null,
    });
  });

  it("keeps custom scene durations authoritative and sums total duration", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        scenes: [
          {
            ...fallback.scenes[0],
            durationSeconds: 6.5,
          },
          {
            ...fallback.scenes[1],
            durationSeconds: 12.25,
          },
        ],
      },
      fallback,
      assets,
      script,
    });

    expect(plan.durationSeconds).toBe(18.75);
    expect(plan.scenes[0]).toMatchObject({
      startSeconds: 0,
      durationSeconds: 6.5,
    });
    expect(plan.scenes[1]).toMatchObject({
      startSeconds: 6.5,
      durationSeconds: 12.25,
    });
  });

  it("preserves trims and clamps trim out to the selected asset duration", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        scenes: [
          {
            ...fallback.scenes[0],
            trimStartSeconds: 2.2,
            trimEndSeconds: 20,
          },
          fallback.scenes[1],
        ],
      },
      fallback,
      assets,
      script,
    });

    expect(plan.scenes[0]).toMatchObject({
      trimStartSeconds: 2.2,
      trimEndSeconds: 12.4,
    });
  });

  it("caps total scene duration to the render guardrail", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        durationSeconds: 240,
        scenes: [
          {
            ...fallback.scenes[0],
            durationSeconds: 80,
          },
          {
            ...fallback.scenes[1],
            durationSeconds: 30,
          },
        ],
      },
      fallback,
      assets,
      script,
    });

    expect(plan.durationSeconds).toBe(maxTotalDurationSeconds);
    expect(plan.scenes[0].durationSeconds).toBe(80);
    expect(plan.scenes[1]).toMatchObject({
      startSeconds: 80,
      durationSeconds: 10,
    });
  });

  it("validates caption style, scene overrides, and cue timing", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        captionStyle: {
          preset: "karaoke",
          color: "#AABBCC",
          highlightColor: "#ff0022",
          fontScale: 3,
          position: "top",
        },
        voiceoverCues: [
          {
            text: "Launch",
            startSeconds: 0,
            endSeconds: 0.5,
          },
          {
            text: "bad cue",
            startSeconds: 2,
            endSeconds: 1,
          },
        ],
        scenes: [
          {
            ...fallback.scenes[0],
            captionOverride: {
              preset: "pill",
              color: "not-a-color",
              highlightColor: "#00ff44",
              fontScale: 0.2,
              position: "middle",
            },
          },
          fallback.scenes[1],
        ],
      },
      fallback,
      assets,
      script,
    });

    expect(plan.captionStyle).toEqual({
      preset: "karaoke",
      color: "#aabbcc",
      highlightColor: "#ff0022",
      fontScale: 1.6,
      position: "top",
    });
    expect(plan.voiceoverCues).toEqual([
      {
        text: "Launch",
        startSeconds: 0,
        endSeconds: 0.5,
      },
    ]);
    expect(plan.scenes[0].captionOverride).toEqual({
      preset: "pill",
      color: "#ffffff",
      highlightColor: "#00ff44",
      fontScale: 0.6,
      position: "bottom",
    });
    expect(resolveCaptionStyle(plan.captionStyle, plan.scenes[0].captionOverride))
      .toEqual({
        preset: "pill",
        color: "#ffffff",
        highlightColor: "#00ff44",
        fontScale: 0.6,
        position: "bottom",
      });
  });

  it("validates transitions and resolves music asset URLs", () => {
    const signedAssets = assets.map((asset) => ({
      ...asset,
      signedUrl: `https://storage.example/${asset.id}`,
    }));
    const fallback = createDefaultRenderPlan({
      script,
      assets: signedAssets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        musicSource: "asset",
        musicAssetId: "asset-3",
        musicVolume: 2,
        duckMusicUnderVoiceover: false,
        scenes: [
          {
            ...fallback.scenes[0],
            transition: "slide",
          },
          {
            ...fallback.scenes[1],
            transition: "spin",
          },
        ],
      },
      fallback,
      assets: signedAssets,
      script,
    });
    const signedPlan = withSignedAssetUrls(plan, signedAssets);

    expect(plan.musicSource).toBe("asset");
    expect(plan.musicAssetId).toBe("asset-3");
    expect(plan.musicStoragePath).toBeNull();
    expect(plan.musicVolume).toBe(1);
    expect(plan.duckMusicUnderVoiceover).toBe(false);
    expect(signedPlan.musicUrl).toBe("https://storage.example/asset-3");
    expect(plan.scenes[0].transition).toBe("slide");
    expect(plan.scenes[1].transition).toBe("cut");
  });

  it("defaults to a library track when a music track id is provided", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
      musicTrackId: "track-2",
    });

    expect(fallback.musicSource).toBe("library");
    expect(fallback.musicAssetId).toBe("track-2");
    expect(fallback.musicUrl).toBeNull();
  });

  it("applies the chosen music volume and duck setting literally", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
      musicTrackId: "track-2",
      musicVolume: 0.5,
      duckMusicUnderVoiceover: false,
    });

    expect(fallback.musicVolume).toBe(0.5);
    expect(fallback.duckMusicUnderVoiceover).toBe(false);
  });

  it("clamps an out-of-range music volume into 0-1", () => {
    const quiet = createDefaultRenderPlan({
      script,
      assets,
      musicTrackId: "track-1",
      musicVolume: -3,
    });
    const loud = createDefaultRenderPlan({
      script,
      assets,
      musicTrackId: "track-1",
      musicVolume: 4,
    });

    expect(quiet.musicVolume).toBe(0);
    expect(loud.musicVolume).toBe(1);
  });

  it("falls back to the default music volume when none is given", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      musicTrackId: "track-1",
    });

    expect(fallback.musicVolume).toBe(0.2);
  });

  it("resolves library music URLs from the signed music URL argument", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        musicSource: "library",
        musicAssetId: "track-1",
        duckMusicUnderVoiceover: true,
      },
      fallback,
      assets,
      script,
    });
    const signedPlan = withSignedAssetUrls(
      plan,
      assets,
      null,
      "https://storage.example/music-library/track-1.mp3",
    );

    expect(plan.musicSource).toBe("library");
    expect(plan.musicAssetId).toBe("track-1");
    expect(signedPlan.musicUrl).toBe(
      "https://storage.example/music-library/track-1.mp3",
    );
  });

  it("rejects an invalid library track id", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        musicSource: "library",
        musicAssetId: "../not-a-track",
      },
      fallback,
      assets,
      script,
    });

    expect(plan.musicAssetId).toBeNull();
  });

  it("keeps generated voiceover and uploaded music storage paths safe", () => {
    const fallback = createDefaultRenderPlan({
      script,
      assets,
      durationSeconds: 20,
    });
    const plan = sanitizeRenderPlan({
      value: {
        ...fallback,
        voiceoverUrl: "https://storage.example/voiceover.mp3",
        voiceoverStoragePath:
          "organizations/org-1/voiceovers/scripts/script-1.mp3",
        musicSource: "upload",
        musicUrl: "https://storage.example/music.mp3",
        musicAssetId: "asset-1",
        musicStoragePath: "organizations/org-1/assets/asset-3/music.mp3",
      },
      fallback,
      assets,
      script,
    });
    const unsafePlan = sanitizeRenderPlan({
      value: {
        ...fallback,
        voiceoverStoragePath: "../private/voiceover.mp3",
        musicSource: "upload",
        musicUrl: "javascript:alert(1)",
        musicStoragePath: "https://storage.example/music.mp3",
      },
      fallback,
      assets,
      script,
    });
    const signedPlan = withSignedAssetUrls(
      plan,
      assets,
      "https://signed.example/voiceover.mp3",
      "https://signed.example/music.mp3",
    );

    expect(plan.voiceoverUrl).toBe("https://storage.example/voiceover.mp3");
    expect(plan.voiceoverStoragePath).toBe(
      "organizations/org-1/voiceovers/scripts/script-1.mp3",
    );
    expect(plan.musicSource).toBe("upload");
    expect(plan.musicUrl).toBe("https://storage.example/music.mp3");
    expect(plan.musicAssetId).toBeNull();
    expect(plan.musicStoragePath).toBe(
      "organizations/org-1/assets/asset-3/music.mp3",
    );
    expect(signedPlan.voiceoverUrl).toBe(
      "https://signed.example/voiceover.mp3",
    );
    expect(signedPlan.musicUrl).toBe("https://signed.example/music.mp3");
    expect(unsafePlan.voiceoverStoragePath).toBeNull();
    expect(unsafePlan.musicUrl).toBeNull();
    expect(unsafePlan.musicStoragePath).toBeNull();
  });
});
