export const renderPlanVersion = 2;
export const renderPlanFps = 30;
export const renderPlanWidth = 1080;
export const renderPlanHeight = 1920;
export const defaultRenderDurationSeconds = 30;
export const maxRenderScenes = 20;
export const maxTotalDurationSeconds = 90;
export const minSceneDurationSeconds = 1;
export const defaultMusicVolume = 0.2;

export type CaptionPreset =
  | "hormozi"
  | "karaoke"
  | "pill"
  | "subtitle"
  | "tiktok-default";

export type CaptionStyle = {
  preset: CaptionPreset;
  color: string;
  highlightColor: string;
  fontScale: number;
  position: "top" | "center" | "bottom";
};

export type CaptionCue = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

export const captionPresetOptions = [
  "hormozi",
  "karaoke",
  "pill",
  "subtitle",
  "tiktok-default",
] as const satisfies CaptionPreset[];

export const captionPositionOptions = [
  "top",
  "center",
  "bottom",
] as const satisfies CaptionStyle["position"][];

export const sceneTransitionOptions = [
  "cut",
  "crossfade",
  "slide",
] as const satisfies RenderPlanScene["transition"][];

export const musicSourceOptions = [
  "none",
  "asset",
  "upload",
  "library",
] as const satisfies RenderPlan["musicSource"][];

export const defaultCaptionStyle: CaptionStyle = {
  preset: "subtitle",
  color: "#ffffff",
  highlightColor: "#facc15",
  fontScale: 1,
  position: "bottom",
};

export type RenderPlanAsset = {
  id: string;
  storageBucket: string;
  storagePath: string;
  filename: string;
  contentType: string | null;
  durationSeconds: number | null;
  tags: string[];
  signedUrl?: string | null;
  thumbnailUrl?: string | null;
};

export type RenderPlanScene = {
  id: string;
  scriptSceneIndex: number;
  assetId: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  filename: string | null;
  signedUrl?: string | null;
  startSeconds: number;
  durationSeconds: number;
  caption: string;
  visual: string;
  fit: "cover";
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  transition: "cut" | "crossfade" | "slide";
  captionOverride: Partial<CaptionStyle> | null;
};

export type RenderPlan = {
  version: 2;
  fps: number;
  width: number;
  height: number;
  durationSeconds: number;
  title: string;
  hook: string;
  caption: string;
  cta: string;
  voiceoverText: string;
  voiceoverUrl?: string | null;
  voiceoverStoragePath: string | null;
  scenes: RenderPlanScene[];
  captionStyle: CaptionStyle;
  voiceoverCues: CaptionCue[] | null;
  voiceoverStale: boolean;
  musicSource: "none" | "asset" | "upload" | "library";
  musicUrl: string | null;
  musicAssetId: string | null;
  musicStoragePath: string | null;
  musicVolume: number;
  duckMusicUnderVoiceover: boolean;
};

export type RenderPlanScriptInput = {
  title: string;
  hook: string;
  voiceover: string;
  scene_plan: unknown;
  caption: string;
  cta: string;
};

type SceneDraft = {
  visual: string;
  caption: string;
};

const captionPresets = new Set<CaptionPreset>(captionPresetOptions);
const captionPositions = new Set<CaptionStyle["position"]>(
  captionPositionOptions,
);
const sceneTransitions = new Set<RenderPlanScene["transition"]>(
  sceneTransitionOptions,
);
const musicSources = new Set<RenderPlan["musicSource"]>(musicSourceOptions);

function numberValue(value: unknown) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function urlValue(value: unknown, fallback: string | null = null) {
  const url = stringValue(value);

  if (!url || url.length > 2048) {
    return fallback;
  }

  try {
    const parsed = new URL(url);

    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

function storagePathValue(value: unknown, fallback: string | null = null) {
  const path = stringValue(value);

  if (!path || path.length > 1024) {
    return fallback;
  }

  if (
    !path.startsWith("organizations/") ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("..") ||
    path.includes("//")
  ) {
    return fallback;
  }

  return /^[a-zA-Z0-9/_.-]+$/.test(path) ? path : fallback;
}

function roundSeconds(value: number) {
  return Number(value.toFixed(3));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function durationSecondsValue(value: unknown, fallback: number) {
  const parsed = numberValue(value);
  const duration = parsed && parsed > 0 ? parsed : fallback;

  return roundSeconds(
    clamp(duration, minSceneDurationSeconds, maxTotalDurationSeconds),
  );
}

function durationToSeconds(value: number | string | null | undefined) {
  const parsed = numberValue(value);

  return parsed && parsed > 0 ? parsed : null;
}

function hexColorValue(value: unknown, fallback: string) {
  const color = stringValue(value);

  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function captionPresetValue(
  value: unknown,
  fallback: CaptionPreset,
): CaptionPreset {
  const preset = stringValue(value) as CaptionPreset;

  return captionPresets.has(preset) ? preset : fallback;
}

function captionPositionValue(
  value: unknown,
  fallback: CaptionStyle["position"],
): CaptionStyle["position"] {
  const position = stringValue(value) as CaptionStyle["position"];

  return captionPositions.has(position) ? position : fallback;
}

function captionStyleFromInput(
  value: unknown,
  fallback: CaptionStyle = defaultCaptionStyle,
): CaptionStyle {
  const record = value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

  return {
    preset: captionPresetValue(record.preset, fallback.preset),
    color: hexColorValue(record.color, fallback.color),
    highlightColor: hexColorValue(
      record.highlightColor,
      fallback.highlightColor,
    ),
    fontScale: roundSeconds(
      clamp(numberValue(record.fontScale) ?? fallback.fontScale, 0.6, 1.6),
    ),
    position: captionPositionValue(record.position, fallback.position),
  };
}

function captionOverrideFromInput(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const override: Partial<CaptionStyle> = {};

  if ("preset" in record) {
    override.preset = captionPresetValue(
      record.preset,
      defaultCaptionStyle.preset,
    );
  }

  if ("color" in record) {
    override.color = hexColorValue(record.color, defaultCaptionStyle.color);
  }

  if ("highlightColor" in record) {
    override.highlightColor = hexColorValue(
      record.highlightColor,
      defaultCaptionStyle.highlightColor,
    );
  }

  if ("fontScale" in record) {
    override.fontScale = roundSeconds(
      clamp(
        numberValue(record.fontScale) ?? defaultCaptionStyle.fontScale,
        0.6,
        1.6,
      ),
    );
  }

  if ("position" in record) {
    override.position = captionPositionValue(
      record.position,
      defaultCaptionStyle.position,
    );
  }

  return Object.keys(override).length > 0 ? override : null;
}

function transitionValue(
  value: unknown,
  fallback: RenderPlanScene["transition"],
): RenderPlanScene["transition"] {
  const transition = stringValue(value) as RenderPlanScene["transition"];

  return sceneTransitions.has(transition) ? transition : fallback;
}

function musicSourceValue(
  value: unknown,
  fallback: RenderPlan["musicSource"],
): RenderPlan["musicSource"] {
  const source = stringValue(value) as RenderPlan["musicSource"];

  return musicSources.has(source) ? source : fallback;
}

const musicLibraryTrackIdPattern = /^[a-z0-9-]{1,64}$/;

function musicLibraryTrackIdValue(value: unknown, fallback: string | null) {
  const trackId = stringValue(value);

  return musicLibraryTrackIdPattern.test(trackId) ? trackId : fallback;
}

function trimStartValue(
  value: unknown,
  fallback: number,
  assetDurationSeconds: number | null,
) {
  const parsed = numberValue(value) ?? fallback;
  const maxStart = assetDurationSeconds
    ? Math.max(0, assetDurationSeconds - 0.1)
    : maxTotalDurationSeconds;

  return roundSeconds(clamp(parsed, 0, maxStart));
}

function trimEndValue(
  value: unknown,
  fallback: number | null,
  trimStartSeconds: number,
  assetDurationSeconds: number | null,
) {
  if (value === null) {
    return null;
  }

  const parsed = numberValue(value) ?? fallback;

  if (!parsed || parsed <= 0) {
    return null;
  }

  const minEnd = trimStartSeconds + 0.1;
  const maxEnd = assetDurationSeconds ?? Math.max(minEnd, maxTotalDurationSeconds);

  if (minEnd > maxEnd) {
    return null;
  }

  return roundSeconds(clamp(parsed, minEnd, maxEnd));
}

function captionCuesFromInput(value: unknown): CaptionCue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const cues = value.flatMap((item): CaptionCue[] => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const text = stringValue(record.text);
    const startSeconds = numberValue(record.startSeconds);
    const endSeconds = numberValue(record.endSeconds);

    if (
      !text ||
      startSeconds === null ||
      endSeconds === null ||
      startSeconds < 0 ||
      endSeconds <= startSeconds
    ) {
      return [];
    }

    return [
      {
        text,
        startSeconds: roundSeconds(startSeconds),
        endSeconds: roundSeconds(endSeconds),
      },
    ];
  });

  return cues.length > 0 ? cues : null;
}

export function isWordSyncedCaptionPreset(preset: CaptionPreset) {
  return preset === "hormozi" || preset === "karaoke";
}

export function isAudioRenderPlanAsset(asset: RenderPlanAsset) {
  if (asset.contentType) {
    return asset.contentType.toLowerCase().startsWith("audio/");
  }

  return /\.(aac|aiff?|flac|m4a|mp3|oga|ogg|wav)$/i.test(asset.filename);
}

function isVisualRenderPlanAsset(asset: RenderPlanAsset) {
  return !isAudioRenderPlanAsset(asset);
}

export function resolveCaptionStyle(
  base: CaptionStyle,
  override: Partial<CaptionStyle> | null,
) {
  return captionStyleFromInput({ ...base, ...(override ?? {}) }, base);
}

function migrateV1ToV2(record: Record<string, unknown>) {
  if (record.version === renderPlanVersion) {
    return record;
  }

  return {
    ...record,
    version: renderPlanVersion,
    captionStyle: defaultCaptionStyle,
    voiceoverCues: null,
    voiceoverStale: false,
    voiceoverStoragePath: null,
    musicSource: "none",
    musicUrl: null,
    musicAssetId: null,
    musicStoragePath: null,
    musicVolume: 0.18,
    duckMusicUnderVoiceover: true,
    scenes: Array.isArray(record.scenes)
      ? record.scenes.map((scene) =>
          scene && typeof scene === "object"
            ? {
                ...(scene as Record<string, unknown>),
                trimEndSeconds: null,
                transition: "cut",
                captionOverride: null,
              }
            : scene,
        )
      : record.scenes,
  };
}

function sceneDrafts(scenePlan: unknown, fallbackCaption: string): SceneDraft[] {
  if (!Array.isArray(scenePlan)) {
    return [];
  }

  return scenePlan.slice(0, maxRenderScenes).map((item, index) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const visual =
      stringValue(record.visual_direction) ||
      stringValue(record.visual) ||
      `Scene ${index + 1}`;
    const caption =
      stringValue(record.on_screen_text) ||
      stringValue(record.caption) ||
      fallbackCaption;

    return { visual, caption };
  });
}

function fallbackSceneDrafts(script: RenderPlanScriptInput, assetCount: number) {
  const count = Math.max(1, Math.min(maxRenderScenes, assetCount || 3));

  return Array.from({ length: count }, (_, index) => ({
    visual: index === 0 ? script.hook : `Scene ${index + 1}`,
    caption: index === count - 1 ? script.cta : script.caption,
  }));
}

function allocateAsset(assets: RenderPlanAsset[], index: number) {
  if (assets.length === 0) {
    return null;
  }

  return assets[index % assets.length] ?? assets[0] ?? null;
}

export function resequenceRenderPlan(plan: RenderPlan): RenderPlan {
  let cursor = 0;
  const sourceScenes = plan.scenes.slice(0, maxRenderScenes);
  const scenes = sourceScenes.map((scene, index) => {
    const requestedDuration = durationSecondsValue(
      scene.durationSeconds,
      Math.max(
        minSceneDurationSeconds,
        plan.durationSeconds / Math.max(1, sourceScenes.length),
      ),
    );
    const remainingScenes = sourceScenes.length - index - 1;
    const maxSceneDuration = Math.max(
      minSceneDurationSeconds,
      maxTotalDurationSeconds - cursor - remainingScenes * minSceneDurationSeconds,
    );
    const durationSeconds = roundSeconds(
      clamp(requestedDuration, minSceneDurationSeconds, maxSceneDuration),
    );
    const nextScene = {
      ...scene,
      scriptSceneIndex: index,
      startSeconds: roundSeconds(cursor),
      durationSeconds,
    };

    cursor = roundSeconds(cursor + durationSeconds);
    return nextScene;
  });

  return {
    ...plan,
    version: renderPlanVersion,
    fps: renderPlanFps,
    width: renderPlanWidth,
    height: renderPlanHeight,
    durationSeconds: roundSeconds(
      clamp(cursor, minSceneDurationSeconds, maxTotalDurationSeconds),
    ),
    scenes,
  };
}

export function createDefaultRenderPlan(input: {
  script: RenderPlanScriptInput;
  assets: RenderPlanAsset[];
  durationSeconds?: number | null;
  musicTrackId?: string | null;
  musicVolume?: number | null;
  duckMusicUnderVoiceover?: boolean;
}): RenderPlan {
  const visualAssets = input.assets.filter(isVisualRenderPlanAsset);
  const durationSeconds = durationSecondsValue(
    input.durationSeconds,
    defaultRenderDurationSeconds,
  );
  const drafts =
    sceneDrafts(input.script.scene_plan, input.script.caption).length > 0
      ? sceneDrafts(input.script.scene_plan, input.script.caption)
      : fallbackSceneDrafts(input.script, visualAssets.length);
  const sceneDuration = durationSeconds / Math.max(1, drafts.length);
  const scenes = drafts.map((draft, index) => {
    const asset = allocateAsset(visualAssets, index);

    return {
      id: `scene-${index + 1}`,
      scriptSceneIndex: index,
      assetId: asset?.id ?? null,
      storageBucket: asset?.storageBucket ?? null,
      storagePath: asset?.storagePath ?? null,
      filename: asset?.filename ?? null,
      signedUrl: asset?.signedUrl ?? null,
      startSeconds: roundSeconds(index * sceneDuration),
      durationSeconds: roundSeconds(sceneDuration),
      caption: draft.caption,
      visual: draft.visual,
      fit: "cover" as const,
      trimStartSeconds: 0,
      trimEndSeconds: null,
      transition: "cut" as const,
      captionOverride: null,
    };
  });

  return resequenceRenderPlan({
    version: renderPlanVersion,
    fps: renderPlanFps,
    width: renderPlanWidth,
    height: renderPlanHeight,
    durationSeconds,
    title: input.script.title,
    hook: input.script.hook,
    caption: input.script.caption,
    cta: input.script.cta,
    voiceoverText: input.script.voiceover,
    voiceoverUrl: null,
    voiceoverStoragePath: null,
    scenes,
    captionStyle: defaultCaptionStyle,
    voiceoverCues: null,
    voiceoverStale: false,
    musicSource: input.musicTrackId ? "library" : "none",
    musicUrl: null,
    musicAssetId: input.musicTrackId ?? null,
    musicStoragePath: null,
    musicVolume: roundSeconds(
      clamp(input.musicVolume ?? defaultMusicVolume, 0, 1),
    ),
    duckMusicUnderVoiceover: input.duckMusicUnderVoiceover ?? true,
  });
}

function assetMap(assets: RenderPlanAsset[]) {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

function sceneFromInput(
  value: unknown,
  index: number,
  fallback: RenderPlanScene,
  assetsById: Map<string, RenderPlanAsset>,
): RenderPlanScene {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const assetId = stringValue(record.assetId) || fallback.assetId;
  const asset = assetId ? assetsById.get(assetId) ?? null : null;
  const trimStartSeconds = trimStartValue(
    record.trimStartSeconds,
    fallback.trimStartSeconds,
    asset?.durationSeconds ?? null,
  );

  return {
    id: stringValue(record.id) || fallback.id || `scene-${index + 1}`,
    scriptSceneIndex: index,
    assetId: asset?.id ?? null,
    storageBucket: asset?.storageBucket ?? null,
    storagePath: asset?.storagePath ?? null,
    filename: asset?.filename ?? null,
    signedUrl: asset?.signedUrl ?? null,
    startSeconds: 0,
    durationSeconds: durationSecondsValue(
      record.durationSeconds,
      fallback.durationSeconds,
    ),
    caption: stringValue(record.caption) || fallback.caption,
    visual: stringValue(record.visual) || fallback.visual,
    fit: "cover",
    trimStartSeconds,
    trimEndSeconds: trimEndValue(
      record.trimEndSeconds,
      fallback.trimEndSeconds,
      trimStartSeconds,
      asset?.durationSeconds ?? null,
    ),
    transition: transitionValue(record.transition, fallback.transition),
    captionOverride: captionOverrideFromInput(record.captionOverride),
  };
}

export function sanitizeRenderPlan(input: {
  value: unknown;
  fallback: RenderPlan;
  assets: RenderPlanAsset[];
  script: RenderPlanScriptInput;
}): RenderPlan {
  const rawRecord =
    input.value && typeof input.value === "object"
      ? (input.value as Record<string, unknown>)
      : {};
  const record = migrateV1ToV2(rawRecord);
  const fallbackScenes = input.fallback.scenes.length
    ? input.fallback.scenes
    : createDefaultRenderPlan({
        script: input.script,
        assets: input.assets,
        durationSeconds: input.fallback.durationSeconds,
      }).scenes;
  const rawScenes =
    Array.isArray(record.scenes) && record.scenes.length > 0
      ? record.scenes
      : fallbackScenes;
  const visualAssetsById = assetMap(input.assets.filter(isVisualRenderPlanAsset));
  const audioAssetsById = assetMap(input.assets.filter(isAudioRenderPlanAsset));
  const musicSource = musicSourceValue(
    record.musicSource,
    input.fallback.musicSource,
  );
  const musicAssetId =
    "musicAssetId" in record
      ? stringValue(record.musicAssetId)
      : input.fallback.musicAssetId ?? "";
  const musicAsset =
    musicSource === "asset" && musicAssetId
      ? audioAssetsById.get(musicAssetId) ?? null
      : null;
  const musicLibraryTrackId =
    musicSource === "library"
      ? musicLibraryTrackIdValue(record.musicAssetId, input.fallback.musicAssetId)
      : null;
  const musicStoragePath =
    musicSource === "upload"
      ? storagePathValue(
          record.musicStoragePath,
          input.fallback.musicStoragePath,
        )
      : null;
  const scenes = rawScenes
    .slice(0, maxRenderScenes)
    .map((scene, index) =>
      sceneFromInput(
        scene,
        index,
        fallbackScenes[index] ?? fallbackScenes[0],
        visualAssetsById,
      ),
    );

  return resequenceRenderPlan({
    version: renderPlanVersion,
    fps: renderPlanFps,
    width: renderPlanWidth,
    height: renderPlanHeight,
    durationSeconds: durationSecondsValue(
      record.durationSeconds,
      input.fallback.durationSeconds,
    ),
    title: stringValue(record.title) || input.script.title,
    hook: stringValue(record.hook) || input.script.hook,
    caption: stringValue(record.caption) || input.script.caption,
    cta: stringValue(record.cta) || input.script.cta,
    voiceoverText: stringValue(record.voiceoverText) || input.script.voiceover,
    voiceoverUrl: urlValue(record.voiceoverUrl, input.fallback.voiceoverUrl ?? null),
    voiceoverStoragePath: storagePathValue(
      record.voiceoverStoragePath,
      input.fallback.voiceoverStoragePath,
    ),
    scenes,
    captionStyle: captionStyleFromInput(
      record.captionStyle,
      input.fallback.captionStyle,
    ),
    voiceoverCues: captionCuesFromInput(record.voiceoverCues),
    voiceoverStale:
      typeof record.voiceoverStale === "boolean"
        ? record.voiceoverStale
        : input.fallback.voiceoverStale,
    musicSource,
    musicUrl:
      musicSource === "none"
        ? null
        : musicSource === "asset" && !musicAsset
          ? null
          : urlValue(record.musicUrl, input.fallback.musicUrl),
    musicAssetId:
      musicSource === "asset"
        ? musicAsset?.id ?? null
        : musicSource === "library"
          ? musicLibraryTrackId
          : null,
    musicStoragePath,
    musicVolume: roundSeconds(
      clamp(
        numberValue(record.musicVolume) ?? input.fallback.musicVolume,
        0,
        1,
      ),
    ),
    duckMusicUnderVoiceover:
      typeof record.duckMusicUnderVoiceover === "boolean"
        ? record.duckMusicUnderVoiceover
        : input.fallback.duckMusicUnderVoiceover,
  });
}

export function normalizePersistedRenderPlan(input: {
  value: unknown;
  script: RenderPlanScriptInput;
  assets: RenderPlanAsset[];
  durationSeconds?: number | null;
  musicTrackId?: string | null;
  musicVolume?: number | null;
  duckMusicUnderVoiceover?: boolean;
}) {
  if (!input.value || typeof input.value !== "object") {
    return null;
  }

  const fallback = createDefaultRenderPlan({
    script: input.script,
    assets: input.assets,
    durationSeconds: input.durationSeconds,
    musicTrackId: input.musicTrackId,
    musicVolume: input.musicVolume,
    duckMusicUnderVoiceover: input.duckMusicUnderVoiceover,
  });

  return sanitizeRenderPlan({
    value: input.value,
    fallback,
    assets: input.assets,
    script: input.script,
  });
}

export function withSignedAssetUrls(
  plan: RenderPlan,
  assets: RenderPlanAsset[],
  voiceoverUrl?: string | null,
  musicUrl?: string | null,
): RenderPlan {
  const assetsById = assetMap(assets);
  const musicAsset = plan.musicAssetId
    ? assetsById.get(plan.musicAssetId) ?? null
    : null;

  return {
    ...plan,
    voiceoverUrl: voiceoverUrl ?? plan.voiceoverUrl ?? null,
    musicUrl:
      plan.musicSource === "asset"
        ? musicAsset?.signedUrl ?? plan.musicUrl
        : plan.musicSource === "upload" || plan.musicSource === "library"
          ? musicUrl ?? plan.musicUrl
          : plan.musicSource === "none"
            ? null
            : plan.musicUrl,
    scenes: plan.scenes.map((scene) => {
      const asset = scene.assetId ? assetsById.get(scene.assetId) : null;

      return {
        ...scene,
        signedUrl: asset?.signedUrl ?? scene.signedUrl ?? null,
        storageBucket: asset?.storageBucket ?? scene.storageBucket,
        storagePath: asset?.storagePath ?? scene.storagePath,
        filename: asset?.filename ?? scene.filename,
      };
    }),
  };
}

export function renderPlanAssetsFromRows(
  rows: {
    id: string;
    storage_bucket: string | null;
    storage_path: string;
    filename: string;
    content_type?: string | null;
    duration_seconds: number | string | null;
    tags: string[] | null;
  }[],
): RenderPlanAsset[] {
  return rows.map((row) => ({
    id: row.id,
    storageBucket: row.storage_bucket || "client-assets",
    storagePath: row.storage_path,
    filename: row.filename,
    contentType: row.content_type ?? null,
    durationSeconds: durationToSeconds(row.duration_seconds),
    tags: row.tags ?? [],
  }));
}
