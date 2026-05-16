import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import type { ProductDemoScreenshot, RemotionRenderProps } from "@/lib/schemas";

export const defaultReleaseDemoProps: RemotionRenderProps = {
  productName: "ProofPitch",
  companyDescription:
    "ProofPitch helps founder-led teams turn a product URL into a credible sales walkthrough, pitch deck, and claim ledger.",
  oneLiner: "Product URL to proof-backed pitch deck and product demo plan.",
  sourceUrl: "https://example.com",
  screenshots: [
    {
      action: "open",
      title: "Product entry",
      url: "https://example.com#product-entry",
      alt: "Product entry screen",
    },
  ],
  demoSteps: [
    "Open the public product.",
    "Show the core product workflow.",
    "Pause on the proof moment.",
    "Use the deck as the separate follow-up asset.",
  ],
  captions: [
    "Product demo and pitch deck are separate assets.",
    "Claims stay reviewable before external use.",
  ],
};

function frameIndex(length: number, frame: number, durationInFrames: number) {
  const framesPerStep = durationInFrames / Math.max(1, length);

  return Math.min(Math.max(0, length - 1), Math.floor(frame / framesPerStep));
}

function clampPercent(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(96, Math.max(4, value));
}

function cursorTarget(screenshot?: ProductDemoScreenshot) {
  if (screenshot?.pointer) {
    return {
      x: clampPercent(screenshot.pointer.x, 54),
      y: clampPercent(screenshot.pointer.y, 48),
    };
  }

  if (!screenshot) {
    return { x: 54, y: 48 };
  }

  if (screenshot.action === "search") {
    return { x: 48, y: 17 };
  }

  if (screenshot.action === "scroll") {
    return { x: 91, y: 74 };
  }

  if (screenshot.action === "first_result") {
    return { x: 45, y: 36 };
  }

  if (screenshot.action === "click" || screenshot.action === "consent") {
    return { x: 52, y: 48 };
  }

  return { x: 35, y: 24 };
}

function subtleStepLabel(step: string) {
  return step
    .replace(/^Opened\s+/i, "Opening ")
    .replace(/^Clicked\s+/i, "Clicking ")
    .replace(/^Searched for\s+/i, "Searching ")
    .replace(/^Opened first result:\s*/i, "Opening first result: ")
    .replace(/^Scrolled page:\s*/i, "Scrolling ")
    .replace(/^Could not find\s+/i, "Looking for ")
    .replace(/^Scrolling\s+scroll down,?/i, "Scrolling down")
    .replace(/^Scrolling\s+continue scrolling through the page/i, "Scrolling the page")
    .replaceAll('"', "")
    .replace(/\.$/, "");
}

function voiceoverTextForStep(props: RemotionRenderProps, stepIndex: number, fallback: string) {
  return props.voiceoverSegments?.[stepIndex]?.text ?? subtleStepLabel(fallback);
}

type VoiceoverSegment = NonNullable<RemotionRenderProps["voiceoverSegments"]>[number];

function estimateVoiceoverFrames(text: string, fps: number) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(3.8, Math.min(10, words / 2 + 1.8));

  return Math.ceil(seconds * fps);
}

function voiceoverFramesForSegment(segment: VoiceoverSegment, fps: number) {
  const estimatedFrames = estimateVoiceoverFrames(segment.text, fps);
  const measuredFrames = segment.durationSeconds ? segment.durationSeconds * fps : 0;

  if (!Number.isFinite(measuredFrames) || measuredFrames <= 0) {
    return estimatedFrames;
  }

  if (measuredFrames > fps * 18 || measuredFrames > estimatedFrames * 2.4) {
    return estimatedFrames;
  }

  return Math.max(Math.round(fps * 2.6), Math.ceil(measuredFrames));
}

function voiceoverTimeline(segments: VoiceoverSegment[], fps: number, durationInFrames: number) {
  const gapFrames = Math.round(fps * 1.1);
  let cursor = Math.round(fps * 0.4);

  return segments
    .map((segment) => {
      const durationInFramesForSegment = voiceoverFramesForSegment(segment, fps) + Math.ceil(gapFrames * 0.35);
      const from = cursor;
      const end = from + durationInFramesForSegment;

      cursor = end + gapFrames;

      return {
        ...segment,
        end,
        from,
      };
    })
    .filter((segment) => segment.from < durationInFrames - Math.round(fps * 0.6));
}

function CursorLayer({
  localProgress,
  screenshot,
}: {
  localProgress: number;
  screenshot?: ProductDemoScreenshot;
}) {
  const target = cursorTarget(screenshot);
  const cursorX = interpolate(localProgress, [0, 0.62, 1], [16, target.x, target.x]);
  const cursorY = interpolate(localProgress, [0, 0.62, 1], [82, target.y, target.y]);
  const clickOpacity =
    screenshot?.action === "click" ||
    screenshot?.action === "explore" ||
    screenshot?.action === "consent" ||
    screenshot?.action === "first_result"
      ? interpolate(localProgress, [0.56, 0.7, 0.86], [0, 0.9, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const clickScale = interpolate(localProgress, [0.56, 0.86], [0.6, 2.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scrollOpacity =
    screenshot?.action === "scroll"
      ? interpolate(localProgress, [0.15, 0.32, 0.86, 1], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const searchOpacity =
    screenshot?.action === "search"
      ? interpolate(localProgress, [0.12, 0.28, 0.9, 1], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <>
      {searchOpacity > 0 ? (
        <div
          style={{
            position: "absolute",
            left: "12%",
            right: "12%",
            top: 30,
            border: "2px solid #111827",
            background: "rgba(255,250,240,0.95)",
            boxShadow: "0 14px 30px rgba(17,24,39,0.2)",
            color: "#111827",
            fontSize: 28,
            opacity: searchOpacity,
            padding: "18px 22px",
          }}
        >
          Searching: {screenshot?.target || screenshot?.title}
        </div>
      ) : null}

      {scrollOpacity > 0 ? (
        <div
          style={{
            position: "absolute",
            right: 26,
            top: "35%",
            width: 58,
            height: 130,
            border: "2px solid rgba(255,250,240,0.95)",
            background: "rgba(17,24,39,0.72)",
            opacity: scrollOpacity,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              top: interpolate(localProgress, [0.2, 0.82], [18, 82], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              height: 24,
              background: "#fffaf0",
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: `${cursorX}%`,
          top: `${cursorY}%`,
          transform: "translate(-4px, -4px)",
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))",
        }}
      >
        {clickOpacity > 0 ? (
          <div
            style={{
              position: "absolute",
              left: -24,
              top: -24,
              width: 66,
              height: 66,
              border: "4px solid #14b8a6",
              borderRadius: 999,
              opacity: clickOpacity,
              transform: `scale(${clickScale})`,
            }}
          />
        ) : null}
        <svg width="46" height="56" viewBox="0 0 46 56" aria-hidden="true">
          <path
            d="M5 4L5 43L16 34L24 52L34 48L26 31L41 31L5 4Z"
            fill="#fffaf0"
            stroke="#111827"
            strokeLinejoin="round"
            strokeWidth="5"
          />
        </svg>
      </div>
    </>
  );
}

export function ReleaseDemo(props: RemotionRenderProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const scheduledVoiceovers = voiceoverTimeline(props.voiceoverSegments ?? [], fps, durationInFrames);
  const activeVoiceover = scheduledVoiceovers.find((segment) => frame >= segment.from && frame < segment.end);
  const stepCount = Math.max(1, props.screenshots.length, props.demoSteps.length && !scheduledVoiceovers.length ? props.demoSteps.length : 0);
  const framesPerStep = durationInFrames / stepCount;
  const stepIndex = frameIndex(stepCount, frame, durationInFrames);
  const localFrame = frame - stepIndex * framesPerStep;
  const localProgress = interpolate(localFrame, [0, framesPerStep], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const screenshot = props.screenshots[stepIndex % Math.max(1, props.screenshots.length)];
  const currentStep = props.demoSteps[stepIndex] ?? props.demoSteps.at(-1) ?? screenshot?.title ?? "Capture product flow.";
  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = activeVoiceover
    ? interpolate(frame, [activeVoiceover.from, activeVoiceover.from + fps * 0.25, activeVoiceover.end - fps * 0.4, activeVoiceover.end], [0, 0.86, 0.86, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : scheduledVoiceovers.length
      ? 0
      : interpolate(localProgress, [0, 0.07, 0.94, 1], [0, 0.86, 0.86, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const imageScale = 1.035 + localProgress * 0.045;
  const imageTranslateY =
    screenshot?.action === "scroll"
      ? interpolate(localProgress, [0, 1], [24, -52])
      : interpolate(localProgress, [0, 1], [0, -18]);
  const hasBrowserRecording = Boolean(props.browserRecordingUrl);

  return (
    <AbsoluteFill
      style={{
        background: "#101418",
        color: "#111827",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#0f172a",
        }}
      >
        {hasBrowserRecording ? (
          <OffthreadVideo
            muted
            src={props.browserRecordingUrl as string}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              background: "#0f172a",
            }}
          />
        ) : screenshot ? (
          <Img
            src={screenshot.url}
            alt={screenshot.alt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.94,
              transform: `scale(${imageScale}) translateY(${imageTranslateY}px)`,
              transformOrigin: "50% 35%",
            }}
          />
        ) : null}
        {hasBrowserRecording ? null : <CursorLayer localProgress={localProgress} screenshot={screenshot} />}
      </div>
      <div
        style={{
          position: "absolute",
          left: 56,
          right: 56,
          bottom: 34,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            borderRadius: 8,
            background: "rgba(15,23,42,0.62)",
            boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
            color: "rgba(255,255,255,0.92)",
            fontSize: 25,
            fontWeight: 500,
            lineHeight: 1.24,
            opacity: subtitleOpacity,
            padding: "11px 18px 12px",
            textAlign: "center",
          }}
        >
          {activeVoiceover?.text ?? voiceoverTextForStep(props, stepIndex, currentStep)}
        </div>
      </div>
      {scheduledVoiceovers.map((segment, index) =>
        segment.url ? (
          <Sequence key={`${segment.url}-${index}`} from={segment.from} durationInFrames={segment.end - segment.from}>
            <Audio src={segment.url} volume={0.94} />
          </Sequence>
        ) : null,
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          background: "rgba(255,255,255,0.16)",
        }}
      >
        <div style={{ width: `${progress}%`, height: "100%", background: "rgba(45,212,191,0.82)" }} />
      </div>
    </AbsoluteFill>
  );
}
