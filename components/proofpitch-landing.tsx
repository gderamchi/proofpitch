"use client";

import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Download,
  ExternalLink,
  Loader2,
  Mic2,
  RefreshCw,
  Video,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { DemoVideoProject } from "@/lib/schemas";

const sampleInput = {
  sourceUrl: "https://proofpitch.vercel.app",
  productName: "ProofPitch",
  targetAudience: "Founder-led B2B teams",
  demoGoal: "Show the product URL to generated demo video workflow.",
  demoInstructions: "",
};

type RenderVideoResponse = {
  error?: string;
  detail?: string;
  project?: DemoVideoProject;
  videoUrl?: string;
  render?: {
    enabled: boolean;
    commands: string[];
    artifacts: Array<{
      type?: string;
      status?: string;
      path?: string;
      error?: string;
    }>;
    error?: string;
  };
};

function ProofPitchLogo() {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-stone-900 bg-stone-950">
      <Image
        src="/brand/proofpitch-logo.png"
        width={32}
        height={32}
        alt=""
        className="h-8 w-8 object-contain"
        priority
      />
    </span>
  );
}

function statusTone(status: string) {
  if (status === "ready" || status === "completed" || status === "approved" || status === "used") {
    return "border-emerald-800 bg-emerald-50 text-emerald-950";
  }

  if (status === "failed" || status === "unsupported") {
    return "border-red-800 bg-red-50 text-red-950";
  }

  if (status === "captions_only" || status === "fallback" || status === "missing") {
    return "border-sky-800 bg-sky-50 text-sky-950";
  }

  return "border-amber-800 bg-amber-50 text-amber-950";
}

function compact(value: string, max = 140) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 3).replace(/\s+\S*$/, "")}...`;
}

function downloadUrl(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "proofpitch-demo-video.mp4";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function EmptyOutput() {
  return (
    <div className="grid min-h-[440px] content-center gap-5 border-2 border-stone-950 bg-white p-5 shadow-[10px_10px_0_#111827]">
      <div className="mx-auto grid max-w-xl justify-items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">Output</p>
        <h2 className="mt-4 text-3xl font-semibold leading-tight text-stone-950">
          Your demo video will appear here.
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Enter a product URL and ProofPitch will generate the walkthrough, render the MP4, and attach voiceover when Gradium is configured.
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-md gap-3">
        {[
          ["HyperFrames MP4", Video],
          ["Stable video endpoint", ExternalLink],
          ["Gradium voiceover", Mic2],
        ].map(([label, Icon]) => (
          <div key={label as string} className="flex items-center gap-3 border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700">
            <Icon size={16} className="text-stone-900" />
            {label as string}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProviderStrip({ project }: { project: DemoVideoProject }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {Object.entries(project.providers).map(([provider, report]) =>
        report ? (
          <div key={provider} className={`border px-3 py-2 text-xs font-semibold ${statusTone(report.state)}`}>
            {provider}: {report.state}
          </div>
        ) : null,
      )}
    </div>
  );
}

function DetailPanel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <details className="group border border-stone-300 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-stone-950">
        {title}
        <ChevronDown size={16} className="transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-stone-200 px-3 py-3">{children}</div>
    </details>
  );
}

function OutputPreview({
  isGenerating,
  isRenderingVideo,
  onRenderVideo,
  project,
  renderMessage,
}: {
  isGenerating: boolean;
  isRenderingVideo: boolean;
  onRenderVideo: () => Promise<void>;
  project: DemoVideoProject | null;
  renderMessage: string | null;
}) {
  if (!project) {
    return <EmptyOutput />;
  }

  const videoReady = project.demoVideo.status === "ready";
  const videoUrl = `/api/demo-videos/${project.id}/video`;

  return (
    <div className="grid max-h-none min-h-[440px] gap-4 overflow-visible border-2 border-stone-950 bg-white p-5 shadow-[10px_10px_0_#111827] lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">Demo video</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-stone-950">{project.productName}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`border px-3 py-2 text-xs font-semibold ${statusTone(project.demoVideo.status)}`}>
            Video {project.demoVideo.status}
          </span>
          <span className={`border px-3 py-2 text-xs font-semibold ${statusTone(project.voiceover.status)}`}>
            Audio {project.voiceover.status.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      {videoReady ? (
        <div className="grid gap-3">
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full border border-stone-900 bg-stone-950 shadow-[6px_6px_0_#111827]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-stone-900 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-teal-50"
            >
              <ExternalLink size={15} />
              Open MP4
            </a>
            <button
              type="button"
              onClick={() => downloadUrl(videoUrl)}
              className="inline-flex items-center gap-2 border border-stone-900 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-teal-50"
            >
              <Download size={15} />
              Download MP4
            </button>
          </div>
        </div>
      ) : (
        <div className="grid aspect-video place-items-center border border-stone-900 bg-stone-950 p-6 text-center text-white shadow-[6px_6px_0_#111827]">
          <div className="grid justify-items-center gap-4">
            {isRenderingVideo ? <Loader2 size={34} className="animate-spin" /> : <Video size={34} />}
            <div>
              <p className="text-lg font-semibold">{isRenderingVideo ? "Rendering MP4" : "Video not rendered yet"}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-300">
                {isRenderingVideo
                  ? "Capturing the product flow, generating the composition, and rendering the video."
                  : "Launch the render to create the final playable demo video."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onRenderVideo()}
              disabled={isRenderingVideo}
              className="inline-flex items-center gap-2 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRenderingVideo ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {isRenderingVideo ? "Rendering" : "Render video"}
            </button>
          </div>
        </div>
      )}

      {renderMessage ? (
        <div className="flex gap-3 border border-amber-800 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <AlertCircle size={16} className="mt-1 shrink-0" />
          {renderMessage}
        </div>
      ) : null}

      {project.demoVideo.error && !videoReady ? (
        <div className="flex gap-3 border border-amber-800 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <AlertCircle size={16} className="mt-1 shrink-0" />
          {project.demoVideo.error}
        </div>
      ) : null}

      <div className="grid gap-2">
        <DetailPanel title="Status">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`border px-4 py-3 text-sm font-semibold ${statusTone(project.demoVideo.status)}`}>
              Video: {project.demoVideo.status}
              <p className="mt-1 text-xs font-normal leading-5">{project.demoVideo.uploadStatus.replaceAll("_", " ")}</p>
            </div>
            <div className={`border px-4 py-3 text-sm font-semibold ${statusTone(project.voiceover.status)}`}>
              Audio: {project.voiceover.status.replaceAll("_", " ")}
              <p className="mt-1 text-xs font-normal leading-5">{project.voiceover.provider}</p>
            </div>
            <div className={`border px-4 py-3 text-sm font-semibold ${statusTone(project.status)}`}>
              Project: {project.status}
              <p className="mt-1 text-xs font-normal leading-5">Stored render state</p>
            </div>
          </div>
          {project.voiceover.reason ? (
            <div className="mt-3 flex gap-3 border border-sky-800 bg-sky-50 p-3 text-sm leading-6 text-sky-950">
              <Mic2 size={16} className="mt-1 shrink-0" />
              {project.voiceover.reason}
            </div>
          ) : null}
        </DetailPanel>

        <DetailPanel title="Providers">
          <ProviderStrip project={project} />
        </DetailPanel>

        <DetailPanel title="Captions">
          <div className="grid gap-2 sm:grid-cols-2">
            {project.captions.map((caption) => (
              <div key={caption} className="border border-stone-300 bg-[#f8fbf8] px-3 py-2 text-xs leading-5 text-stone-700">
                {caption}
              </div>
            ))}
          </div>
        </DetailPanel>

        <DetailPanel title="Source captures">
          <div className="grid gap-2">
            {project.screenshots.length ? (
              project.screenshots.map((screenshot) => (
                <a
                  key={screenshot.id}
                  href={screenshot.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 border border-stone-300 bg-[#f8fbf8] px-3 py-2 text-xs leading-5 text-stone-700 transition hover:bg-teal-50"
                >
                  <span>{compact(screenshot.title, 120)}</span>
                  <ExternalLink size={14} />
                </a>
              ))
            ) : (
              <p className="text-sm leading-6 text-stone-600">No screenshot was captured for this run.</p>
            )}
          </div>
        </DetailPanel>

        <DetailPanel title="Narration script">
          <p className="text-sm leading-6 text-stone-700">{project.voiceover.script}</p>
        </DetailPanel>
      </div>

      {isGenerating ? (
        <p className="text-sm text-stone-500">Preparing the video run...</p>
      ) : null}
    </div>
  );
}

export function ProofPitchLanding() {
  const [sourceUrl, setSourceUrl] = useState(sampleInput.sourceUrl);
  const [productName, setProductName] = useState(sampleInput.productName);
  const [targetAudience, setTargetAudience] = useState(sampleInput.targetAudience);
  const [demoGoal, setDemoGoal] = useState(sampleInput.demoGoal);
  const [demoInstructions, setDemoInstructions] = useState(sampleInput.demoInstructions);
  const [isGenerating, setIsGenerating] = useState(false);
  const [project, setProject] = useState<DemoVideoProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderMessage, setRenderMessage] = useState<string | null>(null);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    setRenderMessage(null);

    try {
      const response = await fetch("/api/demo-videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl,
          productName,
          targetAudience,
          demoGoal,
          demoInstructions: demoInstructions.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail ?? data?.error ?? "Demo video generation failed.");
      }

      const nextProject = data as DemoVideoProject;
      setProject(nextProject);
      setIsGenerating(false);
      await renderDemoVideo(nextProject);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Demo video generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function renderDemoVideo(projectToRender = project) {
    if (!projectToRender) {
      return;
    }

    setIsRenderingVideo(true);
    setRenderMessage("Capturing the site and rendering with HyperFrames...");
    setError(null);

    try {
      const response = await fetch(`/api/demo-videos/${projectToRender.id}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          captureSite: true,
          dryRun: false,
          project: projectToRender,
          renderVideo: true,
        }),
      });
      const data = (await response.json()) as RenderVideoResponse;

      if (!response.ok || data.error) {
        throw new Error(data.detail ?? data.error ?? "Video render failed.");
      }

      if (!data.render?.enabled) {
        setProject(data.project ?? projectToRender);
        setRenderMessage("Video render is disabled in this environment. Set PROOFPITCH_ENABLE_LOCAL_RENDER=1 to render locally.");
        return;
      }

      const videoArtifact = data.render.artifacts.find((artifact) => artifact.type === "video");

      if (!videoArtifact || videoArtifact.status !== "ready") {
        throw new Error(data.render.error ?? "Video render did not finish.");
      }

      setProject(data.project ?? projectToRender);
      setRenderMessage("Demo video rendered.");
    } catch (renderError) {
      const message = renderError instanceof Error ? renderError.message : "Video render failed.";

      setError(message);
      setRenderMessage(null);
    } finally {
      setIsRenderingVideo(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#edf4f1] text-stone-950">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8">
        <div className="grid gap-5">
          <nav className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ProofPitchLogo />
              <div>
                <p className="text-sm font-semibold">ProofPitch</p>
                <p className="text-xs text-stone-500">demo video</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSourceUrl(sampleInput.sourceUrl);
                setProductName(sampleInput.productName);
                setTargetAudience(sampleInput.targetAudience);
                setDemoGoal(sampleInput.demoGoal);
                setDemoInstructions(sampleInput.demoInstructions);
              }}
              className="border border-stone-900 bg-white px-3 py-2 text-xs font-semibold transition hover:bg-teal-50"
            >
              Load sample
            </button>
          </nav>

          <div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[0.96] text-stone-950 sm:text-5xl lg:text-6xl">
              Product URL to demo video.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              Give it a URL and an optional path. ProofPitch renders the MP4 directly, with Gradium voiceover when production audio is configured.
            </p>
          </div>

          <form onSubmit={handleGenerate} className="grid gap-3 border-2 border-stone-950 bg-white p-3">
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              className="border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm outline-none focus:border-teal-800"
              placeholder="Public product URL"
              type="url"
              required
              suppressHydrationWarning
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm outline-none focus:border-teal-800"
                placeholder="Product name"
                required
                suppressHydrationWarning
              />
              <input
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                className="border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm outline-none focus:border-teal-800"
                placeholder="Target audience"
                required
                suppressHydrationWarning
              />
            </div>
            <textarea
              value={demoGoal}
              onChange={(event) => setDemoGoal(event.target.value)}
              rows={2}
              className="resize-none border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-800"
              placeholder="Demo goal"
              required
              suppressHydrationWarning
            />
            <textarea
              value={demoInstructions}
              onChange={(event) => setDemoInstructions(event.target.value)}
              rows={2}
              className="resize-none border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-800"
              placeholder="Optional path, e.g. accept cookies, open Pricing, scroll to the CTA"
              suppressHydrationWarning
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center gap-2 bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {isGenerating ? "Preparing" : "Generate video"}
              </button>
              {project ? (
                <button
                  type="button"
                  onClick={() => void renderDemoVideo()}
                  disabled={isRenderingVideo}
                  className="inline-flex items-center gap-2 border border-stone-900 bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRenderingVideo ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Re-render video
                </button>
              ) : null}
              {error ? <span className="text-sm font-medium text-red-800">{error}</span> : null}
            </div>
          </form>
        </div>

        <OutputPreview
          key={project?.id ?? "empty-output"}
          isGenerating={isGenerating}
          isRenderingVideo={isRenderingVideo}
          onRenderVideo={renderDemoVideo}
          project={project}
          renderMessage={renderMessage}
        />
      </section>
    </main>
  );
}
