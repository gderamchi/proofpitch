"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Clipboard, ExternalLink, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { renderPitchPackMarkdown } from "@/lib/markdown-export";
import type { LaunchPack } from "@/lib/schemas";

const sampleInput = {
  sourceUrl: "https://example.com",
  productName: "ProofPitch",
  targetAudience: "Founder-led B2B teams",
  launchGoal: "Prepare a customer-call demo and concise deck.",
  demoInstructions: "Accept cookies if needed, scroll to the proof moment, then show the core workflow.",
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
  if (status === "ready" || status === "completed") {
    return "border-emerald-800 bg-emerald-50 text-emerald-950";
  }

  if (status === "failed") {
    return "border-red-800 bg-red-50 text-red-950";
  }

  return "border-amber-800 bg-amber-50 text-amber-950";
}

function OutputPreview({
  launchPack,
  isGenerating,
  onCopy,
  onRenderVideo,
  isRenderingVideo,
  renderState,
}: {
  launchPack: LaunchPack | null;
  isGenerating: boolean;
  onCopy: (text: string) => Promise<void>;
  onRenderVideo: () => Promise<void>;
  isRenderingVideo: boolean;
  renderState: string | null;
}) {
  if (!launchPack) {
    return (
      <div className="grid min-h-[420px] content-between border-2 border-stone-950 bg-white p-5 shadow-[10px_10px_0_#111827]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">Output</p>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight text-stone-950">
            A product demo video state and a separate pitch deck.
          </h2>
        </div>
        <div className="grid gap-3">
          {["Product demo status", "Slidev pitch deck", "Claim ledger"].map((item) => (
            <div key={item} className="flex items-center gap-3 border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700">
              <CheckCircle2 size={16} className="text-stone-900" />
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const claims = launchPack.pitchPack.claims.slice(0, 3);

  return (
    <div className="grid min-h-[420px] gap-4 border-2 border-stone-950 bg-white p-5 shadow-[10px_10px_0_#111827]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">Generated</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-stone-950">{launchPack.productName}</h2>
        </div>
        <button
          type="button"
          onClick={() => onCopy(renderPitchPackMarkdown(launchPack.pitchPack))}
          className="inline-flex h-10 w-10 items-center justify-center border border-stone-900 bg-stone-950 text-white transition hover:bg-teal-800"
          title="Copy pitch pack"
          aria-label="Copy pitch pack"
        >
          <Clipboard size={16} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`border px-4 py-3 text-sm font-semibold ${statusTone(launchPack.demoVideo.status)}`}>
          Demo video: {launchPack.demoVideo.status}
          <p className="mt-1 text-xs font-normal leading-5">{launchPack.demoVideo.uploadStatus.replaceAll("_", " ")}</p>
        </div>
        <div className="border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-950">
          Deck: {launchPack.pitchDeck.slideCount} slides
          <p className="mt-1 text-xs font-normal leading-5 text-stone-600">{launchPack.pitchDeck.format}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {Object.entries(launchPack.providers).map(([provider, report]) => (
          <div key={provider} className={`border px-3 py-2 text-xs font-semibold ${statusTone(report.state)}`}>
            {provider}: {report.state}
          </div>
        ))}
      </div>

      {launchPack.demoVideo.url ? (
        <div className="grid gap-3">
          <video
            src={launchPack.demoVideo.url}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full border border-stone-900 bg-stone-950"
          />
          <a
            href={launchPack.demoVideo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 border border-stone-900 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-teal-50"
          >
            <ExternalLink size={15} />
            Open full-size video
          </a>
        </div>
      ) : (
        <div className="grid gap-3 border border-stone-300 bg-[#f8fbf8] p-3">
          <p className="text-sm leading-6 text-stone-700">
            Let the demo agent handle consent, follow your path instructions, then assemble the walkthrough as a Remotion MP4.
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
          {renderState ? <p className="text-sm font-medium text-teal-800">{renderState}</p> : null}
        </div>
      )}

      {launchPack.demoVideo.error && !launchPack.demoVideo.url ? (
        <div className="flex gap-3 border border-amber-800 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <AlertCircle size={16} className="mt-1 shrink-0" />
          {launchPack.demoVideo.error}
        </div>
      ) : null}

      <div className="grid gap-2">
        {claims.map((claim) => (
          <div key={claim.id} className="border border-stone-300 bg-white p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-normal text-teal-800">
              {claim.status.replaceAll("_", " ")}
            </div>
            <p className="text-sm leading-6 text-stone-800">{claim.text}</p>
          </div>
        ))}
      </div>

      {isGenerating ? (
        <p className="text-sm text-stone-500">Refreshing output...</p>
      ) : null}
    </div>
  );
}

export function ProofPitchLanding() {
  const [sourceUrl, setSourceUrl] = useState(sampleInput.sourceUrl);
  const [productName, setProductName] = useState(sampleInput.productName);
  const [targetAudience, setTargetAudience] = useState(sampleInput.targetAudience);
  const [launchGoal, setLaunchGoal] = useState(sampleInput.launchGoal);
  const [demoInstructions, setDemoInstructions] = useState(sampleInput.demoInstructions);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<LaunchPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderState, setRenderState] = useState<string | null>(null);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    setCopyState(null);

    try {
      const response = await fetch("/api/launch-packs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl,
          productName,
          targetAudience,
          launchGoal,
          demoInstructions,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Release pack generation failed.");
      }

      setResult(data as LaunchPack);
      setRenderState(null);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Release pack generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopyState("Copied");
    window.setTimeout(() => setCopyState(null), 1500);
  }

  async function renderDemoVideo() {
    if (!result) {
      return;
    }

    setIsRenderingVideo(true);
    setRenderState("Capturing the site and rendering with Remotion...");
    setError(null);

    try {
      const response = await fetch(`/api/launch-packs/${result.id}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          captureSite: true,
          dryRun: false,
          force: true,
          renderDeck: false,
          renderVideo: true,
        }),
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.detail ?? data.error ?? "Video render failed.");
      }

      const videoArtifact = Array.isArray(data.artifacts)
        ? data.artifacts.find((artifact: { type?: string }) => artifact.type === "video")
        : null;

      if (!videoArtifact || videoArtifact.status !== "ready") {
        throw new Error(data.error ?? "Video render did not finish.");
      }

      const videoUrl = `${data.videoUrl ?? `/api/launch-packs/${result.id}/video`}?v=${Date.now()}`;

      setResult({
        ...result,
        demoVideo: {
          ...result.demoVideo,
          status: "ready",
          durationSeconds: 24,
          uploadStatus: "not_required",
          url: videoUrl,
          error: undefined,
        },
        updatedAt: new Date().toISOString(),
      });
      setRenderState("Demo video rendered.");
    } catch (renderError) {
      const message = renderError instanceof Error ? renderError.message : "Video render failed.";

      setError(message);
      setRenderState(null);
    } finally {
      setIsRenderingVideo(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#edf4f1] text-stone-950 lg:overflow-hidden">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8">
        <div className="grid gap-5">
          <nav className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ProofPitchLogo />
              <div>
                <p className="text-sm font-semibold">ProofPitch</p>
                <p className="text-xs text-stone-500">demo + deck</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSourceUrl(sampleInput.sourceUrl);
                setProductName(sampleInput.productName);
                setTargetAudience(sampleInput.targetAudience);
                setLaunchGoal(sampleInput.launchGoal);
                setDemoInstructions(sampleInput.demoInstructions);
              }}
              className="border border-stone-900 bg-white px-3 py-2 text-xs font-semibold transition hover:bg-teal-50"
            >
              Load sample
            </button>
          </nav>

          <div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[0.96] text-stone-950 sm:text-5xl lg:text-6xl">
              Product URL to product demo video and pitch deck.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              ProofPitch now uses a small demo agent: it handles cookie walls, follows your path
              instructions, then turns that walkthrough into a Remotion video.
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
              value={launchGoal}
              onChange={(event) => setLaunchGoal(event.target.value)}
              rows={2}
              className="resize-none border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-800"
              placeholder="Goal"
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
                {isGenerating ? "Generating" : "Generate MVP pack"}
              </button>
              {copyState ? <span className="text-sm font-medium text-teal-800">{copyState}</span> : null}
              {error ? <span className="text-sm font-medium text-red-800">{error}</span> : null}
            </div>
          </form>
        </div>

        <OutputPreview
          launchPack={result}
          isGenerating={isGenerating}
          onCopy={copyText}
          onRenderVideo={renderDemoVideo}
          isRenderingVideo={isRenderingVideo}
          renderState={renderState}
        />
      </section>
    </main>
  );
}
