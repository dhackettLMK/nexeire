import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Fragment, type CSSProperties } from "react";
import {
  isWordSyncedCaptionPreset,
  resolveCaptionStyle,
  type CaptionCue,
  type CaptionStyle,
  type RenderPlan,
  type RenderPlanScene,
} from "../lib/videos/render-plan";

type UGCVideoProps = {
  plan: RenderPlan;
};

const background = "#0b0b0f";
const textShadow = "0 2px 16px rgba(0,0,0,0.45)";
const sansFont = "Inter, Arial, sans-serif";
const displayFont = "Fraunces, Georgia, serif";
const transitionFrames = 12;

function secondsToFrames(seconds: number, fps: number) {
  return Math.max(1, Math.round(seconds * fps));
}

function secondsToFrameOffset(seconds: number, fps: number) {
  return Math.max(0, Math.round(seconds * fps));
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function transitionPresentation(scene: RenderPlanScene) {
  if (scene.transition === "crossfade") {
    return fade();
  }

  if (scene.transition === "slide") {
    return slide({ direction: "from-right" });
  }

  return null;
}

function splitWords(value: string) {
  return value.match(/\S+/g) ?? [];
}

function fallbackCueSource(plan: RenderPlan) {
  return (
    plan.voiceoverText.trim() ||
    plan.scenes
      .map((scene) => scene.caption.trim())
      .filter(Boolean)
      .join(" ")
  );
}

function fallbackVoiceoverCues(plan: RenderPlan): CaptionCue[] {
  const words = splitWords(fallbackCueSource(plan));

  if (words.length === 0) {
    return [];
  }

  const durationSeconds = Math.max(plan.durationSeconds, 1);
  const secondsPerWord = durationSeconds / words.length;

  return words.map((word, index) => ({
    text: word,
    startSeconds: index * secondsPerWord,
    endSeconds: (index + 1) * secondsPerWord,
  }));
}

function voiceoverCues(plan: RenderPlan) {
  return plan.voiceoverCues?.length ? plan.voiceoverCues : fallbackVoiceoverCues(plan);
}

function activeCueIndex(cues: CaptionCue[], absoluteSeconds: number) {
  return cues.findIndex(
    (cue) =>
      absoluteSeconds >= cue.startSeconds && absoluteSeconds < cue.endSeconds,
  );
}

function captionJustify(position: CaptionStyle["position"]) {
  if (position === "top") {
    return "flex-start";
  }

  if (position === "center") {
    return "center";
  }

  return "flex-end";
}

function captionPadding(position: CaptionStyle["position"]) {
  if (position === "top") {
    return "220px 72px 0";
  }

  if (position === "center") {
    return "0 72px";
  }

  return "0 72px 240px";
}

function captionLayerStyle(
  style: CaptionStyle,
  opacity: number,
): CSSProperties {
  return {
    alignItems: "center",
    color: style.color,
    display: "flex",
    flexDirection: "column",
    justifyContent: captionJustify(style.position),
    opacity,
    padding: captionPadding(style.position),
    textAlign: "center",
  };
}

function textStroke(width = 8): CSSProperties {
  return {
    WebkitTextStroke: `${width}px rgba(0,0,0,0.88)`,
    paintOrder: "stroke fill",
  };
}

function StaticCaption({
  caption,
  style,
}: {
  caption: string;
  style: CaptionStyle;
}) {
  const fontSize = Math.round(58 * style.fontScale);

  if (style.preset === "pill") {
    return (
      <div
        style={{
          background: style.highlightColor,
          borderRadius: 32,
          boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
          color: style.color,
          display: "inline-block",
          fontFamily: displayFont,
          fontSize,
          fontWeight: 900,
          lineHeight: 1.02,
          maxWidth: "100%",
          padding: "22px 32px 26px",
          textShadow: "none",
        }}
      >
        {caption}
      </div>
    );
  }

  if (style.preset === "tiktok-default") {
    return (
      <div
        style={{
          background: "rgba(0,0,0,0.62)",
          borderRadius: 24,
          color: style.color,
          display: "inline-block",
          fontFamily: sansFont,
          fontSize: Math.round(48 * style.fontScale),
          fontWeight: 800,
          lineHeight: 1.08,
          maxWidth: "100%",
          padding: "18px 28px 22px",
          textShadow: "0 2px 14px rgba(0,0,0,0.65)",
        }}
      >
        {caption}
      </div>
    );
  }

  return (
    <div
      style={{
        color: style.color,
        fontFamily: sansFont,
        fontSize,
        fontWeight: 900,
        letterSpacing: 0,
        lineHeight: 1.04,
        maxWidth: "100%",
        textShadow,
        ...textStroke(7),
      }}
    >
      {caption}
    </div>
  );
}

function HormoziCaption({
  cues,
  activeIndex,
  style,
}: {
  cues: CaptionCue[];
  activeIndex: number;
  style: CaptionStyle;
}) {
  const visibleCues = cues.slice(activeIndex, activeIndex + 2);

  return (
    <div
      style={{
        color: style.color,
        fontFamily: sansFont,
        fontSize: Math.round(72 * style.fontScale),
        fontWeight: 950,
        lineHeight: 0.95,
        maxWidth: "100%",
        textShadow,
        textTransform: "uppercase",
        ...textStroke(8),
      }}
    >
      {visibleCues.map((cue, index) => (
        <span
          key={`${cue.text}-${cue.startSeconds}`}
          style={{
            color: index === 0 ? style.highlightColor : style.color,
            marginRight: index === visibleCues.length - 1 ? 0 : 18,
          }}
        >
          {cue.text}
        </span>
      ))}
    </div>
  );
}

function KaraokeCaption({
  absoluteSeconds,
  cues,
  activeIndex,
  style,
}: {
  absoluteSeconds: number;
  cues: CaptionCue[];
  activeIndex: number;
  style: CaptionStyle;
}) {
  const start = Math.max(0, activeIndex - 3);
  const phrase = cues.slice(start, Math.min(cues.length, start + 7));

  return (
    <div
      style={{
        color: style.color,
        fontFamily: displayFont,
        fontSize: Math.round(58 * style.fontScale),
        fontWeight: 900,
        lineHeight: 1.02,
        maxWidth: "100%",
        textShadow,
        ...textStroke(7),
      }}
    >
      {phrase.map((cue) => {
        const isSpoken = cue.endSeconds <= absoluteSeconds;
        const isActive =
          absoluteSeconds >= cue.startSeconds && absoluteSeconds < cue.endSeconds;

        return (
          <span
            key={`${cue.text}-${cue.startSeconds}`}
            style={{
              color: isActive || isSpoken ? style.highlightColor : style.color,
              marginRight: 14,
            }}
          >
            {cue.text}
          </span>
        );
      })}
    </div>
  );
}

function WordSyncedCaption({
  absoluteSeconds,
  cues,
  style,
}: {
  absoluteSeconds: number;
  cues: CaptionCue[];
  style: CaptionStyle;
}) {
  const activeIndex = activeCueIndex(cues, absoluteSeconds);

  if (activeIndex < 0) {
    return null;
  }

  if (style.preset === "karaoke") {
    return (
      <KaraokeCaption
        absoluteSeconds={absoluteSeconds}
        activeIndex={activeIndex}
        cues={cues}
        style={style}
      />
    );
  }

  return (
    <HormoziCaption activeIndex={activeIndex} cues={cues} style={style} />
  );
}

function SceneLayer({
  hiddenText,
  plan,
  scene,
  wordCues,
  fps,
}: {
  hiddenText: Set<string>;
  plan: RenderPlan;
  scene: RenderPlanScene;
  wordCues: CaptionCue[];
  fps: number;
}) {
  const frame = useCurrentFrame();
  const absoluteSeconds = scene.startSeconds + frame / fps;
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionStyle = resolveCaptionStyle(
    plan.captionStyle,
    scene.captionOverride,
  );
  const caption = scene.caption.trim();
  const showCaption = caption.length > 0 && !hiddenText.has(normalizeText(caption));
  const trimBefore = secondsToFrameOffset(scene.trimStartSeconds, fps);
  const trimAfter =
    scene.trimEndSeconds === null
      ? undefined
      : Math.max(trimBefore + 1, secondsToFrameOffset(scene.trimEndSeconds, fps));

  return (
    <AbsoluteFill style={{ background }}>
      {scene.signedUrl ? (
        <OffthreadVideo
          src={scene.signedUrl}
          trimBefore={trimBefore}
          trimAfter={trimAfter}
          style={{
            width: "100%",
            height: "100%",
            objectFit: scene.fit,
          }}
          muted
        />
      ) : (
        <AbsoluteFill
          style={{
            alignItems: "center",
            background:
              "linear-gradient(145deg, #0b0b0f 0%, #1e293b 48%, #0f172a 100%)",
            color: "white",
            display: "flex",
            justifyContent: "center",
            padding: 96,
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: "Inter, Arial, sans-serif", fontSize: 56 }}>
            {scene.visual}
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,.52) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,.68) 100%)",
        }}
      />
      <AbsoluteFill style={captionLayerStyle(captionStyle, opacity)}>
        {isWordSyncedCaptionPreset(captionStyle.preset) ? (
          <WordSyncedCaption
            absoluteSeconds={absoluteSeconds}
            cues={wordCues}
            style={captionStyle}
          />
        ) : showCaption ? (
          <StaticCaption caption={caption} style={captionStyle} />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hiddenOverlayText(plan: RenderPlan) {
  return new Set(
    [plan.hook, plan.cta]
      .map((value) => normalizeText(value ?? ""))
      .filter(Boolean),
  );
}

export function UGCVideo({ plan }: UGCVideoProps) {
  const fps = plan.fps || 30;
  const { durationInFrames } = useVideoConfig();
  const hiddenText = hiddenOverlayText(plan);
  const wordCues = voiceoverCues(plan);
  const reducedMotion = prefersReducedMotion();
  const musicVolume = Math.min(1, Math.max(0, plan.musicVolume));
  const musicDuckedVolume = Math.min(musicVolume, musicVolume * 0.45);

  // Clips are capped to their real length, so the scenes can total less than
  // the composition (which is stretched to fit the voiceover). Hold the final
  // clip across that gap instead of cutting to black mid-narration.
  const baseSequenceFrames = plan.scenes.map((scene, index) => {
    const presentation = reducedMotion ? null : transitionPresentation(scene);
    const hasIncomingTransition = index > 0 && presentation !== null;

    return (
      secondsToFrames(scene.durationSeconds, fps) +
      (hasIncomingTransition ? transitionFrames : 0)
    );
  });
  const totalSequenceFrames = baseSequenceFrames.reduce(
    (total, frames) => total + frames,
    0,
  );
  const trailingHoldFrames = Math.max(0, durationInFrames - totalSequenceFrames);

  return (
    <AbsoluteFill style={{ background, color: "white" }}>
      {plan.voiceoverUrl ? <Audio src={plan.voiceoverUrl} /> : null}
      {plan.musicSource !== "none" && plan.musicUrl ? (
        <Audio
          src={plan.musicUrl}
          loop
          volume={
            plan.duckMusicUnderVoiceover && plan.voiceoverUrl
              ? () => musicDuckedVolume
              : musicVolume
          }
        />
      ) : null}
      <TransitionSeries>
        {plan.scenes.map((scene, index) => {
          const presentation = reducedMotion ? null : transitionPresentation(scene);
          const hasIncomingTransition = index > 0 && presentation !== null;
          const isLastScene = index === plan.scenes.length - 1;
          const sequenceDuration =
            baseSequenceFrames[index] +
            (isLastScene ? trailingHoldFrames : 0);

          return (
            <Fragment key={scene.id}>
              {hasIncomingTransition ? (
                <TransitionSeries.Transition
                  presentation={presentation}
                  timing={linearTiming({ durationInFrames: transitionFrames })}
                />
              ) : null}
              <TransitionSeries.Sequence durationInFrames={sequenceDuration}>
                <SceneLayer
                  hiddenText={hiddenText}
                  plan={plan}
                  scene={scene}
                  wordCues={wordCues}
                  fps={fps}
                />
              </TransitionSeries.Sequence>
            </Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
