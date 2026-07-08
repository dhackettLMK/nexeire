import { Composition } from "remotion";
import { UGCVideo } from "./UGCVideo";
import {
  defaultRenderDurationSeconds,
  renderPlanFps,
  renderPlanHeight,
  renderPlanWidth,
  renderPlanVersion,
  type RenderPlan,
} from "../lib/videos/render-plan";

export const defaultRemotionPlan: RenderPlan = {
  version: renderPlanVersion,
  fps: renderPlanFps,
  width: renderPlanWidth,
  height: renderPlanHeight,
  durationSeconds: defaultRenderDurationSeconds,
  title: "UGC video",
  hook: "Nexeire",
  caption: "Generated UGC video",
  cta: "Book now",
  voiceoverText: "",
  voiceoverUrl: null,
  voiceoverStoragePath: null,
  scenes: [
    {
      id: "scene-1",
      scriptSceneIndex: 0,
      assetId: null,
      storageBucket: null,
      storagePath: null,
      filename: null,
      signedUrl: null,
      startSeconds: 0,
      durationSeconds: defaultRenderDurationSeconds,
      caption: "Generated UGC video",
      visual: "UGC video",
      fit: "cover",
      trimStartSeconds: 0,
      trimEndSeconds: null,
      transition: "cut",
      captionOverride: null,
    },
  ],
  captionStyle: {
    preset: "subtitle",
    color: "#ffffff",
    highlightColor: "#facc15",
    fontScale: 1,
    position: "bottom",
  },
  voiceoverCues: null,
  voiceoverStale: false,
  musicSource: "none",
  musicUrl: null,
  musicAssetId: null,
  musicStoragePath: null,
  musicVolume: 0.18,
  duckMusicUnderVoiceover: true,
};

export function RemotionRoot() {
  return (
    <Composition
      id="UGCVideo"
      component={UGCVideo}
      width={renderPlanWidth}
      height={renderPlanHeight}
      fps={renderPlanFps}
      durationInFrames={defaultRenderDurationSeconds * renderPlanFps}
      defaultProps={{ plan: defaultRemotionPlan }}
      calculateMetadata={({ props }) => {
        const plan = props.plan as RenderPlan;
        const durationSeconds =
          typeof plan.durationSeconds === "number" && plan.durationSeconds > 0
            ? plan.durationSeconds
            : defaultRenderDurationSeconds;

        return {
          durationInFrames: Math.max(1, Math.round(durationSeconds * renderPlanFps)),
          props,
        };
      }}
    />
  );
}
