import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { RemotionRenderProps } from "@/lib/schemas";

export const defaultReleaseDemoProps: RemotionRenderProps = {
  productName: "ProofPitch",
  oneLiner: "Product URL to proof-backed pitch deck and product demo plan.",
  sourceUrl: "https://example.com",
  screenshots: [
    {
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

function frameIndex(length: number, frame: number, fps: number) {
  const framesPerStep = fps * 3;
  return Math.min(Math.max(0, length - 1), Math.floor(frame / framesPerStep));
}

export function ReleaseDemo(props: RemotionRenderProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stepIndex = frameIndex(props.demoSteps.length, frame, fps);
  const screenshot = props.screenshots[stepIndex % Math.max(1, props.screenshots.length)];
  const progress = interpolate(frame, [0, fps * 12], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          gridTemplateColumns: "1.05fr 0.95fr",
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
              {props.productName}
            </div>
            <h1 style={{ margin: "42px 0 0", fontSize: 84, lineHeight: 0.94, maxWidth: 820 }}>
              Real product demo first.
            </h1>
            <p style={{ marginTop: 28, fontSize: 34, lineHeight: 1.24, maxWidth: 820 }}>
              {props.oneLiner}
            </p>
          </div>
          <div>
            <div style={{ fontSize: 24, color: "#64748b" }}>{props.sourceUrl}</div>
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
            {screenshot ? (
              <Img
                src={screenshot.url}
                alt={screenshot.alt}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.92,
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                bottom: 24,
                background: "rgba(244,239,230,0.92)",
                border: "2px solid #111827",
                padding: 18,
                fontSize: 28,
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
              fontSize: 32,
              lineHeight: 1.25,
            }}
          >
            {stepIndex + 1}. {props.demoSteps[stepIndex]}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
