import React from "react";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";

import type { ProductDemoScreenshot, RemotionRenderProps } from "@/lib/schemas";

export const defaultReleaseDemoProps: RemotionRenderProps = {
  productName: "ProofPitch",
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

function actionLabel(screenshot?: ProductDemoScreenshot) {
  if (!screenshot?.action) {
    return "capture";
  }

  return screenshot.action.split("_").join(" ");
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
    screenshot?.action === "click" || screenshot?.action === "consent" || screenshot?.action === "first_result"
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
  const { durationInFrames } = useVideoConfig();
  const stepCount = Math.max(1, props.demoSteps.length, props.screenshots.length);
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
  const imageScale = 1.035 + localProgress * 0.045;
  const imageTranslateY =
    screenshot?.action === "scroll"
      ? interpolate(localProgress, [0, 1], [24, -52])
      : interpolate(localProgress, [0, 1], [0, -18]);
  const hasBrowserRecording = Boolean(props.browserRecordingUrl);

  return (
    <AbsoluteFill
      style={{
        background: "#f4efe6",
        color: "#111827",
        fontFamily: "ui-serif, Georgia, Cambria, Times New Roman, serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 44,
          display: "grid",
          gridTemplateColumns: "0.62fr 1.38fr",
          gap: 36,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            border: "2px solid #111827",
            background: "#fffaf0",
            padding: 42,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 30, letterSpacing: 0, textTransform: "uppercase" }}>
              {hasBrowserRecording ? "live browser recording" : actionLabel(screenshot)}
            </div>
            <h1 style={{ margin: "42px 0 0", fontSize: 66, lineHeight: 0.96, maxWidth: 560 }}>
              Watching the agent use the site.
            </h1>
            <p style={{ marginTop: 28, fontSize: 28, lineHeight: 1.28, maxWidth: 560 }}>
              {props.oneLiner}
            </p>
          </div>
          <div>
            <div style={{ fontSize: 22, color: "#64748b" }}>{props.sourceUrl}</div>
            <div
              style={{
                marginTop: 18,
                height: 12,
                background: "#d6d3d1",
                overflow: "hidden",
              }}
            >
              <div style={{ width: `${progress}%`, height: "100%", background: "#0f766e" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 24 }}>
          <div
            style={{
              border: "2px solid #111827",
              background: "#111827",
              overflow: "hidden",
              position: "relative",
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
                  background: "#d1d5db",
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
                  opacity: 0.92,
                  transform: `scale(${imageScale}) translateY(${imageTranslateY}px)`,
                  transformOrigin: "50% 35%",
                }}
              />
            ) : null}
            {hasBrowserRecording ? null : <CursorLayer localProgress={localProgress} screenshot={screenshot} />}
            <div
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                bottom: 24,
                background: "rgba(244,239,230,0.92)",
                border: "2px solid #111827",
                padding: 18,
                fontSize: 30,
              }}
            >
              {screenshot?.title ?? "Product capture required"}
            </div>
          </div>
          <div
            style={{
              border: "2px solid #111827",
              background: "#fffaf0",
              padding: 26,
              fontSize: 34,
              lineHeight: 1.25,
            }}
          >
            {stepIndex + 1}. {currentStep}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
