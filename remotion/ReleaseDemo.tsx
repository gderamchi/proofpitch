import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { RemotionRenderProps } from "@/lib/schemas";

export const defaultReleaseDemoProps: RemotionRenderProps = {
  productName: "ProofPitch",
  oneLiner: "Release-ready decks, demo videos, voiceovers, and posts from one reviewed product story.",
  sourceUrl: "https://example.com",
  deckTitle: "ProofPitch release deck",
  slideCount: 8,
  captions: [
    "Pitch deck, demo video, voiceover, and posts generated from one reviewed narrative.",
    "Unsupported claims stay out of the public release.",
  ],
  scenes: [
    {
      kind: "hook",
      title: "ProofPitch",
      body: "Release-ready decks, demo videos, voiceovers, and posts from one reviewed product story.",
    },
    {
      kind: "problem",
      title: "Problem",
      body: "Teams have products ready to show, but no serious release assets.",
    },
    {
      kind: "solution",
      title: "Solution",
      body: "ProofPitch turns product context into a deck, video, voiceover, and channel copy.",
    },
    {
      kind: "proof",
      title: "Proof",
      body: "Claims remain visible and reviewable before anything gets published.",
    },
    {
      kind: "demo",
      title: "Demo",
      body: "Open the product, show the core workflow, then connect it to the release promise.",
    },
    {
      kind: "cta",
      title: "Release Pack",
      body: "Use the approved assets for YouTube, LinkedIn, X, sales, and investor conversations.",
    },
  ],
};

const palette: Record<RemotionRenderProps["scenes"][number]["kind"], string> = {
  hook: "#38bdf8",
  problem: "#f97316",
  solution: "#34d399",
  proof: "#a78bfa",
  demo: "#facc15",
  cta: "#f472b6",
};

function currentScene(props: RemotionRenderProps, frame: number, fps: number) {
  const framesPerScene = fps * 4;
  const index = Math.min(props.scenes.length - 1, Math.floor(frame / framesPerScene));
  const start = index * framesPerScene;

  return {
    scene: props.scenes[index],
    index,
    progress: Math.min(1, Math.max(0, (frame - start) / framesPerScene)),
  };
}

export function ReleaseDemo(props: RemotionRenderProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scene, index, progress } = currentScene(props, frame, fps);
  const accent = palette[scene.kind];
  const entrance = spring({
    frame: Math.max(0, frame - index * fps * 4),
    fps,
    config: {
      damping: 16,
      mass: 0.8,
    },
  });
  const meter = interpolate(progress, [0, 1], [0, 100]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #030712 0%, #07111d 55%, #111827 100%)",
        color: "white",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: "hidden",
      }}
    >
      {props.voiceoverUrl ? <Audio src={props.voiceoverUrl} /> : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.28,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 580,
          height: 580,
          borderRadius: 999,
          right: -180,
          top: -210,
          background: accent,
          filter: "blur(170px)",
          opacity: 0.28,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 54,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 28,
          color: "#cbd5e1",
        }}
      >
        <span style={{ fontWeight: 700, color: "#f8fafc" }}>{props.productName}</span>
        <span>{props.deckTitle}</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 140,
          bottom: 110,
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 20,
          background: "rgba(2,6,23,0.72)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          padding: 58,
          transform: `scale(${0.94 + entrance * 0.06}) translateY(${(1 - entrance) * 22}px)`,
          opacity: 0.72 + entrance * 0.28,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            border: `1px solid ${accent}66`,
            background: `${accent}1d`,
            color: "#f8fafc",
            borderRadius: 999,
            padding: "12px 18px",
            fontSize: 28,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0,
          }}
        >
          {scene.kind}
        </div>
        <h1
          style={{
            margin: "42px 0 0",
            fontSize: 84,
            lineHeight: 0.96,
            maxWidth: 1060,
            letterSpacing: 0,
          }}
        >
          {scene.title}
        </h1>
        <p
          style={{
            marginTop: 34,
            fontSize: 38,
            lineHeight: 1.35,
            maxWidth: 1040,
            color: "#cbd5e1",
          }}
        >
          {scene.body}
        </p>
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 48,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 32,
          color: "#94a3b8",
          fontSize: 24,
        }}
      >
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${meter}%`,
              height: "100%",
              background: accent,
            }}
          />
        </div>
        <span>
          {index + 1}/{props.scenes.length} · {props.slideCount} slides · {props.sourceUrl}
        </span>
      </div>
    </AbsoluteFill>
  );
}
