"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  Loader2,
  Mic2,
  RefreshCw,
  ShieldCheck,
  Video,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { DemoVideoProject } from "@/lib/schemas";

const sampleInput = {
  sourceUrl: "https://proofpitch.vercel.app",
  productName: "ProofPitch",
  targetAudience: "Founder-led B2B teams",
  demoGoal: "Show the product URL to proof-aware demo video workflow.",
  demoInstructions: "Open the page, review the form, show the proof review, then render the demo video.",
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

function claimStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function canUseClaim(status: string) {
  return status !== "unsupported";
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
    <div className="grid min-h-[440px] content-between border-2 border-stone-950 bg-white p-5 shadow-[10px_10px_0_#111827]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">Output</p>
        <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight text-stone-950">
          Demo video, proof review, and voiceover state.
        </h2>
      </div>
      <div className="grid gap-3">
        {[
          ["Proof-aware brief", ShieldCheck],
          ["HyperFrames MP4", Video],
          ["Gradium or captions-only", Mic2],
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

function ProofReview({
  acceptedClaimIds,
  isApproving,
  onApprove,
  onToggleClaim,
  project,
}: {
  acceptedClaimIds: string[];
  isApproving: boolean;
  onApprove: () => Promise<void>;
  onToggleClaim: (claimId: string) => void;
  project: DemoVideoProject;
}) {
  const acceptedSet = new Set(acceptedClaimIds);
  const approved = project.proofReview.status === "approved";
  const canApprove = acceptedClaimIds.length > 0 && !approved;

  return (
    <div className="grid gap-3 border border-stone-300 bg-[#f8fbf8] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-950">Proof review</p>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            Accepted claims become captions and voiceover material.
          </p>
        </div>
        <span className={`border px-2 py-1 text-xs font-semibold ${statusTone(project.proofReview.status)}`}>
          {project.proofReview.status}
        </span>
      </div>

      <div className="grid gap-2">
        {project.demoBrief.claims.map((claim) => {
          const blocked = !canUseClaim(claim.status);

          return (
            <label
              key={claim.id}
              className={`flex gap-3 border bg-white p-3 text-sm leading-6 ${
                blocked ? "border-red-200 text-stone-500" : "border-stone-300 text-stone-800"
              }`}
            >
              <input
                type="checkbox"
                checked={!blocked && acceptedSet.has(claim.id)}
                disabled={blocked || approved}
                onChange={() => onToggleClaim(claim.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-teal-800"
              />
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-normal text-teal-800">
                  {claimStatusLabel(claim.status)}
                </span>
                {claim.text}
                <span className="mt-1 block text-xs text-stone-500">{claim.explanation}</span>
              </span>
            </label>
          );
        })}
      </div>

      {!approved ? (
        <button
          type="button"
          onClick={onApprove}
          disabled={!canApprove || isApproving}
          className="inline-flex w-fit items-center gap-2 bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isApproving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Approve for narration
        </button>
      ) : null}
    </div>
  );
}

function OutputPreview({
  acceptedClaimIds,
  isApproving,
  isGenerating,
  isRenderingVideo,
  onApproveProof,
  onCopy,
  onRenderVideo,
  onToggleClaim,
  project,
  renderMessage,
}: {
  acceptedClaimIds: string[];
  isApproving: boolean;
  isGenerating: boolean;
  isRenderingVideo: boolean;
  onApproveProof: () => Promise<void>;
  onCopy: (text: string) => Promise<void>;
  onRenderVideo: () => Promise<void>;
  onToggleClaim: (claimId: string) => void;
  project: DemoVideoProject | null;
  renderMessage: string | null;
}) {
  if (!project) {
    return <EmptyOutput />;
  }

  const videoReady = project.demoVideo.status === "ready" && Boolean(project.demoVideo.url);
  const acceptedClaims = project.demoBrief.claims.filter((claim) => project.proofReview.acceptedClaimIds.includes(claim.id));

  return (
    <div className="grid max-h-none min-h-[440px] gap-4 overflow-visible border-2 border-stone-950 bg-white p-5 shadow-[10px_10px_0_#111827] lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">
            {project.proofReview.status === "approved" ? "Narration ready" : "Proof review"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-stone-950">{project.productName}</h2>
        </div>
        <button
          type="button"
          onClick={() => onCopy(project.voiceover.script)}
          className="inline-flex h-10 w-10 items-center justify-center border border-stone-900 bg-white text-stone-950 transition hover:bg-teal-50"
          title="Copy voiceover script"
          aria-label="Copy voiceover script"
        >
          <Clipboard size={16} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`border px-4 py-3 text-sm font-semibold ${statusTone(project.demoVideo.status)}`}>
          Video: {project.demoVideo.status}
          <p className="mt-1 text-xs font-normal leading-5">{project.demoVideo.uploadStatus.replaceAll("_", " ")}</p>
        </div>
        <div className={`border px-4 py-3 text-sm font-semibold ${statusTone(project.voiceover.status)}`}>
          Voiceover: {project.voiceover.status.replaceAll("_", " ")}
          <p className="mt-1 text-xs font-normal leading-5">{project.voiceover.provider}</p>
        </div>
        <div className={`border px-4 py-3 text-sm font-semibold ${statusTone(project.status)}`}>
          Project: {project.status}
          <p className="mt-1 text-xs font-normal leading-5">{project.proofReview.acceptedClaimIds.length} claims accepted</p>
        </div>
      </div>

      <ProviderStrip project={project} />

      <div className="grid gap-2 border border-stone-300 bg-[#f8fbf8] p-3">
        <p className="text-sm font-semibold text-stone-950">Video brief</p>
        <p className="text-sm leading-6 text-stone-700">{project.demoBrief.oneLiner}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {project.captions.map((caption) => (
            <div key={caption} className="border border-stone-300 bg-white px-3 py-2 text-xs leading-5 text-stone-700">
              {caption}
            </div>
          ))}
        </div>
      </div>

      <ProofReview
        acceptedClaimIds={acceptedClaimIds}
        isApproving={isApproving}
        onApprove={onApproveProof}
        onToggleClaim={onToggleClaim}
        project={project}
      />

      {videoReady ? (
        <div className="grid gap-3">
          <video
            src={project.demoVideo.url}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full border border-stone-900 bg-stone-950"
          />
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={project.demoVideo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-stone-900 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-teal-50"
            >
              <ExternalLink size={15} />
              Open video
            </a>
            <button
              type="button"
              onClick={() => project.demoVideo.url && downloadUrl(project.demoVideo.url)}
              className="inline-flex items-center gap-2 border border-stone-900 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-teal-50"
            >
              <Download size={15} />
              Download MP4
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 border border-stone-300 bg-[#f8fbf8] p-3">
          <p className="text-sm leading-6 text-stone-700">
            Render captures the product path, assembles the HyperFrames MP4, and adds Gradium audio when configured.
          </p>
          <button
            type="button"
            onClick={() => void onRenderVideo()}
            disabled={isRenderingVideo}
            className="inline-flex w-fit items-center gap-2 bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRenderingVideo ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {isRenderingVideo ? "Rendering video" : "Render demo video"}
          </button>
        </div>
      )}

      {project.voiceover.reason ? (
        <div className="flex gap-3 border border-sky-800 bg-sky-50 p-3 text-sm leading-6 text-sky-950">
          <Mic2 size={16} className="mt-1 shrink-0" />
          {project.voiceover.reason}
        </div>
      ) : null}

      {project.demoVideo.error && !videoReady ? (
        <div className="flex gap-3 border border-amber-800 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <AlertCircle size={16} className="mt-1 shrink-0" />
          {project.demoVideo.error}
        </div>
      ) : null}

      {renderMessage ? (
        <div className="flex gap-3 border border-amber-800 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <AlertCircle size={16} className="mt-1 shrink-0" />
          {renderMessage}
        </div>
      ) : null}

      <div className="grid gap-2 border border-stone-300 bg-white p-3">
        <p className="text-sm font-semibold text-stone-950">Accepted narration proof</p>
        {acceptedClaims.length ? (
          <div className="grid gap-2">
            {acceptedClaims.map((claim) => (
              <p key={claim.id} className="border border-stone-300 bg-[#f8fbf8] px-3 py-2 text-xs leading-5 text-stone-700">
                {compact(claim.text, 220)}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-5 text-stone-500">Approve at least one claim before external use.</p>
        )}
      </div>

      {isGenerating ? <p className="text-sm text-stone-500">Refreshing output...</p> : null}
    </div>
  );
}

export function ProofPitchLanding() {
  const [sourceUrl, setSourceUrl] = useState(sampleInput.sourceUrl);
  const [productName, setProductName] = useState(sampleInput.productName);
  const [targetAudience, setTargetAudience] = useState(sampleInput.targetAudience);
  const [demoGoal, setDemoGoal] = useState(sampleInput.demoGoal);
  const [demoInstructions, setDemoInstructions] = useState(sampleInput.demoInstructions);
  const [acceptedClaimIds, setAcceptedClaimIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [project, setProject] = useState<DemoVideoProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderMessage, setRenderMessage] = useState<string | null>(null);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    setCopyState(null);
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
          demoInstructions,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail ?? data?.error ?? "Demo video generation failed.");
      }

      const nextProject = data as DemoVideoProject;
      setProject(nextProject);
      setAcceptedClaimIds(nextProject.proofReview.acceptedClaimIds);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Demo video generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopyState("Copied");
    window.setTimeout(() => setCopyState(null), 1500);
  }

  function toggleClaim(claimId: string) {
    setAcceptedClaimIds((current) =>
      current.includes(claimId) ? current.filter((id) => id !== claimId) : [...current, claimId],
    );
  }

  async function approveProofReview() {
    if (!project) {
      return;
    }

    setIsApproving(true);
    setError(null);
    setRenderMessage(null);

    try {
      const response = await fetch(`/api/demo-videos/${project.id}/proof-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ acceptedClaimIds, project }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail ?? data?.error ?? "Proof review failed.");
      }

      setProject(data as DemoVideoProject);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Proof review failed.");
    } finally {
      setIsApproving(false);
    }
  }

  async function renderDemoVideo() {
    if (!project) {
      return;
    }

    setIsRenderingVideo(true);
    setRenderMessage("Capturing the site and rendering with HyperFrames...");
    setError(null);

    try {
      const response = await fetch(`/api/demo-videos/${project.id}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          captureSite: true,
          dryRun: false,
          project,
          renderVideo: true,
        }),
      });
      const data = (await response.json()) as RenderVideoResponse;

      if (!response.ok || data.error) {
        throw new Error(data.detail ?? data.error ?? "Video render failed.");
      }

      if (!data.render?.enabled) {
        setProject(data.project ?? project);
        setRenderMessage("Video render is disabled in this environment. Set PROOFPITCH_ENABLE_LOCAL_RENDER=1 to render locally.");
        return;
      }

      const videoArtifact = data.render.artifacts.find((artifact) => artifact.type === "video");

      if (!videoArtifact || videoArtifact.status !== "ready") {
        throw new Error(data.render.error ?? "Video render did not finish.");
      }

      setProject(data.project ?? project);
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
              Product URL to proof-aware demo video.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              The proof review controls what appears in captions and voiceover. Missing Gradium config falls back to captions-only.
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
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm outline-none focus:border-teal-800"
                placeholder="Product name"
                required
              />
              <input
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                className="border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm outline-none focus:border-teal-800"
                placeholder="Target audience"
                required
              />
            </div>
            <textarea
              value={demoGoal}
              onChange={(event) => setDemoGoal(event.target.value)}
              rows={2}
              className="resize-none border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-800"
              placeholder="Demo goal"
              required
            />
            <textarea
              value={demoInstructions}
              onChange={(event) => setDemoInstructions(event.target.value)}
              rows={2}
              className="resize-none border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-800"
              placeholder="Demo path, e.g. accept cookies, search Pricing, open the first result, scroll to the CTA"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center gap-2 bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {isGenerating ? "Generating" : "Generate demo brief"}
              </button>
              {project ? (
                <button
                  type="button"
                  onClick={() => void renderDemoVideo()}
                  disabled={isRenderingVideo}
                  className="inline-flex items-center gap-2 border border-stone-900 bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRenderingVideo ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Render video
                </button>
              ) : null}
              {copyState ? <span className="text-sm font-medium text-teal-800">{copyState}</span> : null}
              {error ? <span className="text-sm font-medium text-red-800">{error}</span> : null}
            </div>
          </form>
        </div>

        <OutputPreview
          key={project?.id ?? "empty-output"}
          acceptedClaimIds={acceptedClaimIds}
          isApproving={isApproving}
          isGenerating={isGenerating}
          isRenderingVideo={isRenderingVideo}
          onApproveProof={approveProofReview}
          onCopy={copyText}
          onRenderVideo={renderDemoVideo}
          onToggleClaim={toggleClaim}
          project={project}
          renderMessage={renderMessage}
        />
      </section>
    </main>
  );
}
